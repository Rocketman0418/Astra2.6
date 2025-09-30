import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  prompt_template: string;
  icon: string;
  default_schedule: string;
  default_time: string;
  is_active: boolean;
  created_at: string;
}

export interface UserReport {
  id: string;
  user_id: string;
  report_template_id: string | null;
  title: string;
  prompt: string;
  schedule_type: 'manual' | 'scheduled';
  schedule_frequency: string;
  schedule_time: string;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
  template?: ReportTemplate;
}

export interface ReportExecution {
  id: string;
  user_id: string;
  user_email: string;
  message: string;
  metadata: {
    report_title?: string;
    report_schedule?: string;
    report_frequency?: string;
    is_manual_run?: boolean;
    executed_at?: string;
  };
  created_at: string;
}

const WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL;

export const useReports = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [userReports, setUserReports] = useState<UserReport[]>([]);
  const [reportHistory, setReportHistory] = useState<ReportExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningReports, setRunningReports] = useState<Set<string>>(new Set());

  // Fetch report templates
  const fetchTemplates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('astra_report_templates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError('Failed to load report templates');
    }
  }, []);

  // Fetch user's report configurations
  const fetchUserReports = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('astra_reports')
        .select(`
          *,
          template:astra_report_templates(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserReports(data || []);
    } catch (err) {
      console.error('Error fetching user reports:', err);
      setError('Failed to load your reports');
    }
  }, [user]);

  // Fetch report execution history
  const fetchReportHistory = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('astra_chats')
        .select('id, user_id, user_email, message, metadata, created_at')
        .eq('user_id', user.id)
        .eq('mode', 'reports')
        .eq('message_type', 'astra')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setReportHistory(data || []);
    } catch (err) {
      console.error('Error fetching report history:', err);
      setError('Failed to load report history');
    }
  }, [user]);

  // Create new report
  const createReport = useCallback(async (reportData: {
    title: string;
    prompt: string;
    schedule_type: 'manual' | 'scheduled';
    schedule_frequency?: string;
    schedule_time?: string;
    report_template_id?: string;
  }): Promise<UserReport | null> => {
    if (!user) return null;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('astra_reports')
        .insert({
          user_id: user.id,
          title: reportData.title,
          prompt: reportData.prompt,
          schedule_type: reportData.schedule_type,
          schedule_frequency: reportData.schedule_frequency || 'daily',
          schedule_time: reportData.schedule_time || '07:00',
          report_template_id: reportData.report_template_id || null,
          is_active: true
        })
        .select(`
          *,
          template:astra_report_templates(*)
        `)
        .single();

      if (error) throw error;
      
      // Refresh user reports
      await fetchUserReports();
      
      return data;
    } catch (err) {
      console.error('Error creating report:', err);
      setError('Failed to create report');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, fetchUserReports]);

  // Update report
  const updateReport = useCallback(async (
    reportId: string, 
    updates: Partial<UserReport>
  ): Promise<UserReport | null> => {
    if (!user) return null;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('astra_reports')
        .update(updates)
        .eq('id', reportId)
        .eq('user_id', user.id)
        .select(`
          *,
          template:astra_report_templates(*)
        `)
        .single();

      if (error) throw error;
      
      // Refresh user reports
      await fetchUserReports();
      
      return data;
    } catch (err) {
      console.error('Error updating report:', err);
      setError('Failed to update report');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, fetchUserReports]);

  // Delete report
  const deleteReport = useCallback(async (reportId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('astra_reports')
        .delete()
        .eq('id', reportId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Refresh user reports
      await fetchUserReports();
      
      return true;
    } catch (err) {
      console.error('Error deleting report:', err);
      setError('Failed to delete report');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, fetchUserReports]);

  // Toggle report active status
  const toggleReportActive = useCallback(async (
    reportId: string, 
    isActive: boolean
  ): Promise<boolean> => {
    return (await updateReport(reportId, { is_active: isActive })) !== null;
  }, [updateReport]);

  // Run report manually
  const runReportNow = useCallback(async (reportId: string): Promise<boolean> => {
    if (!user || !WEBHOOK_URL) {
      setError('Webhook URL not configured');
      return false;
    }

    const report = userReports.find(r => r.id === reportId);
    if (!report) {
      setError('Report not found');
      return false;
    }

    // Prevent multiple runs of the same report
    if (runningReports.has(reportId)) {
      return false;
    }

    try {
      setRunningReports(prev => new Set(prev).add(reportId));
      
      // Get user profile for name
      const { data: userProfile } = await supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .single();

      const userName = userProfile?.name || user.email?.split('@')[0] || 'Unknown User';

      // Call N8N webhook
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatInput: report.prompt,
          user_id: user.id,
          user_email: user.email || '',
          user_name: userName,
          conversation_id: null,
          mode: 'reports',
          report_id: reportId,
          report_title: report.title,
          is_manual_run: true
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook request failed: ${response.status}`);
      }

      // Refresh report history after a short delay
      setTimeout(() => {
        fetchReportHistory();
      }, 2000);

      return true;
    } catch (err) {
      console.error('Error running report:', err);
      setError(`Failed to run report: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return false;
    } finally {
      setRunningReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(reportId);
        return newSet;
      });
    }
  }, [user, userReports, runningReports, fetchReportHistory]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user) return;

    // Subscribe to user's reports
    const reportsChannel = supabase
      .channel('user_reports')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'astra_reports',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchUserReports();
      })
      .subscribe();

    // Subscribe to report executions
    const historyChannel = supabase
      .channel('report_history')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'astra_chats',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        const newChat = payload.new as any;
        if (newChat.mode === 'reports' && newChat.message_type === 'astra') {
          fetchReportHistory();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(reportsChannel);
      supabase.removeChannel(historyChannel);
    };
  }, [user, fetchUserReports, fetchReportHistory]);

  // Load initial data
  useEffect(() => {
    fetchTemplates();
    if (user) {
      fetchUserReports();
      fetchReportHistory();
    }
  }, [user, fetchTemplates, fetchUserReports, fetchReportHistory]);

  return {
    // Data
    templates,
    userReports,
    reportHistory,
    loading,
    error,
    runningReports,

    // Actions
    fetchTemplates,
    fetchUserReports,
    fetchReportHistory,
    createReport,
    updateReport,
    deleteReport,
    toggleReportActive,
    runReportNow,
    setError
  };
};