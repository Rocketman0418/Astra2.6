export interface Message {
  id: string;
  chatId?: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isExpanded?: boolean;
  visualization?: string;
  visualization_data?: string;
  hasStoredVisualization?: boolean;
  isCentered?: boolean;
  isFavorited?: boolean;
export interface ReportMessage {
  id: string;
  chatId: string;
  text: string;
  timestamp: Date;
  isUser: boolean;
  reportMetadata?: {
    report_title?: string;
    report_schedule?: string;
    report_frequency?: string;
    is_manual_run?: boolean;
    executed_at?: string;
    visualization_generating?: boolean;
    visualization_error?: string;
  };
  visualization_data?: string;
  visualization?: boolean;
}

  messageType?: 'user' | 'astra' | 'system';
  isReply?: boolean;
  replyToId?: string;
  metadata?: any;
}

export interface VisualizationState {
  messageId: string;
  isGenerating: boolean;
  content: string | null;
  isVisible: boolean;
}

export interface GroupMessage {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  message_content: string;
  message_type: 'user' | 'astra' | 'system';
  mentions: string[];
  astra_prompt?: string | null;
  visualization_data?: string | null;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface ReplyState {
  isReplying: boolean;
  messageId: string | null;
  messageSnippet: string | null;
  originalMessage?: {
    id: string;
    content: string;
    userName: string;
    timestamp: string;
  } | null;
}

export interface FavoriteMessage {
  id: string;
  text: string;
  createdAt: Date;
}

export type ChatMode = 'reports' | 'private' | 'team';

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
  schedule_day: number | null;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
  template?: ReportTemplate;
}

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

export interface ReportConfig {
  id: string;
  title: string;
  prompt: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  schedule_time: string; // HH:MM format
  start_date?: string; // Day of week for weekly, day of month for monthly
  enabled: boolean;
  created_at: string;
  last_executed?: string;
  next_execution?: string;
}

export interface ReportMessage extends Message {
  reportMetadata?: {
    report_type: string;
    report_title: string;
    report_frequency: string;
    report_schedule: string;
    executed_at: string;
    is_manual_run: boolean;
  };
}