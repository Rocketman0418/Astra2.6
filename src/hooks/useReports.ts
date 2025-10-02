import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ReportMessage } from '../types';

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
  const [reportMessages, setReportMessages] = useState<ReportMessage[]>([]);
  const [runningReports, setRunningReports] = useState<Set<string>>(new Set());
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
        nextRunAt = calculateNextRunTime(
          reportData.schedule_time,
          reportData.schedule_frequency,
          reportData.schedule_day
        );
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

      // Update local state immediately for instant UI feedback
      setUserReports(prev => [data, ...prev]);

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

      // Fetch fresh report data from database to avoid stale state
      const { data: freshReport } = await supabase
        .from('astra_reports')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      // Calculate next run time if schedule changed
      let nextRunAt = updates.next_run_at;

      console.log('🔍 updateReport called with:', {
        id,
        updates,
        freshReport: freshReport?.schedule_time,
        updateScheduleTime: updates.schedule_time
      });

      // Recalculate next_run_at if this is a scheduled report and any schedule field changed
      if (freshReport) {
        const isScheduled = updates.schedule_type === 'scheduled' || freshReport.schedule_type === 'scheduled';
        const scheduleTimeChanged = updates.schedule_time && updates.schedule_time !== freshReport.schedule_time;
        const scheduleFreqChanged = updates.schedule_frequency && updates.schedule_frequency !== freshReport.schedule_frequency;
        const scheduleDayChanged = updates.schedule_day !== undefined && updates.schedule_day !== freshReport.schedule_day;
        const scheduleChanged = scheduleTimeChanged || scheduleFreqChanged || scheduleDayChanged;

        console.log('🔍 Schedule check:', {
          isScheduled,
          scheduleChanged,
          scheduleTimeChanged,
          scheduleFreqChanged,
          scheduleDayChanged,
          old: freshReport.schedule_time,
          new: updates.schedule_time
        });

        if (isScheduled && scheduleChanged) {
          const finalScheduleTime = updates.schedule_time || freshReport.schedule_time;
          const finalFrequency = updates.schedule_frequency || freshReport.schedule_frequency;
          const finalDay = updates.schedule_day !== undefined ? updates.schedule_day : freshReport.schedule_day;

          console.log('🔍 Calculating with:', { finalScheduleTime, finalFrequency, finalDay });

          nextRunAt = calculateNextRunTime(finalScheduleTime, finalFrequency, finalDay);
          console.log('📅 Recalculated next_run_at:', nextRunAt);
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

      // Update local state immediately for instant UI feedback
      setUserReports(prev => prev.map(report => report.id === id ? data : report));

      return data;
    } catch (err) {
      console.error('Error in updateReport:', err);
      setError('Failed to update report');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, userReports, fetchUserReports]);

  // Helper function to calculate next run time
  const calculateNextRunTime = useCallback((
    scheduleTime: string,
    scheduleFrequency: string,
    scheduleDay: number | null
  ): string => {
    console.log('🕐 calculateNextRunTime:', { scheduleTime, scheduleFrequency, scheduleDay });

    const [hours, minutes] = scheduleTime.split(':').map(Number);

    // Get current UTC time
    const now = new Date();
    console.log('🕐 Current UTC time:', now.toISOString());

    // Get current date/time in Eastern timezone using formatter
    const easternFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'short'
    });

    const easternParts = easternFormatter.formatToParts(now);
    const easternValues: Record<string, string> = {};
    easternParts.forEach(part => {
      if (part.type !== 'literal') {
        easternValues[part.type] = part.value;
      }
    });

    const currentEasternHour = parseInt(easternValues.hour);
    const currentEasternMinute = parseInt(easternValues.minute);
    let targetDay = parseInt(easternValues.day);
    let targetMonth = parseInt(easternValues.month);
    let targetYear = parseInt(easternValues.year);

    console.log('🕐 Current Eastern time:', `${easternValues.month}/${easternValues.day}/${easternValues.year} ${easternValues.hour}:${easternValues.minute}`);

    const scheduledMinutes = hours * 60 + minutes;
    const currentMinutes = currentEasternHour * 60 + currentEasternMinute;
    const timeHasPassedToday = scheduledMinutes <= currentMinutes;

    if (scheduleFrequency === 'daily') {
      // For daily reports: run today if time hasn't passed, otherwise tomorrow
      if (timeHasPassedToday) {
        const tomorrow = new Date(targetYear, targetMonth - 1, targetDay + 1);
        targetDay = tomorrow.getDate();
        targetMonth = tomorrow.getMonth() + 1;
        targetYear = tomorrow.getFullYear();
        console.log('🕐 Daily: Scheduled for tomorrow (Eastern)');
      } else {
        console.log('🕐 Daily: Scheduled for today (Eastern)');
      }
    } else if (scheduleFrequency === 'weekly') {
      // For weekly reports: find next occurrence of the specified day of week
      const targetDayOfWeek = scheduleDay ?? 1; // Default to Monday if not specified
      const currentDate = new Date(targetYear, targetMonth - 1, targetDay);
      const currentDayOfWeek = currentDate.getDay();

      let daysUntilTarget = targetDayOfWeek - currentDayOfWeek;

      // If target day is today but time has passed, schedule for next week
      if (daysUntilTarget === 0 && timeHasPassedToday) {
        daysUntilTarget = 7;
      } else if (daysUntilTarget < 0) {
        // Target day is earlier in the week, so next occurrence is next week
        daysUntilTarget += 7;
      } else if (daysUntilTarget === 0) {
        // Target day is today and time hasn't passed
        daysUntilTarget = 0;
      }

      const nextDate = new Date(targetYear, targetMonth - 1, targetDay + daysUntilTarget);
      targetDay = nextDate.getDate();
      targetMonth = nextDate.getMonth() + 1;
      targetYear = nextDate.getFullYear();
      console.log('🕐 Weekly: Scheduled for', nextDate.toDateString());
    } else if (scheduleFrequency === 'monthly') {
      // For monthly reports: find next occurrence of the specified day of month
      const targetDayOfMonth = scheduleDay ?? 1; // Default to 1st if not specified

      // If we're past the target day this month, or it's today but time has passed, go to next month
      if (targetDay > targetDayOfMonth || (targetDay === targetDayOfMonth && timeHasPassedToday)) {
        targetMonth += 1;
        if (targetMonth > 12) {
          targetMonth = 1;
          targetYear += 1;
        }
      }

      targetDay = targetDayOfMonth;

      // Handle months with fewer than targetDayOfMonth days (e.g., Feb 30)
      const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
      if (targetDay > daysInMonth) {
        targetDay = daysInMonth;
      }

      console.log('🕐 Monthly: Scheduled for', `${targetMonth}/${targetDay}/${targetYear}`);
    }

    // Determine if target date is in EDT or EST
    const testDate = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, 12, 0, 0));
    const isEDT = isEasternDaylightTime(testDate);
    const offsetHours = isEDT ? 4 : 5; // EDT is UTC-4, EST is UTC-5

    // Create UTC timestamp: Eastern time + offset = UTC time
    const utcTime = new Date(Date.UTC(
      targetYear,
      targetMonth - 1,
      targetDay,
      hours + offsetHours,
      minutes,
      0,
      0
    ));

    console.log('🕐 Is EDT?', isEDT, '| Offset:', offsetHours, 'hours');
    console.log('🕐 Final UTC time:', utcTime.toISOString());
    console.log('🕐 Verification (Eastern):', utcTime.toLocaleString('en-US', {timeZone: 'America/New_York'}));

    return utcTime.toISOString();
  }, []);
  
  // Helper function to determine if a date is in Eastern Daylight Time
  const isEasternDaylightTime = useCallback((date: Date): boolean => {
    // EDT runs from second Sunday in March to first Sunday in November
    const year = date.getFullYear();

    // Second Sunday in March
    const marchSecondSunday = new Date(year, 2, 1); // March 1st
    marchSecondSunday.setDate(1 + (7 - marchSecondSunday.getDay()) + 7); // Second Sunday

    // First Sunday in November
    const novemberFirstSunday = new Date(year, 10, 1); // November 1st
    novemberFirstSunday.setDate(1 + (7 - novemberFirstSunday.getDay()) % 7); // First Sunday

    return date >= marchSecondSunday && date < novemberFirstSunday;
  }, []);

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

      // Update local state immediately for instant UI feedback
      setUserReports(prev => prev.filter(report => report.id !== id));
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

  // Fetch report messages from astra_chats table
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

      setReportMessages(messages);
    } catch (err) {
      console.error('Error in fetchReportMessages:', err);
    }
  }, [user]);

  // Check for scheduled reports (placeholder function)
  const checkScheduledReports = useCallback(async () => {
    // This would typically check for reports that need to run
    // For now, it's a placeholder as the N8N workflow handles scheduling
    console.log('Checking scheduled reports...');
  }, []);

  // Delete a report message
  const deleteReportMessage = useCallback(async (messageId: string): Promise<void> => {
    if (!user) return;

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('astra_chats')
        .delete()
        .eq('id', messageId)
        .eq('user_id', user.id)
        .eq('mode', 'reports');

      if (error) {
        console.error('Error deleting report message:', error);
        setError('Failed to delete report message');
        return;
      }

      // Refresh report messages
      await fetchReportMessages();
    } catch (err) {
      console.error('Error in deleteReportMessage:', err);
      setError('Failed to delete report message');
    } finally {
      setLoading(false);
    }
  }, [user, fetchReportMessages]);

  // Run report manually
  const runReportNow = useCallback(async (id: string): Promise<void> => {
    if (!user) return;

    const report = userReports.find(r => r.id === id);
    if (!report) {
      setError('Report not found');
      return;
    }

    try {
      setRunningReports(prev => new Set([...prev, id]));
      
      const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
      if (!webhookUrl) {
        throw new Error('N8N webhook URL not configured');
      }

      console.log('🚀 Running report manually:', {
        reportId: id,
        reportTitle: report.title,
        reportPrompt: report.prompt,
        webhookUrl: webhookUrl ? 'configured' : 'missing',
        userId: user.id,
        userEmail: user.email
      });

      const requestStartTime = Date.now();
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatInput: report.prompt,
          user_id: user.id,
          user_email: user.email,
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

      const requestEndTime = Date.now();
      const responseTimeMs = requestEndTime - requestStartTime;
      console.log('📡 Webhook response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Webhook failed:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        throw new Error(`Failed to execute report: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const responseText = await response.text();
      console.log('✅ Webhook success:', {
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 200) + '...'
      });

      // Parse the response to get the actual report content
      let reportContent = responseText;
      let metadata: any = {
        report_title: report.title,
        report_schedule: report.schedule_time,
        report_frequency: report.schedule_frequency,
        is_manual_run: true,
        executed_at: new Date().toISOString()
      };

      try {
        const jsonResponse = JSON.parse(responseText);
        if (jsonResponse.output) {
          reportContent = jsonResponse.output;
        }
        if (jsonResponse.metadata) {
          metadata = { ...metadata, ...jsonResponse.metadata };
        }
      } catch (e) {
        // Use raw text if not JSON
        console.log('📝 Using raw response text as report content');
      }

      console.log('💾 Saving report to astra_chats table...');
      
      // Save the report response to astra_chats table
      const { data: chatData, error: chatError } = await supabase
        .from('astra_chats')
        .insert({
          user_id: user.id,
          user_email: user.email,
          user_name: 'Astra',
          message: reportContent,
          message_type: 'astra',
          conversation_id: null,
          response_time_ms: responseTimeMs,
          tokens_used: {},
          model_used: 'n8n-workflow',
          metadata: metadata,
          visualization: false,
          mode: 'reports',
          mentions: [],
          astra_prompt: report.prompt,
          visualization_data: null
        })
        .select()
        .single();

      if (chatError) {
        console.error('❌ Error saving report to astra_chats:', chatError);
        throw new Error(`Failed to save report: ${chatError.message}`);
      }

      console.log('✅ Report saved to astra_chats with ID:', chatData.id);
      
      // Force refresh report messages immediately and with a delay to ensure UI updates
      console.log('🔄 Refreshing report messages after execution...');
      await fetchReportMessages();
      
      // Also refresh after a short delay to ensure any async operations complete
      setTimeout(async () => {
        console.log('🔄 Secondary refresh of report messages...');
        await fetchReportMessages();
        console.log('✅ Report messages refreshed (secondary)');
      }, 1000);
      
      // Update the report's last_run_at and next_run_at after successful execution
      try {
        const now = new Date().toISOString();
        let nextRunAt = null;

        if (report.schedule_type === 'scheduled') {
          nextRunAt = calculateNextRunTime(
            report.schedule_time,
            report.schedule_frequency,
            report.schedule_day || null
          );
        }
        
        await supabase
          .from('astra_reports')
          .update({
            last_run_at: now,
            next_run_at: nextRunAt
          })
          .eq('id', id);
          
        console.log('✅ Updated report schedule after execution');
        
        // Refresh user reports to show updated times
        await fetchUserReports();
      } catch (scheduleError) {
        console.error('Error updating report schedule:', scheduleError);
      }
      
    } catch (err) {
      console.error('Error running report:', err);
      setError(`Failed to run report: ${err instanceof Error ? err.message : 'Unknown error'}`);
      throw err; // Re-throw so the modal can handle it
    } finally {
      setRunningReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  }, [user, userReports, fetchReportMessages, calculateNextRunTime, fetchUserReports]);

  // Initialize data on mount and set up realtime subscription
  useEffect(() => {
    if (user) {
      fetchTemplates();
      fetchUserReports();
      fetchReportMessages();

      // Set up realtime subscription for user's reports
      const reportsChannel = supabase
        .channel('user-reports')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'astra_reports',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('📡 [useReports] Realtime report change:', payload);

            if (payload.eventType === 'INSERT') {
              // Use setUserReports with callback to check current state
              setUserReports(prev => {
                const reportExists = prev.some(r => r.id === payload.new.id);
                if (reportExists) {
                  console.log('📡 Report already in list from optimistic update');
                  return prev; // No change needed
                } else {
                  console.log('📡 New report detected, triggering fetch...');
                  // Trigger a fetch in the next tick
                  setTimeout(() => fetchUserReports(), 0);
                  return prev;
                }
              });
            } else if (payload.eventType === 'UPDATE') {
              console.log('📡 Report updated, refreshing list...');
              fetchUserReports();
            } else if (payload.eventType === 'DELETE') {
              // Remove deleted report
              console.log('📡 Report deleted, removing from list...');
              setUserReports(prev => prev.filter(r => r.id !== payload.old.id));
            }
          }
        )
        .subscribe((status) => {
          console.log('📡 [useReports] Subscription status:', status);
        });

      // Cleanup subscription on unmount
      return () => {
        supabase.removeChannel(reportsChannel);
      };
    }
  }, [user, fetchTemplates, fetchUserReports, fetchReportMessages]);

  return {
    templates,
    userReports,
    reportMessages,
    runningReports,
    loading,
    error,
    fetchTemplates,
    fetchUserReports,
    createReport,
    updateReport,
    deleteReport,
    toggleReportActive,
    runReportNow,
    fetchReportMessages,
    checkScheduledReports,
    deleteReportMessage
  };
};