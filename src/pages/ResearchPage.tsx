import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Globe, Brain, Zap, StopCircle, Sparkles, Copy, Check, Download, RotateCcw, ArrowRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { exportAsPDF } from '../utils/pdfExport';
import {
  streamResearch, fetchSessions, fetchSession, deleteSession,
  getDynamicSuggestedTopics,
  type ResearchPhase, type AgentEvent, type SubQueryEvent, type ResearchSource, type ResearchSession,
} from '../services/researchService';
import { AgentOrchestrator } from '../components/research/AgentOrchestrator';
import { SourcesPanel } from '../components/research/SourcesPanel';
import { SessionHistory } from '../components/research/SessionHistory';
import { ResearchStatusBar } from '../components/research/ResearchStatusBar';
import { useUIStore } from '../store/uiStore';

const DEPTHS = [
  { value: 2, label: 'Quick',  desc: '~30s',  icon: '⚡' },
  { value: 3, label: 'Deep',   desc: '~60s',  icon: '◈' },
  { value: 5, label: 'Expert', desc: '~2min', icon: '◆' },
];

export const ResearchPage = () => {
  const { addToast } = useUIStore();
  const [query, setQuery]           = useState('');
  const [depth, setDepth]           = useState(3);
  const [phase, setPhase]           = useState<ResearchPhase>('idle');
  const [statusMsg, setStatusMsg]   = useState('');
  const [agents, setAgents]         = useState<AgentEvent[]>([]);
  const [subQueries, setSubQueries] = useState<SubQueryEvent[]>([]);
  const [thoughts, setThoughts]     = useState<string[]>([]);
  const [sources, setSources]       = useState<ResearchSource[]>([]);
  const [report, setReport]         = useState('');
  const [confidence, setConfidence] = useState(0);
  const [totalSources, setTotalSources] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [progress, setProgress]     = useState(0);
  const [copied, setCopied]         = useState(false);
  const [hasResult, setHasResult]   = useState(false);
  const [sessions, setSessions]     = useState<ResearchSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(true);
  const [showOrchestrator, setShowOrchestrator] = useState(true);
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);

  const abortRef  = useRef<(() => void) | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Auto-scroll report
  useEffect(() => {
    if (reportRef.current && phase === 'streaming')
      reportRef.current.scrollTop = reportRef.current.scrollHeight;
  }, [report, phase]);

  // Load sessions and dynamic topics on mount
  useEffect(() => { 
    fetchSessions().then(setSessions); 
    getDynamicSuggestedTopics().then(setSuggestedTopics);
  }, []);

  const reset = () => {
    setReport(''); setSources([]); setSubQueries([]); setAgents([]); setThoughts([]);
    setConfidence(0); setTotalSources(0); setDurationMs(0); setProgress(0);
    setHasResult(false); setActiveSessionId(null);
  };

  const handleResearch = useCallback(async () => {
    if (!query.trim() || (phase !== 'idle' && phase !== 'done' && phase !== 'error')) return;
    reset();
    setPhase('initializing');
    setStatusMsg('Starting research...');
    const depthCfg = DEPTHS.find(d => d.value === depth) ?? DEPTHS[1];
    const sourcesLimit = depthCfg.value <= 2 ? 6 : depthCfg.value >= 5 ? 15 : 10;

    const abort = await streamResearch(query.trim(), depth, sourcesLimit, {
      onSessionId: (id) => setActiveSessionId(id),
      onPhase: (p, msg) => { setPhase(p); setStatusMsg(msg); },
      onAgent: (ev) => { setAgents(prev => [...prev.slice(-9), ev]); setProgress(ev.progress); },
      onThought: (t) => setThoughts(prev => [...prev, t]),
      onSubQuery: (ev) => setSubQueries(prev => {
        const next = [...prev];
        next[ev.index] = ev;
        return next;
      }),
      onSourceFound: (ev) => setSources(prev => {
        if (prev.find(s => s.url === ev.source.url)) return prev;
        return [...prev, ev.source];
      }),
      onToken: (t) => setReport(prev => prev + t),
      onMetadata: (meta) => {
        setSources(meta.sources);
        setSubQueries(meta.sub_queries.map((q, i) => ({ index: i, query: q, status: 'done' as const })));
        setConfidence(meta.confidence);
        setTotalSources(meta.total_sources);
        setDurationMs(meta.duration_ms);
        setHasResult(true);
      },
      onError: (msg) => { setPhase('error'); setStatusMsg(msg); },
      onDone: () => {
        setPhase('done'); setStatusMsg('Research complete'); setHasResult(true);
        fetchSessions()
          .then(setSessions)
          .catch(() => {
            addToast?.({ type: 'warning', title: 'Session Not Saved', message: 'Research complete, but the session could not be saved. Your results are still visible.' });
          });
      },
    });
    abortRef.current = abort;
  }, [query, depth, phase, addToast]);

  const handleStop = () => {
    abortRef.current?.();
    setPhase('done'); setStatusMsg('Stopped'); setHasResult(true);
  };

  const handleCopy = () => {
    const textToCopy = report;
    
    const fallbackCopy = (text: string) => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        addToast?.({ type: 'success', title: 'Copied', message: 'Report copied to clipboard' });
      } catch (err) {
        addToast?.({ type: 'error', title: 'Copy Failed', message: 'Could not copy text' });
      }
      setTimeout(() => setCopied(false), 2000);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        setCopied(true);
        addToast?.({ type: 'success', title: 'Copied', message: 'Report copied to clipboard' });
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => fallbackCopy(textToCopy));
    } else {
      // Must be synchronous for execCommand to work without secure context!
      fallbackCopy(textToCopy);
    }
  };

  const handleSessionSelect = async (id: string) => {
    const full = await fetchSession(id);
    if (!full) return;
    reset();
    setActiveSessionId(id);
    setQuery(full.query);
    setReport(full.report);
    setSources(full.sources);
    setSubQueries(full.sub_queries.map((q, i) => ({ index: i, query: q, status: 'done' as const })));
    setConfidence(full.confidence);
    setTotalSources(full.total_sources);
    setDurationMs(full.duration_ms);
    setHasResult(true);
    setPhase('done');
    setStatusMsg('Session loaded');
  };

  const handleSessionDelete = async (id: string) => {
    await deleteSession(id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) { reset(); setPhase('idle'); }
  };

  const isRunning = !['idle', 'done', 'error'].includes(phase);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-8 pt-8 pb-5 bg-surface">

        {/* Title row */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
              <Globe className="w-4 h-4 text-text-secondary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-text-primary tracking-tight leading-none">Research</h1>
              <p className="text-[10px] text-text-tertiary mt-0.5 tracking-wide">Deep web search & synthesis</p>
            </div>
          </div>

          <div className="flex items-center bg-white/[0.03] p-1 rounded-xl border border-white/[0.06] shadow-inner">
            {/* Panel toggles */}
            <button onClick={() => setShowHistory(p => !p)}
              className={`px-4 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all duration-300 ${
                showHistory 
                  ? 'bg-white/10 text-white shadow-sm' 
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.02]'
              }`}
              title="Toggle history">History</button>
            <button onClick={() => setShowOrchestrator(p => !p)}
              className={`px-4 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all duration-300 ${
                showOrchestrator 
                  ? 'bg-white/10 text-white shadow-sm' 
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.02]'
              }`}
              title="Toggle agent view">Agent</button>
          </div>
        </div>

        {/* Search bar — clean, focused, single row */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleResearch(); } }}
              placeholder="What do you want to research?"
              rows={1}
              className="w-full bg-white/[0.03] border border-white/[0.06] pl-11 pr-4 py-3 text-text-primary text-sm placeholder:text-text-tertiary/60 outline-none focus:border-white/[0.12] focus:bg-white/[0.04] resize-none transition-all font-sans rounded-xl"
            />
          </div>

          {/* Depth pills — inline, minimal */}
          <div className="flex items-center gap-0.5 shrink-0">
            {DEPTHS.map(d => (
              <button key={d.value} onClick={() => setDepth(d.value)}
                className={`px-3.5 py-2 text-xs font-medium transition-all rounded-lg ${
                  depth === d.value
                    ? 'bg-white/[0.1] text-text-primary'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-white/[0.04]'
                }`}>
                {d.label}
              </button>
            ))}
          </div>

          {/* Action button */}
          {isRunning ? (
            <button onClick={handleStop}
              className="shrink-0 px-5 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold flex items-center gap-2 hover:bg-red-500/15 transition-all rounded-xl">
              <StopCircle className="w-4 h-4" /> Stop
            </button>
          ) : (
            <button onClick={handleResearch} disabled={!query.trim()}
              className="shrink-0 px-5 py-2.5 bg-white text-black text-xs font-semibold flex items-center gap-2 hover:bg-white/90 transition-all disabled:opacity-20 disabled:hover:bg-white rounded-xl">
              <Sparkles className="w-4 h-4" /> Research
            </button>
          )}

          {hasResult && !isRunning && (
            <button onClick={() => { reset(); setPhase('idle'); setQuery(''); }}
              className="shrink-0 px-4 py-2.5 text-text-tertiary hover:text-text-secondary text-xs font-medium flex items-center gap-1.5 hover:bg-white/[0.04] transition-all rounded-xl">
              <RotateCcw className="w-3.5 h-3.5" /> New
            </button>
          )}
        </div>

        {/* Status — minimal, inline */}
        <div className="mt-3">
          <ResearchStatusBar phase={phase} message={statusMsg} durationMs={durationMs} confidence={confidence} totalSources={totalSources} />
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden bg-surface border-t border-white/[0.04]">

        {/* History sidebar */}
        <AnimatePresence>
          {showHistory && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 220, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }} className="shrink-0 border-r border-white/[0.04] overflow-hidden">
              <SessionHistory sessions={sessions} activeId={activeSessionId} onSelect={handleSessionSelect} onDelete={handleSessionDelete} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Agent orchestrator */}
        <AnimatePresence>
          {showOrchestrator && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }} className="shrink-0 border-r border-white/[0.04] overflow-hidden">
              <div className="h-full overflow-y-auto no-scrollbar p-5">
                <p className="text-[10px] uppercase tracking-widest font-semibold text-text-secondary mb-4">Agent Orchestration</p>
                {phase === 'idle' && !hasResult ? (
                  <div className="space-y-3">
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-2">Suggested Topics</p>
                    {suggestedTopics.map((t, i) => (
                      <button key={i} onClick={() => setQuery(t)}
                        className="w-full text-left px-3 py-2.5 text-xs text-text-secondary hover:text-text-primary hover:bg-white/[0.04] transition-all flex items-center gap-2 group rounded-lg">
                        <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity text-text-tertiary group-hover:text-text-primary" />
                        <span className="leading-relaxed">{t}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <AgentOrchestrator agents={agents} subQueries={subQueries} thoughts={thoughts} overallProgress={progress} />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main report area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!hasResult && phase === 'idle' ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-12">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-5">
                  <Brain className="w-6 h-6 text-text-secondary" />
                </div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">Start a research session</h2>
                <p className="text-text-tertiary text-sm max-w-sm leading-relaxed">
                  Enter a topic, choose depth, and get a synthesized report with cited sources.
                </p>
              </motion.div>
            </div>
          ) : (
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Report toolbar */}
                <div className="shrink-0 flex items-center justify-between px-8 py-2.5 border-b border-white/[0.04]">
                  <div className="flex items-center gap-3">
                    {isRunning && (
                      <div className="flex items-center gap-2 px-2 py-1 bg-white/[0.04] rounded-md">
                        <Zap className="w-3 h-3 text-text-primary animate-pulse" />
                        <span className="text-[10px] font-semibold text-text-primary uppercase tracking-widest">Live</span>
                      </div>
                    )}
                    {!isRunning && report && (
                      <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">{report.split(' ').length.toLocaleString()} words</span>
                    )}
                  </div>
                  {report && (
                    <div className="flex items-center gap-2">
                      <button onClick={handleCopy}
                        className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold text-text-tertiary hover:text-text-primary transition-colors px-2.5 py-1.5 hover:bg-white/[0.04] rounded-lg">
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                      {report && (
                        <button
                          onClick={() => {
                            try {
                              exportAsPDF({
                                query,
                                report,
                                sources,
                                subQueries: subQueries.map(sq => sq.query),
                                confidence,
                                totalSources,
                                durationMs,
                                depth,
                              });
                              addToast?.({ type: 'success', title: 'PDF Export', message: 'Print dialog opened — choose "Save as PDF" to download' });
                            } catch (err) {
                              addToast?.({ type: 'error', title: 'Export Failed', message: String(err) });
                            }
                          }}
                          className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold text-text-tertiary hover:text-text-primary transition-colors px-2.5 py-1.5 hover:bg-white/[0.04] rounded-lg">
                          <Download className="w-3.5 h-3.5" /> Export PDF
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Report body */}
                <div ref={reportRef} className="flex-1 overflow-y-auto no-scrollbar px-10 py-8">
                  {!report && isRunning && (
                    <div className="flex items-center gap-3 text-text-tertiary mb-6">
                      <div className="flex gap-1.5">
                        {[0, 1, 2].map(i => (
                          <motion.div key={i} className="w-2 h-2 rounded-full bg-white/20"
                            animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
                        ))}
                      </div>
                      <span className="text-xs font-medium">Researching...</span>
                    </div>
                  )}
                  {report && (
                    <div className="prose prose-invert prose-sm max-w-none text-text-secondary leading-relaxed
                      prose-headings:text-text-primary prose-headings:font-sans prose-headings:font-bold
                      prose-strong:text-text-primary prose-code:text-text-primary
                      prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                        components={{
                          h1: ({ children }) => <h1 className="text-3xl font-bold text-text-primary mb-6 mt-10 first:mt-0">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-2xl font-bold text-text-primary mb-4 mt-8">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-xl font-bold text-text-primary mb-3 mt-6">{children}</h3>,
                          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline underline-offset-2 transition-colors">{children}</a>,
                          code: ({ className, children, ...props }) => {
                            const inline = !className;
                            return inline
                              ? <code className="bg-white/10 px-1.5 py-0.5 rounded text-text-primary text-xs font-mono" {...props}>{children}</code>
                              : <code className={className}>{children}</code>;
                          },
                          pre: ({ children }) => <pre className="bg-surface-elevated border border-border p-5 overflow-x-auto my-6 text-sm rounded-xl shadow-sm">{children}</pre>,
                          blockquote: ({ children }) => <blockquote className="border-l-4 border-border pl-5 my-6 text-text-tertiary italic">{children}</blockquote>,
                        }}>
                        {report}
                      </ReactMarkdown>
                      {isRunning && (
                        <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.7, repeat: Infinity }}
                          className="inline-block w-0.5 h-4 bg-text-primary ml-1 align-middle" />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Sources right panel */}
              <div className="w-72 shrink-0 border-l border-white/[0.04] overflow-hidden">
                <SourcesPanel sources={sources} isLive={isRunning} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
