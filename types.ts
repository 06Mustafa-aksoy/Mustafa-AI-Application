export interface Attachment {
  name: string;
  mimeType: string;
  data: string; // Base64 encoded string (raw data, no data URI prefix)
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  attachments?: Attachment[];
  timestamp: number;
  isError?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  thinkingBudget: number;
}

export interface GeminiConfig {
  thinkingBudget: number;
}