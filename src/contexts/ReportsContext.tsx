import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  prompt_template: string;
  default_schedule: string;
  default_time: string;
  created_at: string;
}

export interface UserReport {
  id: string;
  user_id: string;
  title: string;
  prompt: string;
  schedule_type: 'manual' | 'scheduled';
  schedule_frequency: string;
  schedule_time: string;
  schedule_day: number | null;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  report_template_id: string | null;
  created_at: string;
  template?: ReportTemplate;
}

export interface ReportMessage {
  id: string;
  chatId: string;
  text: string;
  timestamp: Date;
  isUser: boolean;
  visualization: boolean;
  reportMetadata?: any;
  visualization_data?: string;
}

interface ReportsContextType {
  templates: ReportTemplate[];
  userReports: UserReport[];
  reportMessages: ReportMessage[];
  loading: boolean;
  error: string | null;
  runningReports: Set<string>;
  createReport: (data: any) => Promise<void>;
  updateReport: (id: string, data: any) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  toggleReportActive: (id: string, isActive: boolean) => Promise<void>;
  runReportNow: (id: string) => Promise<void>;
  deleteReportMessage: (id: string) => Promise<void>;
  checkScheduledReports: () => Promise<void>;
  setError: (error: string | null) => void;
}

const ReportsContext = createContext<ReportsContextType | undefined>(undefined);

export const ReportsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [userReports, setUserReports] = useState<UserReport[]>([]);
  const [reportMessages, setReportMessages] = useState<ReportMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningReports, setRunningReports] = useState<Set<string>>(new Set());

  const fetchTemplates = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('astra_report_templates')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  }, [user]);

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
      console.log('📊 Fetched user reports:', data?.length);
      setUserReports(data || []);
    } catch (err) {
      console.error('Error fetching user reports:', err);
    }
  }, [user]);

  const fetchReportMessages = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('astra_chats')
        .select('*')
        .eq('user_id', user.id)
        .eq('mode', 'reports')
        .eq('message_type', 'astra')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching report messages:', error);
        return;
      }

      // Transform to ReportMessage format
      const messages: ReportMessage[] = (data || []).map(chat => ({
        id: chat.id,
        chatId: chat.id,
        text: chat.message,
        timestamp: new Date(chat.created_at),
        isUser: false,
        visualization: !!chat.visualization_data,
        reportMetadata: chat.metadata,
        visualization_data: chat.visualization_data
      }));

      console.log('📊 [ReportsContext] Fetched report messages:', messages.length);
      setReportMessages(messages);
    } catch (err) {
      console.error('Error fetching report messages:', err);
    }
  }, [user]);

  const createReport = async (data: any) => {
    if (!user) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('astra_reports')
        .insert({
          ...data,
          user_id: user.id
        });

      if (error) throw error;

      // Fetch updated list
      await fetchUserReports();
    } catch (err: any) {
      console.error('Error creating report:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateReport = async (id: string, data: any) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('astra_reports')
        .update(data)
        .eq('id', id);

      if (error) throw error;

      await fetchUserReports();
    } catch (err: any) {
      console.error('Error updating report:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteReport = async (id: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('astra_reports')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setUserReports(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      console.error('Error deleting report:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const toggleReportActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('astra_reports')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;

      await fetchUserReports();
    } catch (err: any) {
      console.error('Error toggling report:', err);
      setError(err.message);
    }
  };

  const runReportNow = async (id: string) => {
    if (!user) return;

    try {
      setRunningReports(prev => new Set(prev).add(id));

      const { data: report, error: fetchError } = await supabase
        .from('astra_reports')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-report`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          reportId: report.id,
          prompt: report.prompt
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to generate report' }));
        throw new Error(errorData.error || 'Failed to generate report');
      }

      await fetchReportMessages();
      await fetchUserReports();
    } catch (err: any) {
      console.error('Error running report:', err);
      setError(err.message);
      throw err;
    } finally {
      setRunningReports(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const deleteReportMessage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('astra_chats')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setReportMessages(prev => prev.filter(m => m.id !== id));
    } catch (err: any) {
      console.error('Error deleting report message:', err);
      setError(err.message);
    }
  };

  const checkScheduledReports = async () => {
    // This is a placeholder - actual scheduling would be done server-side
    console.log('Checking scheduled reports...');
  };

  // Initialize data and set up real-time subscription
  useEffect(() => {
    if (user) {
      fetchTemplates();
      fetchUserReports();
      fetchReportMessages();

      // Set up realtime subscription for report configs
      const reportsChannel = supabase
        .channel('user-reports-global')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'astra_reports',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('📡 [ReportsContext] Realtime event:', payload.eventType, payload);

            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              fetchUserReports();
            } else if (payload.eventType === 'DELETE') {
              setUserReports(prev => prev.filter(r => r.id !== payload.old.id));
            }
          }
        )
        .subscribe((status) => {
          console.log('📡 [ReportsContext] Subscription status:', status);
        });

      // Set up realtime subscription for report messages (astra_chats with mode='reports')
      const messagesChannel = supabase
        .channel('user-report-messages')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'astra_chats',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('📡 [ReportsContext] Report messages realtime event:', payload.eventType, payload);
            console.log('📡 [ReportsContext] Payload new:', payload.new);
            console.log('📡 [ReportsContext] Payload old:', payload.old);

            // Refresh on any report message change (INSERT or UPDATE)
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const record = payload.new || payload.old;
              if (record && (record as any).mode === 'reports') {
                console.log('📡 [ReportsContext] Reports message changed, refreshing...');
                fetchReportMessages();
              }
            } else if (payload.eventType === 'DELETE' && payload.old && (payload.old as any).mode === 'reports') {
              console.log('📡 [ReportsContext] Reports message deleted, refreshing...');
              setReportMessages(prev => prev.filter(m => m.id !== payload.old.id));
            }
          }
        )
        .subscribe((status) => {
          console.log('📡 [ReportsContext] Messages subscription status:', status);
        });

      return () => {
        supabase.removeChannel(reportsChannel);
        supabase.removeChannel(messagesChannel);
      };
    }
  }, [user, fetchTemplates, fetchUserReports, fetchReportMessages]);

  return (
    <ReportsContext.Provider
      value={{
        templates,
        userReports,
        reportMessages,
        loading,
        error,
        runningReports,
        createReport,
        updateReport,
        deleteReport,
        toggleReportActive,
        runReportNow,
        deleteReportMessage,
        checkScheduledReports,
        setError
      }}
    >
      {children}
    </ReportsContext.Provider>
  );
};

export const useReportsContext = () => {
  const context = useContext(ReportsContext);
  if (context === undefined) {
    throw new Error('useReportsContext must be used within a ReportsProvider');
  }
  return context;
};
