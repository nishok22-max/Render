import { motion } from 'motion/react';

export const AnalyticsPage = () => {
  const stats = [
    { label: 'Total Vectors', value: '24.8M', change: '+12%' },
    { label: 'Documents Processed', value: '1,247', change: '+8%' },
    { label: 'Research Sessions', value: '89', change: '+23%' },
    { label: 'Avg Response Time', value: '1.2s', change: '-15%' },
  ];

  return (
    <div className="p-12 lg:p-16 xl:p-20">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 block">System Analytics</span>
        <h2 className="text-3xl font-medium text-text-primary tracking-tight mb-12">Performance Metrics</h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-12">
        {stats.map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="bg-surface border border-border rounded-xl p-6">
            <span className="text-xs font-medium text-text-secondary mb-3 block">{stat.label}</span>
            <div className="text-3xl font-semibold text-text-primary mb-2">{stat.value}</div>
            <span className={`text-xs ${stat.change.startsWith('+') ? 'text-emerald-400' : 'text-primary'}`}>{stat.change} this week</span>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-xl p-6">
          <span className="text-sm font-medium text-text-primary mb-6 block">Agent Activity Timeline</span>
          <div className="space-y-4">
            {['Orchestrator routed 12 tasks', 'RAG Agent indexed 3 documents', 'Vision Agent analyzed 5 images', 'Deep Research completed 2 sessions'].map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-text-secondary text-sm">{item}</span>
                <span className="text-text-tertiary text-xs ml-auto">{i + 1}h ago</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-6">
          <span className="text-sm font-medium text-text-primary mb-6 block">Vector Database Health</span>
          <div className="space-y-6">
            {[{ label: 'Storage Used', value: '67%' }, { label: 'Index Health', value: '99%' }, { label: 'Query Cache Hit', value: '84%' }].map((item, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-text-secondary">{item.label}</span>
                  <span className="text-text-primary font-medium">{item.value}</span>
                </div>
                <div className="h-1.5 bg-background rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: item.value }} transition={{ duration: 1.5, delay: i * 0.3 }}
                    className="h-full bg-primary" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
