/**
 * Centralized API route definitions.
 *
 * All routes are relative paths appended to API_BASE_URL (which already
 * includes the `/api` prefix). Never add `/api` here — it lives in the
 * base URL configured via VITE_API_URL.
 *
 * Usage (axios instance):  api.get(API_ROUTES.SESSIONS)
 * Usage (fetch / SSE):     fetch(`${API_BASE_URL}${API_ROUTES.CHAT}`, ...)
 */
export const API_ROUTES = {
  // ── Chat ──────────────────────────────────────────────────────
  CHAT: '/chat',

  // ── Sessions ──────────────────────────────────────────────────
  SESSIONS: '/sessions',
  SESSION: (id: string) => `/sessions/${id}`,
  SESSION_MESSAGES: (id: string) => `/sessions/${id}/messages`,
  SESSION_GENERATE_TITLE: (id: string) => `/sessions/${id}/generate-title`,

  // ── Documents ─────────────────────────────────────────────────
  DOCUMENTS: '/documents',
  DOCUMENT: (id: string) => `/documents/${id}`,
  DOCUMENT_RETRY: (id: string) => `/documents/${id}/retry`,

  // ── Upload ────────────────────────────────────────────────────
  UPLOAD: '/upload',

  // ── Research ──────────────────────────────────────────────────
  RESEARCH: '/research',
  RESEARCH_SESSIONS: '/research/sessions',
  RESEARCH_SESSION: (id: string) => `/research/sessions/${id}`,
  RESEARCH_SESSION_EXPORT: (id: string, fmt: string) =>
    `/research/sessions/${id}/export?fmt=${fmt}`,

  // ── RAG Agent ─────────────────────────────────────────────────
  RAG_UPLOAD: '/rag/upload',
  RAG_QUERY: '/rag/query',
  RAG_DOCUMENTS: '/rag/documents',
  RAG_DOCUMENT: (id: string) => `/rag/documents/${id}`,
  RAG_STATS: '/rag/stats',
  RAG_SUGGESTIONS: '/rag/suggestions',

  // ── Analytics ─────────────────────────────────────────────────
  ANALYTICS_DASHBOARD: '/analytics/dashboard',

  // ── Agents ────────────────────────────────────────────────────
  AGENTS: '/agents',
} as const;
