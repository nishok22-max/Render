import type { ResearchPhase } from '../../services/researchService';

const PHASE_MAP: Record<ResearchPhase, { label: string; color: string; dotColor: string; pulse: boolean }> = {
  idle:         { label: 'Ready',         color: 'text-text-tertiary', dotColor: 'bg-text-tertiary/50', pulse: false },
  initializing: { label: 'Initializing',  color: 'text-amber-400',     dotColor: 'bg-amber-400',        pulse: true  },
  decomposing:  { label: 'Decomposing',   color: 'text-yellow-400',    dotColor: 'bg-yellow-400',       pulse: true  },
  searching:    { label: 'Searching',     color: 'text-blue-400',      dotColor: 'bg-blue-400',         pulse: true  },
  synthesizing: { label: 'Synthesizing',  color: 'text-purple-400',    dotColor: 'bg-purple-400',       pulse: true  },
  streaming:    { label: 'Writing',       color: 'text-text-primary',  dotColor: 'bg-text-primary',     pulse: true  },
  done:         { label: 'Complete',      color: 'text-green-400',     dotColor: 'bg-green-400',        pulse: false },
  error:        { label: 'Error',         color: 'text-red-400',       dotColor: 'bg-red-400',          pulse: false },
};

interface Props {
  phase: ResearchPhase;
  message: string;
  durationMs?: number;
  confidence?: number;
  totalSources?: number;
}

export const ResearchStatusBar = ({ phase, message, durationMs, confidence, totalSources }: Props) => {
  const cfg = PHASE_MAP[phase];
  return (
    <div className="flex items-center gap-4 text-[11px]">
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.pulse ? 'animate-pulse' : ''} ${cfg.dotColor}`} />
        <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
        {message && phase !== 'idle' && (
          <span className="text-text-tertiary/60 truncate max-w-xs">— {message}</span>
        )}
      </div>
      {phase === 'done' && (
        <div className="flex items-center gap-3 ml-auto text-text-tertiary">
          {confidence != null && confidence > 0 && (
            <span className="font-medium">{Math.round(confidence * 100)}% confidence</span>
          )}
          {totalSources != null && totalSources > 0 && (
            <span>{totalSources} sources</span>
          )}
          {durationMs != null && durationMs > 0 && (
            <span>{durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${durationMs}ms`}</span>
          )}
        </div>
      )}
    </div>
  );
};
