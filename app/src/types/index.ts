export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  user_id: string;
  theme: 'system' | 'light' | 'dark';
  accent_color: string; // "h,s%,l%"
  font_family: string;
  layout: 'compact' | 'default' | 'cozy';
  custom_css?: string;
  settings?: Record<string, unknown>;
}

export interface ContactMethod {
  id: string;
  contact_id: string;
  type: 'email' | 'phone' | 'address' | 'social';
  value: string;
  label?: string;
  is_primary: boolean;
}

export interface Contact {
  id: string;
  user_id: string;
  full_name: string;
  nickname?: string;
  organization?: string;
  title?: string;
  date_of_birth?: string | null;
  type: string;
  notes?: string;
  is_self: boolean;
  is_private: boolean;
  groups: string[];
  factoids: string[];
  photo_path?: string;
  created_at: string;
  updated_at: string;
  contact_methods: ContactMethod[];
  interaction_count?: number;
  interactions?: Interaction[];
  important_dates?: ImportantDate[];
}

export interface Interaction {
  id: string;
  contact_id: string;
  user_id: string;
  type: 'meeting' | 'call' | 'email' | 'text' | 'social' | 'other';
  date: string;
  notes?: string;
  created_at: string;
}

export interface ImportantDate {
  id: string;
  contact_id: string;
  user_id: string;
  title: string;
  date: string; // YYYY-MM-DD
  notes?: string;
  last_notified_year?: number;
  contact_name?: string;
  days_until?: number;
}

export interface Reminder {
  id: string;
  contact_id?: string;
  user_id: string;
  title: string;
  notes?: string;
  due_date: string;
  completed: boolean;
  completed_at?: string;
  recurrence_days?: number;
  recurrence_annual?: boolean;
  recurrence_end_date?: string;
  created_at: string;
  contact_name?: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ToolCall {
  tool: string;
  input: unknown;
  output: unknown;
  success: boolean;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: ToolCall[];
  created_at: string;
}

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

// SSE event types from chat endpoint
export type ChatSSEEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_start'; tool: string; id: string }
  | { type: 'tool_end'; tool: string; id: string; result: unknown }
  | { type: 'tool_error'; tool: string; id: string; error: string }
  | { type: 'done'; messageId: string }
  | { type: 'error'; error: string };

export interface ImportContactMethod {
  type: 'email' | 'phone' | 'address' | 'social';
  value: string;
  label?: string;
  is_primary?: boolean;
}

export interface ParsedContact {
  full_name: string;
  nickname?: string;
  organization?: string;
  title?: string;
  date_of_birth?: string | null;
  notes?: string;
  groups?: string[];
  contact_methods: ImportContactMethod[];
}
