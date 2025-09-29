import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useChats } from './useChats';
import { ReportConfig, ReportMessage } from '../types';

const REPORTS_STORAGE_KEY = 'astra-report-configs';

export const useReports = () => {
  const { user } = useAuth();
  const { logChatMessage } = useChats();
  const [reportMessages, setReportMessages] = useState<ReportMessage[]>([]);
  const [reportConfigs, setReportConfigs] = useState<ReportConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningReports, setRunningReports] = useState<Set<string>>(new Set());

  // Load report configurations from localStorage
  const loadReportConfigs = useCallback(() => {
    try {
      const stored = localStorage.getItem(REPORTS_STORAGE_KEY);
      if (stored) {
        const configs = JSON.parse(stored);
        setReportConfigs(configs);
      }
    } catch (error) {
      console.error('Error loading report configs:', error);
    }
  }, []);

  // Save report configurations to localStorage
  const saveReportConfigs = useCallback((configs: ReportConfig[]) => {
    try {
      localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(configs));
      setReportConfigs(configs);
    } catch (error) {
      console.error('Error saving report configs:', error);
    }
  }, []);

  // Load report messages from database
  const loadReportMessages = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('astra_chats')
        .select('*')
        .eq('mode', 'reports')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading report messages:', error);
        setError('Failed to load reports');
        return;
      }

      const messages: ReportMessage[] = data.map(dbMessage => ({
        id: dbMessage.id,
        text: dbMessage.message,
        isUser: dbMessage.message_type === 'user',
        timestamp: new Date(dbMessage.created_at),
        messageType: dbMessage.message_type as 'user' | 'astra' | 'system',
        metadata: dbMessage.metadata || {},
        visualization: dbMessage.visualization,
        visualization_data: dbMessage.visualization_data,
        hasStoredVisualization: !!dbMessage.visualization_data,
        chatId: dbMessage.id,
        reportMetadata: dbMessage.metadata || {}
      }));

      setReportMessages(messages);
    } catch (err) {
      console.error('Error in loadReportMessages:', err);
      setError('Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Calculate next execution time
  const calculateNextExecution = useCallback((config: ReportConfig): Date => {
    const now = new Date();
    const [hours, minutes] = config.schedule_time.split(':').map(Number);
    
    let nextExecution = new Date();
    nextExecution.setHours(hours, minutes, 0, 0);

    switch (config.frequency) {
      case 'daily':
        if (nextExecution <= now) {
          nextExecution.setDate(nextExecution.getDate() + 1);
        }
        break;
      case 'weekly':
        if (nextExecution <= now) {
          nextExecution.setDate(nextExecution.getDate() + 7);
        }
        break;
      case 'monthly':
        if (nextExecution <= now) {
          nextExecution.setMonth(nextExecution.getMonth() + 1);
        }
        break;
    }

    return nextExecution;
  }, []);

  // Execute a report
  const executeReport = useCallback(async (config: ReportConfig, isManualRun = false) => {
    if (!user) return;

    // Prevent multiple executions of the same report
    if (runningReports.has(config.id)) {
      console.log('Report already running:', config.title);
      return;
    }

    // Mark report as running
    setRunningReports(prev => new Set(prev).add(config.id));

    const WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL;
    if (!WEBHOOK_URL) {
      setError('N8N webhook URL not configured');
      setRunningReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(config.id);
        return newSet;
      });
      return;
    }

    try {
      const reportMetadata = {
        report_type: "scheduled",
        report_title: config.title,
        report_frequency: config.frequency,
        report_schedule: config.schedule_time,
        executed_at: new Date().toISOString(),
        is_manual_run: isManualRun
      };

      // Get user profile for name
      const { data: userProfile } = await supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .single();

      const userName = userProfile?.name || user.email?.split('@')[0] || 'Unknown User';

      // Log user message (the report prompt)
      await logChatMessage(
        config.prompt,
        true, // isUser
        null, // No conversation ID for reports
        0, // No response time for user messages
        {},
        undefined,
        reportMetadata,
        false, // visualization
        'reports', // mode
        [], // mentions
        config.prompt, // astraPrompt
        undefined // visualizationData
      );

      // Send to N8N webhook (same format as private chat)
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatInput: config.prompt,
          user_id: user.id,
          user_email: user.email || '',
          user_name: userName,
          conversation_id: null,
          mode: 'reports'
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook request failed: ${response.status}`);
      }

      const responseText = await response.text();
      let messageText = responseText;

      // Try to parse JSON response
      try {
        const jsonResponse = JSON.parse(responseText);
        if (jsonResponse.output) {
          messageText = jsonResponse.output;
        }
      } catch (e) {
        // Use raw text if not JSON
      }

      // Log Astra response
      await logChatMessage(
        messageText,
        false, // isUser (Astra response)
        null, // No conversation ID for reports
        0, // Response time
        {}, // Tokens used
        'n8n-workflow', // Model used
        reportMetadata,
        false, // visualization
        'reports', // mode
        [], // mentions
        config.prompt, // astraPrompt
        undefined // visualizationData
      );

      // Update configuration after execution
      if (!isManualRun) {
        const updatedConfigs = reportConfigs.map(c => 
          c.id === config.id 
            ? {
                ...c,
                last_executed: new Date().toISOString(),
                next_execution: calculateNextExecution(c).toISOString()
              }
            : c
        );
        saveReportConfigs(updatedConfigs);
      }

      // Refresh report messages
      setTimeout(() => loadReportMessages(), 2000);

      console.log('✅ Report execution completed:', config.title);
    } catch (error) {
      console.error('Error executing report:', error);
      setError(`Failed to execute report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Remove from running reports
      setRunningReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(config.id);
        return newSet;
      });
    }
  }, [user, logChatMessage, reportConfigs, saveReportConfigs, calculateNextExecution, loadReportMessages]);

  // Create a new report
  const createReport = useCallback((reportData: Omit<ReportConfig, 'id' | 'created_at' | 'next_execution'>) => {
    const newReport: ReportConfig = {
      ...reportData,
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
      next_execution: calculateNextExecution(reportData as ReportConfig).toISOString()
    };

    const updatedConfigs = [...reportConfigs, newReport];
    saveReportConfigs(updatedConfigs);
  }, [reportConfigs, saveReportConfigs, calculateNextExecution]);

  // Update a report
  const updateReport = useCallback((reportId: string, updates: Partial<ReportConfig>) => {
    const updatedConfigs = reportConfigs.map(config => 
      config.id === reportId 
        ? { 
            ...config, 
            ...updates,
            next_execution: updates.schedule_time || updates.frequency 
              ? calculateNextExecution({ ...config, ...updates } as ReportConfig).toISOString()
              : config.next_execution
          }
        : config
    );
    saveReportConfigs(updatedConfigs);
  }, [reportConfigs, saveReportConfigs, calculateNextExecution]);

  // Delete a report
  const deleteReport = useCallback((reportId: string) => {
    const updatedConfigs = reportConfigs.filter(config => config.id !== reportId);
    saveReportConfigs(updatedConfigs);
  }, [reportConfigs, saveReportConfigs]);

  // Delete a specific report message instance
  const deleteReportMessage = useCallback(async (messageId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('astra_chats')
        .delete()
        .eq('id', messageId)
        .eq('user_id', user.id)
        .eq('mode', 'reports');

      if (error) {
        console.error('Error deleting report message:', error);
        throw new Error('Failed to delete report message');
      }

      // Remove from local state
      setReportMessages(prev => prev.filter(msg => msg.id !== messageId));
      
      console.log('✅ Deleted report message:', messageId);
    } catch (err) {
      console.error('Error in deleteReportMessage:', err);
      throw err;
    }
  }, [user]);

  // Check for scheduled reports (called by scheduler)
  const checkScheduledReports = useCallback(() => {
    const now = new Date();
    
    reportConfigs.forEach(config => {
      if (!config.enabled) return;
      
      const nextExecution = new Date(config.next_execution || 0);
      if (now >= nextExecution) {
        console.log('Executing scheduled report:', config.title);
        executeReport(config, false);
      }
    });
  }, [reportConfigs, executeReport]);

  // Load configurations on mount
  useEffect(() => {
    loadReportConfigs();
  }, [loadReportConfigs]);

  // Load messages when user changes
  useEffect(() => {
    if (user) {
      loadReportMessages();
    }
  }, [user, loadReportMessages]);

  return {
    reportMessages,
    reportConfigs,
    isLoading,
    error,
    runningReports,
    loadReportMessages,
    executeReport,
    createReport,
    updateReport,
    deleteReport,
    checkScheduledReports,
    setError,
    deleteReportMessage
  };
};