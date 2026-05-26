import { create } from 'zustand';

export interface AgentInfo {
  id: string;
  name: string;
  displayName: string;
  status: 'idle' | 'active' | 'processing' | 'error' | 'sleep';
  lastActive?: string;
  taskCount: number;
  description: string;
}

interface AgentState {
  agents: AgentInfo[];
  setAgents: (agents: AgentInfo[]) => void;
  updateAgent: (id: string, update: Partial<AgentInfo>) => void;
}

const defaultAgents: AgentInfo[] = [
  { id: 'orchestrator', name: 'orchestrator', displayName: 'Orchestrator', status: 'idle', taskCount: 0, description: 'Intelligent task routing and pipeline assembly' },
  { id: 'deep_research', name: 'deep_research', displayName: 'Deep Research', status: 'idle', taskCount: 0, description: 'Autonomous web research and synthesis' },
  { id: 'rag_knowledge', name: 'rag_knowledge', displayName: 'RAG Knowledge', status: 'idle', taskCount: 0, description: 'Semantic retrieval and contextual memory' },
  { id: 'vision', name: 'vision', displayName: 'Vision Analysis', status: 'idle', taskCount: 0, description: 'Image understanding and OCR extraction' },
  { id: 'file_processor', name: 'file_processor', displayName: 'File Processor', status: 'idle', taskCount: 0, description: 'Document parsing and chunking' },
  { id: 'code_intelligence', name: 'code_intelligence', displayName: 'Code Intelligence', status: 'idle', taskCount: 0, description: 'Code analysis and optimization' },
  { id: 'dataset_analysis', name: 'dataset_analysis', displayName: 'Dataset Analysis', status: 'idle', taskCount: 0, description: 'Statistical analysis and insights' },
  { id: 'web_research', name: 'web_research', displayName: 'Web Research', status: 'idle', taskCount: 0, description: 'Real-time web search and source ranking' },
  { id: 'reasoning', name: 'reasoning', displayName: 'Reasoning', status: 'idle', taskCount: 0, description: 'Final synthesis and grounding' },
];

export const useAgentStore = create<AgentState>((set) => ({
  agents: defaultAgents,
  setAgents: (agents) => set({ agents }),
  updateAgent: (id, update) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, ...update } : a)),
    })),
}));
