import { useState, useCallback, useEffect } from 'react';
import { supabase, Database } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useChats } from './useChats';
import { GroupMessage } from '../types';

type GroupMessageRow = Database['public']['Tables']['group_messages']['Row'];
type GroupMessageInsert = Database['public']['Tables']['group_messages']['Insert'];

const WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL;

export const useGroupChat = () => {
  const { user } = useAuth();
  const { logChatMessage } = useChats();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAstraThinking, setIsAstraThinking] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [totalMessageCount, setTotalMessageCount] = useState(0);

  // Parse @mentions from message content
  const parseMentions = useCallback((message: string): string[] => {
    // Simple mention parsing - just look for @word patterns
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(message)) !== null) {
      mentions.push(match[1]);
    }
    console.log('🔍 parseMentions: Input message:', message);
    console.log('🔍 parseMentions: Found mentions:', mentions);
    return mentions;
  }, []);

  // Get user's display name
  const getUserName = useCallback(async (): Promise<string> => {
    if (!user) return 'Unknown User';

    try {
      const { data, error } = await supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .single();

      if (error || !data?.name) {
        return user.email?.split('@')[0] || 'Unknown User';
      }

      return data.name;
    } catch (err) {
      return user.email?.split('@')[0] || 'Unknown User';
    }
  }, [user]);

  // Fetch message history
  const fetchMessages = useCallback(async (limit: number = 100, offset: number = 0, append: boolean = false) => {
    // Save current scroll position before fetching
    const scrollContainer = document.querySelector('.chat-messages-container');
    const savedScrollTop = scrollContainer?.scrollTop || 0;
    const savedScrollHeight = scrollContainer?.scrollHeight || 0;
    
    try {
      if (!append) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      
      console.log('🔄 fetchMessages: Starting to fetch messages...');
      
      // First, get total count of messages
      const { count: totalCount, error: countError } = await supabase
        .from('astra_chats')
        .select('*', { count: 'exact', head: true })
        .eq('mode', 'team');

      if (!countError && totalCount !== null) {
        setTotalMessageCount(totalCount);
        setHasMoreMessages(offset + limit < totalCount);
      }

      // Fetch from astra_chats table where mode = 'team'
      const { data, error } = await supabase
        .from('astra_chats')
        .select(`
          id,
          user_id,
          user_name,
          user_email,
          message,
          message_type,
          mentions,
          astra_prompt,
          visualization_data,
          metadata,
          created_at,
          updated_at
        `)
        .eq('mode', 'team')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        console.error('Error fetching messages:', error);
        setError('Failed to load messages');
        return;
      }

      console.log('🔄 fetchMessages: Raw data from database:', data?.length, 'messages');
      console.log('🔄 fetchMessages: Total messages in database:', totalCount);
      console.log('🔄 fetchMessages: Offset:', offset, 'Limit:', limit, 'Append:', append);
      console.log('🔄 fetchMessages: Last 3 messages:', data?.slice(-3).map(m => ({
        id: m.id,
        user_name: m.user_name,
        message_type: m.message_type,
        message: m.message.substring(0, 50) + '...'
      })));

      // Transform astra_chats data to GroupMessage format
      const transformedMessages: GroupMessage[] = (data || []).map(chat => ({
        id: chat.id,
        user_id: chat.user_id,
        user_name: chat.user_name,
        user_email: chat.user_email,
        message_content: chat.message,
        message_type: chat.message_type as 'user' | 'astra' | 'system',
        mentions: chat.mentions || [],
        astra_prompt: chat.astra_prompt,
        visualization_data: chat.visualization_data,
        metadata: chat.metadata || {},
        created_at: chat.created_at,
        updated_at: chat.updated_at
      }));

      // Since we ordered by descending, reverse to show chronologically
      transformedMessages.reverse();

      console.log('🔄 fetchMessages: Transformed messages:', transformedMessages.length);
      console.log('🔄 fetchMessages: Last 5 transformed messages:', transformedMessages.slice(-5).map(m => ({
        id: m.id,
        user_name: m.user_name,
        message_type: m.message_type,
        message_content: m.message_content.substring(0, 50) + '...',
        created_at: m.created_at
      })));

      if (append) {
        // Prepend older messages to the beginning of the array
        setMessages(prev => [...transformedMessages, ...prev]);
      } else {
        setMessages(transformedMessages);
      }
      
      // Restore scroll position after state update
      setTimeout(() => {
        if (scrollContainer) {
          if (append) {
            // When loading more messages, maintain scroll position relative to the content that was already visible
            const newScrollHeight = scrollContainer.scrollHeight;
            const heightDifference = newScrollHeight - savedScrollHeight;
            scrollContainer.scrollTop = savedScrollTop + heightDifference;
          } else {
            // Calculate new scroll position based on content growth
            const newScrollHeight = scrollContainer.scrollHeight;
            const heightDifference = newScrollHeight - savedScrollHeight;
            
            // If we were at the bottom before, stay at the bottom
            const wasAtBottom = savedScrollTop + scrollContainer.clientHeight >= savedScrollHeight - 50;
            
            if (wasAtBottom) {
              scrollContainer.scrollTop = newScrollHeight;
            } else {
              // Preserve relative position by adjusting for new content
              scrollContainer.scrollTop = savedScrollTop + heightDifference;
            }
          }
        }
      }, 0);
      
      const totalMessagesNow = append ? messages.length + transformedMessages.length : transformedMessages.length;
      console.log('✅ Team Chat: Messages state updated with', totalMessagesNow, 'total messages');
    } catch (err) {
      console.error('Error in fetchMessages:', err);
      setError('Failed to load messages');
    } finally {
      if (!append) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, [messages.length]);

  // Send a group message
  const sendMessage = useCallback(async (
    content: string, 
    imageData?: { url: string; filename: string; size: number },
    replyTo?: { id: string; content: string; userName: string; timestamp: string }
  ) => {
    console.log('🚀 useGroupChat: sendMessage called with content:', content);
    console.log('🚀 useGroupChat: imageData:', imageData);
    console.log('🚀 useGroupChat: Current user:', user?.id, user?.email);
    console.log('🚀 useGroupChat: WEBHOOK_URL exists:', !!WEBHOOK_URL);
    console.log('🚀 useGroupChat: Reply to:', replyTo);
    
    if (!user || (!content.trim() && !imageData)) return;

    // Check if webhook URL is configured
    if (!WEBHOOK_URL) {
      console.error('N8N webhook URL not configured');
      setError('Configuration error: N8N webhook URL not set. Please check your environment variables.');
      return;
    }

    const mentions = parseMentions(content);
    console.log('🚀 useGroupChat: Parsed mentions:', mentions);
    const userName = await getUserName();
    console.log('🚀 useGroupChat: User name:', userName);
    const isAstraMention = mentions.some(mention => mention.toLowerCase() === 'astra');
    console.log('🚀 useGroupChat: Is Astra mention:', isAstraMention);

    // Prepare metadata for reply
    const messageMetadata: any = { 
      team_chat: true,
      message_type: 'user',
      has_image: !!imageData
    };

    if (imageData) {
      messageMetadata.image = imageData;
    }

    if (replyTo) {
      messageMetadata.reply_to_message_id = replyTo.id;
      messageMetadata.reply_to_message = {
        id: replyTo.id,
        content: replyTo.content,
        userName: replyTo.userName,
        timestamp: replyTo.timestamp
      };
    }

    try {
      console.log('🚀 useGroupChat: About to log user message...');
      // Log user message to astra_chats
      const userMessageId = await logChatMessage(
        content.trim(),
        true, // isUser
        null, // No conversation ID for team chat
        0, // No response time for user messages
        {}, // No tokens used
        null, // No model used for user messages
        messageMetadata,
        false, // visualization
        'team', // mode
        mentions, // mentions
        undefined, // astraPrompt
        undefined // visualizationData
      );
      
      console.log('✅ Team Chat: User message logged with ID:', userMessageId);

      // If @astra was mentioned, get AI response
      if (isAstraMention) {
        console.log('🤖 useGroupChat: Astra mentioned, setting thinking state...');
        setIsAstraThinking(true);
        
        try {
          // Extract the prompt after @astra
          const astraPrompt = content.replace(/@astra\s*/gi, '').trim();
          console.log('🤖 useGroupChat: Extracted Astra prompt:', astraPrompt);
          console.log('🌐 useGroupChat: About to call webhook...');
          
          const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              chatInput: astraPrompt,
              user_id: user.id,
              user_email: user.email || '',
              user_name: userName,
              conversation_id: null,
              mode: 'team',
              original_message: content.trim(),
              mentions: mentions
            })
          });

          const requestStartTime = Date.now();
          console.log('🌐 useGroupChat: Webhook response status:', response.status);
          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Team Chat: Webhook failed:', response.status, errorText);
            throw new Error('Failed to get Astra response');
          }

          const responseText = await response.text();
          console.log('🌐 useGroupChat: Webhook response text length:', responseText.length);
          const requestEndTime = Date.now();
          const responseTimeMs = requestEndTime - requestStartTime;
          let astraResponse = responseText;
          
          // Try to parse JSON response
          try {
            const jsonResponse = JSON.parse(responseText);
            if (jsonResponse.output) {
              astraResponse = jsonResponse.output;
            }
          } catch (e) {
            // Use raw text if not JSON
          }
          
          console.log('🤖 useGroupChat: About to log Astra response...');
          // Log Astra's response to astra_chats table
          const astraMessageId = await logChatMessage(
            astraResponse,
            false, // isUser (Astra response)
            null, // No conversation ID for team chat
            responseTimeMs, // Response time
            {}, // Tokens used - could be extracted from response
            'n8n-workflow', // Model used
            { 
              team_chat: true,
              message_type: 'astra',
              asked_by_user_name: userName,
              original_user_message_id: userMessageId
            },
            false, // visualization
            'team', // mode
            [], // mentions (Astra doesn't mention anyone)
            astraPrompt, // astraPrompt
            undefined // visualizationData
          );
          
          console.log('✅ Team Chat: Astra response logged with ID:', astraMessageId);
          
          // Add a small delay to ensure database write is complete
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Force refresh messages immediately after logging Astra response
          console.log('🔄 Team Chat: Force refreshing messages after Astra response...');
          await fetchMessages();
          
          // Double-check that the message appears in state
          setTimeout(() => {
            console.log('🔍 Team Chat: Current messages count after refresh:', messages.length);
            const lastMessage = messages[messages.length - 1];
            console.log('🔍 Team Chat: Last message in state:', lastMessage ? {
              id: lastMessage.id,
              user_name: lastMessage.user_name,
              message_type: lastMessage.message_type,
              message_content: lastMessage.message_content.substring(0, 50) + '...'
            } : 'No messages');
          }, 200);
        } catch (err) {
          console.error('Error getting Astra response:', err);
          
          // Log error response to astra_chats table
          await logChatMessage(
            "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.",
            false, // isUser (Astra response)
            null, // No conversation ID for team chat
            0, // No response time for errors
            {}, // No tokens used
            'n8n-workflow', // Model used
            { 
              team_chat: true,
              message_type: 'astra',
              asked_by_user_name: userName,
              original_user_message_id: userMessageId,
              error: true
            },
            false, // visualization
            'team', // mode
            [], // mentions
            content.replace(/@astra\s*/i, '').trim(), // astraPrompt
            undefined // visualizationData
          );
          
          // Add delay for error response too
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Also refresh messages after error response
          console.log('🔄 Team Chat: Force refreshing messages after error response...');
          await fetchMessages();
        } finally {
          console.log('🤖 useGroupChat: Setting Astra thinking to false...');
          setIsAstraThinking(false);
        }
      }
      
      // Only refresh if we didn't already refresh above (for non-Astra messages)
      if (!isAstraMention) {
        console.log('🔄 Team Chat: Refreshing messages after regular message send...');
        setTimeout(async () => {
          await fetchMessages();
          console.log('✅ Team Chat: Messages refreshed');
        }, 500); // Small delay to ensure database writes are complete
      }
    } catch (err) {
      console.error('Error in sendMessage:', err);
      setError('Failed to send message');
    }
  }, [user, parseMentions, getUserName, logChatMessage, fetchMessages]);

  // Search messages
  const searchMessages = useCallback(async (query: string): Promise<GroupMessage[]> => {
    try {
      const { data, error } = await supabase
        .from('astra_chats')
        .select(`
          id,
          user_id,
          user_name,
          user_email,
          message,
          message_type,
          mentions,
          astra_prompt,
          visualization_data,
          metadata,
          created_at,
          updated_at
        `)
        .eq('mode', 'team')
        .or(`message.ilike.%${query}%,user_name.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error searching messages:', error);
        return [];
      }

      // Transform astra_chats data to GroupMessage format
      const transformedMessages: GroupMessage[] = (data || []).map(chat => ({
        id: chat.id,
        user_id: chat.user_id,
        user_name: chat.user_name,
        user_email: chat.user_email,
        message_content: chat.message,
        message_type: chat.message_type as 'user' | 'astra' | 'system',
        mentions: chat.mentions || [],
        astra_prompt: chat.astra_prompt,
        visualization_data: chat.visualization_data,
        metadata: chat.metadata || {},
        created_at: chat.created_at,
        updated_at: chat.updated_at
      }));

      return transformedMessages;
    } catch (err) {
      console.error('Error in searchMessages:', err);
      return [];
    }
  }, []);

  // Update visualization data for a message
  const updateVisualizationData = useCallback(async (messageId: string, visualizationData: string) => {
    try {
      const { error } = await supabase
        .from('astra_chats')
        .update({ visualization_data: visualizationData })
        .eq('id', messageId);

      if (error) {
        console.error('Error updating visualization data:', error);
        return;
      }

      // Update local state
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, visualization_data: visualizationData }
          : msg
      ));
    } catch (err) {
      console.error('Error in updateVisualizationData:', err);
    }
  }, []);

  // Load more messages (older messages)
  const loadMoreMessages = useCallback(async () => {
    if (!hasMoreMessages || loadingMore) return;
    
    console.log('🔄 Team Chat: Loading more messages...');
    await fetchMessages(50, messages.length, true); // append=true for older messages
  }, [hasMoreMessages, loadingMore, fetchMessages, messages.length]);

  // Set up real-time subscription
  useEffect(() => {
    if (!user) return;

    console.log('🔄 Setting up real-time subscription for team chat...');

    const channel = supabase
      .channel('astra_chats_team')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'astra_chats',
        filter: 'mode=eq.team'
      }, (payload) => {
        console.log('🔄 Real-time: New message received:', payload.new);
        const newChat = payload.new as any;
        // Transform and add new message
        setMessages(prev => {
          const messageExists = prev.some(msg => msg.id === newChat.id);
          if (messageExists) {
            console.log('🔄 Real-time: Message already exists, skipping:', newChat.id);
            return prev;
          }
          
          const transformedMessage: GroupMessage = {
            id: newChat.id,
            user_id: newChat.user_id,
            user_name: newChat.user_name,
            user_email: newChat.user_email,
            message_content: newChat.message,
            message_type: newChat.message_type,
            mentions: newChat.mentions || [],
            astra_prompt: newChat.astra_prompt,
            visualization_data: newChat.visualization_data,
            metadata: newChat.metadata || {},
            created_at: newChat.created_at,
            updated_at: newChat.updated_at
          };
          
          console.log('🔄 Real-time: Adding new message to state:', transformedMessage.id, transformedMessage.message_type);
          return [...prev, transformedMessage];
        });
      })
      .subscribe();

    return () => {
      console.log('🔄 Cleaning up real-time subscription...');
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Load initial messages
  useEffect(() => {
    if (user) {
      fetchMessages();
    }
  }, [user, fetchMessages]);

  return {
    messages,
    hasMoreMessages,
    loadingMore,
    totalMessageCount,
    loading,
    error,
    isAstraThinking,
    typingUsers,
    sendMessage,
    fetchMessages,
    loadMoreMessages,
    searchMessages,
    updateVisualizationData,
    setError,
  };
};