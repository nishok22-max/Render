import { ArrowRight, MessageSquare, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../../store/chatStore';
import { chatService } from '../../services/chatService';
import { type Session, workspaceService } from '../../services/workspaceService';
import { ROUTES } from '../../utils/constants';

export const ResearchSessions = ({ sessions }: { sessions: Session[] }) => {
  const navigate = useNavigate();
  const { setActiveSession, setMessages, setLoading } = useChatStore();

  const handleSelectSession = async (session: Session) => {
    setActiveSession(session.id);
    setLoading(true);
    navigate(ROUTES.CHAT);
    try {
      const messages = await chatService.getSessionMessages(session.id);
      setMessages(messages);
    } catch {
      setMessages([]);
    }
    setLoading(false);
  };

  const handleNewChat = () => {
    useChatStore.getState().clearMessages();
    navigate(ROUTES.CHAT);
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-6 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium text-text-primary">Recent Chats</h3>
        <button
          onClick={() => navigate(ROUTES.CHAT)}
          className="text-text-secondary hover:text-text-primary p-2 hover:bg-white/5 rounded-md transition-colors"
          title="Go to Chat"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-12">
          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-text-secondary" />
          </div>
          <p className="text-sm text-text-secondary">No sessions yet</p>
          <button
            onClick={handleNewChat}
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md flex items-center gap-2 hover:bg-white/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Start Chat
          </button>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar -mx-2 px-2">
          {sessions.map((session, i) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.07 * i }}
              onClick={() => handleSelectSession(session)}
              className="min-w-[240px] max-w-[260px] bg-background border border-border rounded-lg p-5 cursor-pointer hover:border-border-hover transition-colors shrink-0"
            >
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-3.5 h-3.5 text-text-tertiary" />
                <span className="text-xs text-text-tertiary font-medium">
                  {((session as any).message_count ?? (session as any).messageCount ?? 0) > 0
                    ? `${(session as any).message_count ?? (session as any).messageCount} messages`
                    : 'Chat'}
                </span>
              </div>
              <h4 className="text-base text-text-primary font-medium mb-2 line-clamp-2">
                {session.title || 'New Chat'}
              </h4>
              <div className="text-xs text-text-tertiary">
                {workspaceService.timeAgo(session.updated_at || session.created_at)}
              </div>
            </motion.div>
          ))}

          {/* New Chat card */}
          <div
            onClick={handleNewChat}
            className="min-w-[160px] border border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:bg-white/5 hover:border-border-hover transition-colors shrink-0"
          >
            <div className="text-center p-6">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-2">
                <Plus className="w-4 h-4 text-text-secondary" />
              </div>
              <p className="text-sm font-medium text-text-secondary">New Chat</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
