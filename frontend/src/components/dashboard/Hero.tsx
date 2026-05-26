import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { MessageSquare, FileText } from 'lucide-react';
import { workspaceService, type DashboardStats } from '../../services/workspaceService';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) return;
    let start = 0;
    const step = Math.ceil(value / 40);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(start);
    }, 20);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display.toLocaleString()}</>;
}

export const Hero = ({ stats }: { stats: DashboardStats }) => {
  const statCards = [
    { icon: MessageSquare, label: 'Chat Sessions',   value: stats.total_sessions,  color: 'text-primary' },
    { icon: FileText,      label: 'Documents',        value: stats.total_documents, color: 'text-blue-400' },
  ];

  return (
    <header className="mb-16 max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 mb-6"
      >
        <span className="w-2 h-2 rounded-full bg-accent" />
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Workspace Active</span>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="text-5xl font-medium text-text-primary tracking-tight mb-4"
      >
        {getGreeting()},<br />
        <span className="text-text-secondary">Researcher</span>
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-base text-text-secondary mb-12 max-w-xl leading-relaxed"
      >
        {stats.total_sessions > 0
          ? `You have ${stats.total_sessions} chat session${stats.total_sessions !== 1 ? 's' : ''} and ${stats.total_documents} document${stats.total_documents !== 1 ? 's' : ''} in your knowledge base.`
          : 'Start a chat or upload documents to build your knowledge base.'}
      </motion.p>

      {/* Live Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ icon: Icon, label, value, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i + 0.3 }}
            className="bg-surface border border-border rounded-xl px-5 py-4 flex flex-col gap-1 hover:border-border-hover transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs font-medium text-text-secondary">{label}</span>
            </div>
            <div className="text-3xl font-semibold text-text-primary">
              <AnimatedNumber value={value} />
            </div>
          </motion.div>
        ))}
      </div>
    </header>
  );
};
