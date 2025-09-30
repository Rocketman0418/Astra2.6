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
  schedule_frequency: string; // 'daily', 'weekly', 'monthly'
  schedule_time: string; // 'HH:00' format (e.g., "07:00", "14:00")
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
  template?: ReportTemplate;
}

export const useReports = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [userReports, setUserReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch report templates
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('astra_report_templates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching templates:', error);
        setError('Failed to load report templates');
        return;
      }

      setTemplates(data || []);
    } catch (err) {
      console.error('Error in fetchTemplates:', err);
      setError('Failed to load report templates');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch user's reports with template data
  const fetchUserReports = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('astra_reports')
        .select(`
          *,
          template:astra_report_templates(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user reports:', error);
        setError('Failed to load your reports');
        return;
      }

      setUserReports(data || []);
    } catch (err) {
      console.error('Error in fetchUserReports:', err);
      setError('Failed to load your reports');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Create a new report
  const createReport = useCallback(async (reportData: Omit<UserReport, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'last_run_at' | 'next_run_at' | 'template'>): Promise<UserReport | null> => {
    if (!user) return null;

    try {
      setLoading(true);
      
      // Calculate next run time if scheduled
      let nextRunAt = null;
      if (reportData.schedule_type === 'scheduled') {
        const { data: nextRun, error: calcError } = await supabase
          .rpc('calculate_next_run_time', {
            schedule_frequency: reportData.schedule_frequency,
            schedule_time: reportData.schedule_time,
            current_time: new Date().toISOString()
          });

        if (calcError) {
          console.error('Error calculating next run time:', calcError);
        } else {
          nextRunAt = nextRun;
        }
      }

      const { data, error } = await supabase
        .from('astra_reports')
        .insert({
          ...reportData,
          user_id: user.id,
          next_run_at: nextRunAt
        })
        .select(`
          *,
          template:astra_report_templates(*)
        `)
        .single();

      if (error) {
        console.error('Error creating report:', error);
        setError('Failed to create report');
        return null;
      }

      // Refresh user reports
      await fetchUserReports();
      
      return data;
    } catch (err) {
      console.error('Error in createReport:', err);
      setError('Failed to create report');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, fetchUserReports]);

  // Update an existing report
  const updateReport = useCallback(async (id: string, updates: Partial<UserReport>): Promise<UserReport | null> => {
    if (!user) return null;

    try {
      setLoading(true);

      // Calculate next run time if schedule changed
      let nextRunAt = updates.next_run_at;
      if (updates.schedule_type === 'scheduled' && (updates.schedule_frequency || updates.schedule_time)) {
        const currentReport = userReports.find(r => r.id === id);
        if (currentReport) {
          const { data: nextRun, error: calcError } = await supabase
            .rpc('calculate_next_run_time', {
              schedule_frequency: updates.schedule_frequency || currentReport.schedule_frequency,
              schedule_time: updates.schedule_time || currentReport.schedule_time,
              current_time: new Date().toISOString()
            });

          if (calcError) {
            console.error('Error calculating next run time:', calcError);
          } else {
            nextRunAt = nextRun;
          }
        }
      }

      const { data, error } = await supabase
        .from('astra_reports')
        .update({
          ...updates,
          next_run_at: nextRunAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select(`
          *,
          template:astra_report_templates(*)
        `)
        .single();

      if (error) {
        console.error('Error updating report:', error);
        setError('Failed to update report');
        return null;
      }

      // Refresh user reports
      await fetchUserReports();
      
      return data;
    } catch (err) {
      console.error('Error in updateReport:', err);
      setError('Failed to update report');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, userReports, fetchUserReports]);

  // Delete a report
  const deleteReport = useCallback(async (id: string): Promise<void> => {
    if (!user) return;

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('astra_reports')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting report:', error);
        setError('Failed to delete report');
        return;
      }

      // Refresh user reports
      await fetchUserReports();
    } catch (err) {
      console.error('Error in deleteReport:', err);
      setError('Failed to delete report');
    } finally {
      setLoading(false);
    }
  }, [user, fetchUserReports]);

  // Toggle report active status
  const toggleReportActive = useCallback(async (id: string, isActive: boolean): Promise<void> => {
    await updateReport(id, { is_active: isActive });
  }, [updateReport]);

  // Run report manually
  const runReportNow = useCallback(async (id: string): Promise<void> => {
    if (!user) return;

    const report = userReports.find(r => r.id === id);
    if (!report) {
      setError('Report not found');
      return;
    }

    const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
    if (!webhookUrl) {
      setError('N8N webhook URL not configured');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatInput: report.prompt,
          user_id: user.id,
          user_email: user.email || '',
          user_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          mode: 'reports',
          metadata: {
            report_title: report.title,
            report_schedule: report.schedule_time,
            report_frequency: report.schedule_frequency,
            is_manual_run: true,
            executed_at: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook request failed: ${response.status}`);
      }

      // Update last run time
      await updateReport(id, { last_run_at: new Date().toISOString() });

      console.log('✅ Report executed manually:', report.title);
    } catch (err) {
      console.error('Error running report:', err);
      setError('Failed to run report');
    } finally {
      setLoading(false);
    }
  }, [user, userReports, updateReport]);

  // Set up real-time subscription for user reports
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('astra_reports_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'astra_reports',
        filter: `user_id=eq.${user.id}`
      }, () => {
        // Refresh reports when changes occur
        fetchUserReports();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUserReports]);

  // Load data on mount
  useEffect(() => {
    fetchTemplates();
    if (user) {
      fetchUserReports();
    }
  }, [user, fetchTemplates, fetchUserReports]);

  return {
    templates,
    userReports,
    loading,
    error,
    fetchTemplates,
    fetchUserReports,
    createReport,
    updateReport,
    deleteReport,
    toggleReportActive,
    runReportNow,
    setError
  };
};