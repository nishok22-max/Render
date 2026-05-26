import { API_BASE_URL } from '../utils/constants';
import { API_ROUTES } from './apiRoutes';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ResearchSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface ResearchResult {
  report: string;
  sources: ResearchSource[];
  sub_queries: string[];
  confidence: number;
  total_sources: number;
  query: string;
  depth: number;
  duration_ms: number;
}

export type ResearchPhase =
  | 'idle'
  | 'initializing'
  | 'decomposing'
  | 'searching'
  | 'synthesizing'
  | 'streaming'
  | 'done'
  | 'error';

export interface AgentEvent {
  agent: string;
  action: string;
  detail: string;
  progress: number;
}

export interface SubQueryEvent {
  index: number;
  query: string;
  status: 'pending' | 'running' | 'done';
}

export interface SourceFoundEvent {
  source: ResearchSource;
  subquery_index: number;
}

export interface ResearchSession {
  id: string;
  query: string;
  confidence: number;
  total_sources: number;
  depth: number;
  duration_ms: number;
  created_at: number;
  status: 'complete' | 'running' | 'error';
}

export interface ResearchSessionFull extends ResearchSession {
  report: string;
  sources: ResearchSource[];
  sub_queries: string[];
}

// ── Callbacks ──────────────────────────────────────────────────────────────────

export interface ResearchCallbacks {
  onSessionId: (id: string) => void;
  onPhase: (phase: ResearchPhase, message: string) => void;
  onAgent: (event: AgentEvent) => void;
  onThought: (content: string) => void;
  onSubQuery: (event: SubQueryEvent) => void;
  onSourceFound: (event: SourceFoundEvent) => void;
  onToken: (token: string) => void;
  onMetadata: (result: Omit<ResearchResult, 'report'>) => void;
  onError: (msg: string) => void;
  onDone: () => void;
}

// ── Stream ────────────────────────────────────────────────────────────────────

export async function streamResearch(
  query: string,
  depth: number,
  sourcesLimit: number,
  callbacks: ResearchCallbacks,
): Promise<() => void> {
  const controller = new AbortController();

  let resp: Response;
  try {
    resp = await fetch(`${API_BASE_URL}${API_ROUTES.RESEARCH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, depth, sources_limit: sourcesLimit }),
      signal: controller.signal,
    });
  } catch (err: any) {
    callbacks.onError(err.message || 'Network error');
    return () => {};
  }

  if (!resp.ok) {
    callbacks.onError('Research request failed. Please try again.');
    return () => {};
  }

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();

  (async () => {
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // keep incomplete last line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') { callbacks.onDone(); return; }
          try {
            const ev = JSON.parse(raw);
            switch (ev.type) {
              case 'session_id':
                callbacks.onSessionId(ev.session_id);
                break;
              case 'status':
                mapPhase(ev.phase || ev.message, ev.message, callbacks.onPhase);
                break;
              case 'agent':
                callbacks.onAgent({ agent: ev.agent, action: ev.action, detail: ev.detail || '', progress: ev.progress || 0 });
                break;
              case 'thought':
                callbacks.onThought(ev.content || '');
                break;
              case 'subquery':
                callbacks.onSubQuery({ index: ev.index, query: ev.query, status: ev.status || 'pending' });
                break;
              case 'source_found':
                callbacks.onSourceFound({ source: ev.source, subquery_index: ev.subquery_index || 0 });
                break;
              case 'report_start':
                callbacks.onPhase('streaming', 'Writing research report...');
                break;
              case 'token':
                callbacks.onToken(ev.content || '');
                break;
              case 'metadata':
                callbacks.onMetadata({
                  sources: ev.sources || [],
                  sub_queries: ev.sub_queries || [],
                  confidence: ev.confidence || 0,
                  total_sources: ev.total_sources || 0,
                  query,
                  depth: ev.depth || depth,
                  duration_ms: ev.duration_ms || 0,
                });
                break;
              case 'error':
                callbacks.onError(ev.message || 'Research failed');
                break;
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') callbacks.onError(err.message || 'Stream error');
    }
  })();

  return () => controller.abort();
}

function mapPhase(phase: string, message: string, cb: ResearchCallbacks['onPhase']) {
  if (phase === 'initializing') cb('initializing', message);
  else if (phase === 'decomposing') cb('decomposing', message);
  else if (phase === 'searching') cb('searching', message);
  else if (phase === 'synthesizing') cb('synthesizing', message);
  else if (phase === 'done') cb('done', message);
  else cb('searching', message);
}

// ── Session API ───────────────────────────────────────────────────────────────

export async function fetchSessions(): Promise<ResearchSession[]> {
  try {
    const r = await fetch(`${API_BASE_URL}${API_ROUTES.RESEARCH_SESSIONS}`);
    if (!r.ok) return [];
    const data = await r.json();
    return data.sessions || [];
  } catch { return []; }
}

export async function fetchSession(id: string): Promise<ResearchSessionFull | null> {
  try {
    const r = await fetch(`${API_BASE_URL}${API_ROUTES.RESEARCH_SESSION(id)}`);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

export async function deleteSession(id: string): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE_URL}${API_ROUTES.RESEARCH_SESSION(id)}`, { method: 'DELETE' });
    return r.ok;
  } catch { return false; }
}

