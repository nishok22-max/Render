import { useEffect } from 'react';
import { motion } from 'motion/react';
import { useAgentStore } from '../store/agentStore';
import { agentService } from '../services/agentService';
import { Brain, Code, Globe, Eye, FileText, Database, Search, Lightbulb, Workflow } from 'lucide-react';

const agentIcons: Record<string, typeof Brain> = {
  orchestrator: Workflow, deep_research: Search, rag_knowledge: Brain,
  vision: Eye, file_processor: FileText, code_intelligence: Code,
  dataset_analysis: Database, web_research: Globe, reasoning: Lightbulb,
};

const statusColors: Record<string, string> = {
  idle: 'bg-white/10', active: 'bg-primary', processing: 'bg-primary animate-pulse',
  error: 'bg-red-400', sleep: 'bg-white/5',
};

export const AgentsPage = () => {
  const agents = useAgentStore((s) => s.agents);

  useEffect(() => {
    agentService.fetchAgents();
  }, []);

  return (
    <div className="p-12 lg:p-16 xl:p-20">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 block">Neural Delegates</span>
        <h2 className="text-3xl font-medium text-text-primary tracking-tight mb-4">Agent Fleet</h2>
        <p className="text-text-secondary text-sm max-w-lg mb-12">Monitor and manage the autonomous agent ecosystem. Each agent specializes in a domain and can be orchestrated for complex research tasks.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {agents.map((agent, i) => {
          const Icon = agentIcons[agent.name] || Brain;
          return (
            <motion.div key={agent.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-surface border border-border rounded-xl p-6 cursor-pointer group transition-colors hover:border-border-hover hover:bg-white/5 relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-lg border border-border bg-background flex items-center justify-center group-hover:border-border-hover transition-colors">
                    <Icon className={`w-5 h-5 ${agent.status === 'active' ? 'text-primary' : 'text-text-secondary group-hover:text-text-primary'} transition-colors`} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${statusColors[agent.status]}`} />
                    <span className="text-xs font-medium text-text-secondary capitalize">{agent.status}</span>
                  </div>
                </div>
                <h3 className="text-lg font-medium text-text-primary mb-1 group-hover:text-primary transition-colors">{agent.displayName}</h3>
                <p className="text-sm text-text-secondary leading-relaxed mb-4">{agent.description}</p>
                <div className="flex items-center gap-4 text-xs font-medium text-text-tertiary">
                  <span>{agent.taskCount} tasks</span>
                  {agent.lastActive && <span>Last: {agent.lastActive}</span>}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
