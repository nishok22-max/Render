import { motion } from 'motion/react';
import { type DashboardStats } from '../../services/workspaceService';
import { TrendingUp } from 'lucide-react';

export const StatsWidget = ({ stats }: { stats: DashboardStats }) => {
  const parseRate = stats.total_documents > 0
    ? Math.round((stats.parsed_documents / stats.total_documents) * 100)
    : 0;

  const kbFill = stats.total_vectors > 0 ? Math.min(100, (stats.total_vectors / 500) * 100) : 0;

  return (
    <div className="bg-surface border border-border rounded-xl p-6 relative overflow-hidden h-full flex flex-col justify-center">
      <div className="flex items-center gap-2 mb-8">
        <TrendingUp className="w-4 h-4 text-text-tertiary" />
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Knowledge Load</h3>
      </div>

      <div className="mb-10 relative z-10">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-5xl font-semibold text-text-primary tracking-tight mb-2"
        >
          {stats.total_vectors.toLocaleString()}
        </motion.div>
        <div className="text-xs text-text-tertiary">Total Knowledge Vectors</div>
      </div>

      <div className="space-y-7 relative z-10">
        {/* Parse rate */}
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-text-secondary">Document Parse Rate</span>
            <span className="text-text-primary font-medium">{parseRate}%</span>
          </div>
          <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${parseRate}%` }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              className="h-full bg-primary"
            />
          </div>
          <div className="flex justify-between text-xs text-text-tertiary mt-2">
            <span>{stats.parsed_documents} parsed</span>
            <span>{stats.total_documents} total</span>
          </div>
        </div>

        {/* KB fill */}
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-text-secondary">Vector Index Fill</span>
            <span className="text-text-primary font-medium">{Math.round(kbFill)}%</span>
          </div>
          <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${kbFill}%` }}
              transition={{ duration: 2, ease: 'easeOut', delay: 0.3 }}
              className="h-full bg-primary"
            />
          </div>
        </div>

        <div className="pt-5 border-t border-border mt-5">
          <div className="flex justify-between items-center">
            <span className="text-xs text-text-secondary">Chat Sessions</span>
            <span className="text-xl font-medium text-text-primary">{stats.total_sessions}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