export function exportSessionUrl(id: string, fmt: 'markdown' | 'json' = 'markdown') {
  return `${API_BASE_URL}${API_ROUTES.RESEARCH_SESSION_EXPORT(id, fmt)}`;
}

// ── Suggested topics ──────────────────────────────────────────────────────────

export const FALLBACK_TOPICS = [
  'Latest advances in quantum computing',
  'How does CRISPR gene editing work?',
  'The future of large language models',
  'Climate change mitigation technologies',
  'Autonomous vehicle safety challenges',
  'Neuromorphic computing architectures',
  'The economics of degrowth movements',
  'Post-AGI governance frameworks',
];

// State interfaces for topic tracking
interface TopicState {
  impressions: Record<string, number>;
  cooldowns: Record<string, number>;
}

export async function getDynamicSuggestedTopics(): Promise<string[]> {
  const MAX_IMPRESSIONS = 2;
  const COOLDOWN_REFRESHES = 10;
  const RETURN_COUNT = 8;
  const STATE_KEY = 'thinksync_topic_state';

  // Load state
  let state: TopicState = { impressions: {}, cooldowns: {} };
  try {
    const saved = localStorage.getItem(STATE_KEY);
    if (saved) state = JSON.parse(saved);
  } catch { /* ignore */ }

  // Decrement cooldowns for this refresh
  for (const topic in state.cooldowns) {
    state.cooldowns[topic]--;
    if (state.cooldowns[topic] <= 0) {
      delete state.cooldowns[topic];
    }
  }

  let candidates: string[] = [];

  try {
    // Fetch dynamic tech/science news via RSS-to-JSON
    const res = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://hnrss.org/frontpage?points=50');
    if (res.ok) {
      const data = await res.json();
      candidates = (data.items || []).map((i: any) => i.title);
    }
  } catch {
    // Silent fail, use fallback
  }

  // If fetch failed or returned empty, use fallback pool
  if (candidates.length === 0) {
    candidates = [...FALLBACK_TOPICS];
  }

  // Filter out topics currently in cooldown
  let available = candidates.filter(t => !state.cooldowns[t]);

  // If somehow all are in cooldown (unlikely, but possible), reset cooldowns
  if (available.length < RETURN_COUNT && candidates.length >= RETURN_COUNT) {
    state.cooldowns = {};
    available = [...candidates];
  }

  // Shuffle available topics to ensure variety
  available.sort(() => Math.random() - 0.5);

  // Pick top N
  const selected = available.slice(0, RETURN_COUNT);

  // Update impressions for selected topics
  for (const topic of selected) {
    state.impressions[topic] = (state.impressions[topic] || 0) + 1;
    
    if (state.impressions[topic] >= MAX_IMPRESSIONS) {
      // Put in cooldown and reset impressions
      state.cooldowns[topic] = COOLDOWN_REFRESHES;
      delete state.impressions[topic];
    }
  }

  // Save state
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }

  // Pad with fallbacks if we didn't get enough topics
  if (selected.length < RETURN_COUNT) {
    const fallbacks = FALLBACK_TOPICS.filter(t => !selected.includes(t));
    selected.push(...fallbacks.slice(0, RETURN_COUNT - selected.length));
  }

  return selected;
}
