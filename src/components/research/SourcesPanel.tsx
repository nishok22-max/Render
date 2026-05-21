import { motion } from 'motion/react';
import { ExternalLink } from 'lucide-react';
import type { ResearchSource } from '../../services/researchService';

function getFavicon(url: string) {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=16`;
  } catch { return null; }
}

function getDomain(url: string) {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url; }
}

// Group sources by domain
function groupByDomain(sources: ResearchSource[]) {
  const groups: Record<string, ResearchSource[]> = {};
  for (const src of sources) {
    const domain = getDomain(src.url);
    if (!groups[domain]) groups[domain] = [];
    groups[domain].push(src);
  }
  return groups;
}

interface Props {
  sources: ResearchSource[];
  isLive?: boolean;
}

export const SourcesPanel = ({ sources, isLive }: Props) => {
  const groups = groupByDomain(sources);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-text-secondary">Sources</span>
          {sources.length > 0 && (
            <span className="text-[9px] font-bold bg-text-secondary/10 text-text-primary px-1.5 py-0.5 rounded">
              {sources.length}
            </span>
          )}
        </div>
        {isLive && sources.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-[9px] font-semibold text-blue-400/80 uppercase tracking-widest">Live</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-5">
        {sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <div className="w-8 h-8 rounded-xl bg-surface-elevated border border-border flex items-center justify-center mb-3">
              <span className="text-text-tertiary text-xs">◎</span>
            </div>
            <p className="text-[11px] text-text-tertiary font-medium">Sources will appear here</p>
          </div>
        ) : (
          Object.entries(groups).map(([domain, domainSources], gi) => (
            <div key={domain}>
              <div className="flex items-center gap-2 mb-1.5">
                <img
                  src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
                  alt=""
                  className="w-3 h-3 opacity-50"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span className="text-[10px] font-medium text-text-secondary truncate">{domain}</span>
                <span className="text-[9px] font-semibold text-text-tertiary">({domainSources.length})</span>
              </div>
              <div className="space-y-1.5 pl-0">
                {domainSources.map((src, i) => (
                  <motion.a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (gi + i) * 0.04 }}
                    className="flex items-start gap-2 p-2.5 bg-surface border border-border hover:border-text-secondary/50 hover:bg-white/5 transition-all group rounded-xl shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-text-secondary group-hover:text-text-primary leading-snug transition-colors line-clamp-2">
                        {src.title}
                      </p>
                    </div>
                    <ExternalLink className="w-3 h-3 text-text-tertiary group-hover:text-text-primary shrink-0 mt-0.5 transition-colors" />
                  </motion.a>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
