import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface AppNotification {
  id: string;
  user_id: string;
  type: 'report' | 'mention' | 'system';
  title: string;
  message: string;
  related_chat_id: string | null;
  related_report_id: string | null;
  is_read: boolean;
  read_at: string | null;
  action_url: string | null;
  created_at: string;
}

export const useAppNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch notifications
  const fetchNotifications = useCallback(async (includeRead: boolean = false) => {
    if (!user) return;

    try {
      setLoading(true);
      
      let query = supabase
        .from('astra_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!includeRead) {
        query = query.eq('is_read', false);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      setNotifications(data || []);
      
      // Update unread count
      const unread = (data || []).filter(n => !n.is_read).length;
      setUnreadCount(unread);

    } catch (err) {
      console.error('Error in fetchNotifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Mark notification as read
  const markAsRead = useCallback(async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('astra_notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error marking notification as read:', error);
        return;
      }

      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === id 
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );

      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));

    } catch (err) {
      console.error('Error in markAsRead:', err);
    }
  }, [user]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('astra_notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking all notifications as read:', error);
        return;
      }

      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ 
          ...n, 
          is_read: true, 
          read_at: new Date().toISOString() 
        }))
      );

      setUnreadCount(0);

    } catch (err) {
      console.error('Error in markAllAsRead:', err);
    }
  }, [user]);

  // Delete notification
  const deleteNotification = useCallback(async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('astra_notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting notification:', error);
        return;
      }

      // Update local state
      const deletedNotification = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      
      // Update unread count if deleted notification was unread
      if (deletedNotification && !deletedNotification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }

    } catch (err) {
      console.error('Error in deleteNotification:', err);
    }
  }, [user, notifications]);

  // Set up real-time subscription for notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('astra_notifications_changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'astra_notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        const newNotification = payload.new as AppNotification;
        
        // Add to notifications list
        setNotifications(prev => [newNotification, ...prev]);
        
        // Update unread count
        if (!newNotification.is_read) {
          setUnreadCount(prev => prev + 1);
        }

        // Show browser notification if permission granted
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(newNotification.title, {
            body: newNotification.message,
            icon: '/RocketHub Favicon.png',
            tag: `notification-${newNotification.id}`
          });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'astra_notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        // Refresh notifications on updates
        fetchNotifications(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }, []);

  // Load notifications on mount
  useEffect(() => {
    if (user) {
      fetchNotifications(true); // Load all notifications initially
      requestNotificationPermission(); // Request permission for browser notifications
    }
  }, [user, fetchNotifications, requestNotificationPermission]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    requestNotificationPermission
  };
};