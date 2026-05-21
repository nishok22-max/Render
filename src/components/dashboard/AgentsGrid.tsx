import { motion } from 'motion/react';
import { MessageSquare, FileText, Clock, Activity } from 'lucide-react';
import { type Session, type Document, workspaceService } from '../../services/workspaceService';

interface ActivityItem {
  id: string;
  type: 'chat' | 'document';
  title: string;
  time: string;
  status?: string;
}

export const ActivityFeed = ({
  sessions,
  documents,
}: {
  sessions: Session[];
  documents: Document[];
}) => {
  const items: ActivityItem[] = [
    ...sessions.slice(0, 4).map((s) => ({
      id: s.id,
      type: 'chat' as const,
      title: s.title || 'New Chat',
      time: workspaceService.timeAgo(s.updated_at || s.created_at),
    })),
    ...documents.slice(0, 4).map((d) => ({
      id: d.id,
      type: 'document' as const,
      title: d.filename,
      time: workspaceService.timeAgo(d.created_at),
      status: d.status,
    })),
  ]
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, 6);

  return (
    <div className="bg-surface border border-border rounded-xl p-6 flex-1">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="w-4 h-4 text-text-tertiary" />
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Recent Activity</h3>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Clock className="w-6 h-6 text-text-tertiary" />
          <p className="text-sm text-text-secondary">No activity yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.06 * i }}
              className="flex items-center gap-3 py-3 border-b border-border last:border-0 group hover:bg-white/5 transition-colors px-2 rounded-lg -mx-2"
            >
              <div className="w-8 h-8 rounded-full border border-border bg-background flex items-center justify-center shrink-0">
                {item.type === 'chat'
                  ? <MessageSquare className="w-3.5 h-3.5 text-text-tertiary" />
                  : <FileText className="w-3.5 h-3.5 text-text-tertiary" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate transition-colors">
                  {item.title}
                </p>
                {item.status && (
                  <p className={`text-xs mt-0.5 ${item.status === 'parsed' ? 'text-emerald-400' : item.status === 'processing' ? 'text-primary' : 'text-red-400'}`}>
                    {item.status}
                  </p>
                )}
              </div>
              <span className="text-xs text-text-tertiary shrink-0">{item.time}</span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
