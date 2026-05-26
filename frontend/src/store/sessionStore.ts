import { create } from 'zustand';

export interface ResearchSession {
  id: string;
  title: string;
  query: string;
  sources: number;
  findings?: string;
  confidence?: number;
  status: 'active' | 'complete' | 'error';
  type: 'synthesis' | 'analysis' | 'research' | 'translation';
  createdAt: string;
  updatedAt: string;
}

interface SessionState {
  researchSessions: ResearchSession[];
  activeResearchId: string | null;

  setResearchSessions: (sessions: ResearchSession[]) => void;
  addResearchSession: (session: ResearchSession) => void;
  updateResearchSession: (id: string, update: Partial<ResearchSession>) => void;
  setActiveResearch: (id: string | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  researchSessions: [],
  activeResearchId: null,

  setResearchSessions: (researchSessions) => set({ researchSessions }),
  addResearchSession: (session) =>
    set((s) => ({ researchSessions: [session, ...s.researchSessions] })),
  updateResearchSession: (id, update) =>
    set((s) => ({
      researchSessions: s.researchSessions.map((r) =>
        r.id === id ? { ...r, ...update } : r
      ),
    })),
  setActiveResearch: (id) => set({ activeResearchId: id }),
}));
