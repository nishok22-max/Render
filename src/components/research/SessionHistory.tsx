import { motion } from 'motion/react';
import { Trash2, Clock, BarChart2, ExternalLink } from 'lucide-react';
import type { ResearchSession } from '../../services/researchService';

interface Props {
  sessions: ResearchSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatAge(ts: number | string): string {
  const date = new Date(ts);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (Number.isNaN(mins) || mins < 0) return 'just now';
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export const SessionHistory = ({ sessions, activeId, onSelect, onDelete }: Props) => (
  <div className="h-full flex flex-col">
    <div className="px-5 py-4 border-b border-border shrink-0">
      <span className="text-[10px] uppercase tracking-widest font-semibold text-text-secondary">History</span>
    </div>
    <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2">
      {sessions.length === 0 ? (
        <div className="px-2 py-8 text-center">
          <p className="text-[11px] text-text-tertiary font-medium">No sessions yet</p>
        </div>
      ) : (
        sessions.map((s) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className={`group relative p-3.5 rounded-xl border cursor-pointer transition-all shadow-sm ${
              activeId === s.id
                ? 'bg-surface border-text-secondary/40'
                : 'bg-surface-elevated border-border hover:bg-white/5 hover:border-text-secondary/50'
            }`}
            onClick={() => onSelect(s.id)}
          >
            <p className={`text-[11px] leading-snug line-clamp-2 mb-3 font-medium transition-colors ${
              activeId === s.id ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'
            }`}>
              {s.query}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[9px] font-semibold text-text-tertiary">
                <Clock className="w-3 h-3" />
                {formatAge(s.created_at)}
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-semibold text-text-tertiary">
                <BarChart2 className="w-3 h-3" />
                {s.total_sources}
              </div>
              <div className="ml-auto text-[10px] font-bold text-blue-400">
                {Math.round(s.confidence * 100)}%
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all p-1.5 hover:text-red-400 text-text-tertiary hover:bg-white/5 rounded"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))
      )}
    </div>
  </div>
);
