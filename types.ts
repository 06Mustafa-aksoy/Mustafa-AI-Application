export interface Attachment {
  name: string;
  mimeType: string;
  data: string; // Base64 encoded string (raw data, no data URI prefix)
}

export type AgentSpecialty = 'general' | 'research' | 'coder' | 'analyst';

export interface AgentStep {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed';
  detail?: string;
}

export interface MemoryItem {
  id: string;
  key: string;
  value: string;
  category: 'user_preference' | 'personal_fact' | 'work_context' | 'instruction';
  createdAt: number;
  updatedAt: number;
  isPinned?: boolean;
}

export interface GroundingSource {
  title: string;
  url: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  attachments?: Attachment[];
  timestamp: number;
  isError?: boolean;
  isAgent?: boolean;
  agentSpecialty?: AgentSpecialty;
  agentSteps?: AgentStep[];
  groundingSources?: GroundingSource[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  isAgentSession?: boolean;
  agentSpecialty?: AgentSpecialty;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  thinkingBudget: number;
  isAgentMode: boolean;
  agentSpecialty: AgentSpecialty;
}

export interface GeminiConfig {
  thinkingBudget: number;
  isAgentMode?: boolean;
  agentSpecialty?: AgentSpecialty;
  memories?: MemoryItem[];
  signal?: AbortSignal;
  customApiKey?: string;
}
