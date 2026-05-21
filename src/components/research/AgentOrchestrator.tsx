import { motion, AnimatePresence } from 'motion/react';
import type { AgentEvent, SubQueryEvent } from '../../services/researchService';

const AGENT_META: Record<string, { icon: string; color: string }> = {
  orchestrator: { icon: '⬡', color: 'text-amber-400' },
  decomposer:   { icon: '◈', color: 'text-violet-400' },
  web_research: { icon: '◉', color: 'text-sky-400' },
  web_scraper:  { icon: '◎', color: 'text-cyan-400' },
  reasoning:    { icon: '◆', color: 'text-purple-400' },
  writer:       { icon: '◇', color: 'text-emerald-400' },
};

interface Props {
  agents: AgentEvent[];
  subQueries: SubQueryEvent[];
  thoughts: string[];
  overallProgress: number;
}

export const AgentOrchestrator = ({ agents, subQueries, thoughts, overallProgress }: Props) => {
  const latestAgent = agents[agents.length - 1];
  const latestThought = thoughts[thoughts.length - 1];

  return (
      <div className="space-y-5">
      {/* Progress bar */}
      <div className="relative h-1 bg-surface-elevated overflow-hidden rounded-full border border-border">
        <motion.div
          className="absolute inset-y-0 left-0 bg-text-secondary"
          animate={{ width: `${overallProgress * 100}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      {/* Active agent */}
      {latestAgent && (
        <motion.div
          key={latestAgent.agent + latestAgent.action}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-3 bg-surface border border-border rounded-xl shadow-sm"
        >
          <span className={`text-base ${AGENT_META[latestAgent.agent]?.color ?? 'text-text-secondary'} font-mono`}>
            {AGENT_META[latestAgent.agent]?.icon ?? '○'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">
                {latestAgent.agent}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            </div>
            <p className="text-[11px] font-medium text-text-primary truncate">{latestAgent.action}</p>
            {latestAgent.detail && (
              <p className="text-[10px] text-text-tertiary truncate mt-0.5">{latestAgent.detail}</p>
            )}
          </div>
        </motion.div>
      )}

      {/* AI Thought bubble */}
      <AnimatePresence mode="wait">
        {latestThought && (
          <motion.div
            key={latestThought}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3.5 bg-surface-elevated border border-border rounded-xl shadow-sm">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-text-secondary mb-2">AI Reasoning</p>
              <p className="text-[11px] text-text-tertiary italic leading-relaxed">{latestThought}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sub-queries */}
      {subQueries.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-3">
            Research Threads ({subQueries.filter(s => s.status === 'done').length}/{subQueries.length})
          </p>
          {subQueries.map((sq) => (
            <motion.div
              key={sq.index}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: sq.index * 0.07 }}
              className="flex items-start gap-3 py-2 border-b border-border last:border-0"
            >
              <span className={`mt-0.5 shrink-0 text-[10px] font-mono ${
                sq.status === 'done' ? 'text-green-400' :
                sq.status === 'running' ? 'text-blue-400 animate-pulse' : 'text-text-tertiary'
              }`}>
                {sq.status === 'done' ? '✓' : sq.status === 'running' ? '▸' : '○'}
              </span>
              <span className={`text-[11px] font-medium leading-snug transition-colors ${
                sq.status === 'done' ? 'text-text-secondary' :
                sq.status === 'running' ? 'text-text-primary' : 'text-text-tertiary'
              }`}>{sq.query}</span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
