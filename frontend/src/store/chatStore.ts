import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  reasoningSteps?: ReasoningStep[];
  agentActivity?: AgentActivity[];
  attachments?: Attachment[];
  timestamp: string;
  isStreaming?: boolean;
}

export interface Citation {
  title: string;
  url?: string;
  snippet: string;
  relevance: number;
}

export interface ReasoningStep {
  agent: string;
  action: string;
  result?: string;
  duration?: number;
  status: 'pending' | 'running' | 'complete' | 'error';
}

export interface AgentActivity {
  name: string;
  status: 'idle' | 'active' | 'complete';
  message?: string;
}

export interface Attachment {
  id: string;
  filename: string;
  fileType: string;
  size: number;
  url?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  type: 'chat' | 'research' | 'analysis';
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  messages: Message[];
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  // ── Orchestrator routing state ────────────────────────────────
  activeAgent: string | null;        // e.g. "deep_research"
  agentPipeline: string[];           // e.g. ["web_research", "rag_knowledge", "deep_research"]
  agentInputType: string | null;     // e.g. "research_query"

  setActiveSession: (id: string | null) => void;
  addSession: (session: ChatSession) => void;
  setSessions: (sessions: ChatSession[]) => void;
  updateSessionTitle: (id: string, title: string) => void;
  removeSession: (id: string) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, update: Partial<Message>) => void;
  appendToMessage: (id: string, content: string) => void;
  setMessages: (messages: Message[]) => void;
  setStreaming: (streaming: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
  setAgentStatus: (agent: string | null, pipeline: string[], inputType: string | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  sessions: [],
  activeSessionId: null,
  messages: [],
  isStreaming: false,
  isLoading: false,
  error: null,
  activeAgent: null,
  agentPipeline: [],
  agentInputType: null,

  setActiveSession: (id) => set({ activeSessionId: id }),
  addSession: (session) => set((s) => ({ sessions: [session, ...s.sessions] })),
  setSessions: (sessions) => set({ sessions }),

  updateSessionTitle: (id, title) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, title, updatedAt: new Date().toISOString() } : sess,
      ),
    })),

  removeSession: (id) =>
    set((s) => ({
      sessions: s.sessions.filter((sess) => sess.id !== id),
      // If we're deleting the active session, clear everything
      ...(s.activeSessionId === id
        ? { activeSessionId: null, messages: [] }
        : {}),
    })),

  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),

  updateMessage: (id, update) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...update } : m)),
    })),

  appendToMessage: (id, content) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + content } : m
      ),
    })),

  setMessages: (messages) => set({ messages }),
  setStreaming: (isStreaming) => set({ isStreaming }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearMessages: () => set({ messages: [], activeSessionId: null }),
  setAgentStatus: (agent, pipeline, inputType) =>
    set({ activeAgent: agent, agentPipeline: pipeline, agentInputType: inputType }),
}));
