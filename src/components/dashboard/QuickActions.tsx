import { MessageSquare, Brain, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../../store/chatStore';
import { ROUTES } from '../../utils/constants';

const actions = [
  {
    icon: Plus,
    title: 'New Chat',
    description: 'Start a fresh AI conversation',
    route: ROUTES.CHAT,
    accent: 'group-hover:text-primary',
    clearChat: true,
  },
  {
    icon: Brain,
    title: 'RAG Agent',
    description: 'Query your uploaded documents',
    route: ROUTES.RAG_AGENT,
    accent: 'group-hover:text-purple-400',
  },
  {
    icon: MessageSquare,
    title: 'Research',
    description: 'Deep web research & analysis',
    route: ROUTES.RESEARCH,
    accent: 'group-hover:text-blue-400',
  },
];

export const QuickActions = () => {
  const navigate = useNavigate();
  const clearMessages = useChatStore((s) => s.clearMessages);

  const handleAction = (action: typeof actions[0]) => {
    if (action.clearChat) clearMessages();
    navigate(action.route);
  };

  return (
    <section className="mb-12">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4 px-1">Quick Actions</h3>
      <div className="flex flex-col md:flex-row gap-4">
        {actions.map((action, i) => (
          <motion.button
            key={i}
            onClick={() => handleAction(action)}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.08 * i }}
            className="flex-1 p-6 flex flex-col items-start gap-4 text-left bg-surface border border-border rounded-xl hover:border-border-hover hover:bg-white/5 transition-all duration-300 group"
          >
            <div className="h-12 w-12 rounded-lg border border-border flex items-center justify-center text-text-secondary group-hover:text-text-primary group-hover:border-border-hover transition-colors">
              <action.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-medium text-text-primary mb-1">
                {action.title}
              </div>
              <div className="text-sm text-text-secondary">
                {action.description}
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </section>
  );
};
