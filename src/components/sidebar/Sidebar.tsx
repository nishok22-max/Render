import { useState, useRef, useEffect } from 'react';
import { LucideIcon, LayoutDashboard, LibraryBig, Cpu, MessageSquare, Brain, HelpCircle, User, Plus, ChevronLeft, Trash2, Pencil, Check, X, MessageCircle, Upload, BarChart3, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore';
import { useChatStore, type ChatSession } from '../../store/chatStore';
import { chatService } from '../../services/chatService';
import { ROUTES } from '../../utils/constants';

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  path: string;
  active?: boolean;
  onClick?: () => void;
}

const NavItem = ({ icon: Icon, label, path, active, onClick }: NavItemProps) => {
  const navigate = useNavigate();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);

  const handleClick = () => {
    if (onClick) onClick();
    navigate(path);
  };

  return (
    <motion.button
      onClick={handleClick}
      whileHover={{ x: collapsed ? 0 : 6, opacity: 1 }}
      className={`flex items-center gap-4 py-2.5 px-2 font-sans transition-all duration-500 overflow-hidden w-full text-left ${
        active
          ? 'text-primary opacity-100 font-semibold'
          : 'text-white opacity-40 hover:opacity-100'
      }`}
    >
      <div className={`relative shrink-0 ${active ? 'animate-pulse-soft' : ''}`}>
        <Icon className={`w-4 h-4 ${active ? 'fill-primary/20' : ''}`} />
      </div>
      {!collapsed && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[11px] uppercase tracking-[0.2em] whitespace-nowrap"
        >
          {label}
        </motion.span>
      )}
      {active && !collapsed && (
        <motion.div
          layoutId="active-nav"
          className="w-1 h-3 bg-primary rounded-full ml-auto shrink-0"
        />
      )}
    </motion.button>
  );
};

// â”€â”€â”€ Session Item (Conversation history entry) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SessionItem = ({
  session,
  isActive,
  collapsed,
  onSelect,
  onDelete,
  onRename,
}: {
  session: ChatSession;
  isActive: boolean;
  collapsed: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleConfirmRename = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== session.title) {
      onRename(trimmed);
    }
    setEditing(false);
  };

  if (collapsed) {
    return (
      <button
        onClick={onSelect}
        title={session.title}
        className={`w-full flex items-center justify-center py-2 transition-all ${
          isActive ? 'text-primary' : 'text-white/25 hover:text-white/60'
        }`}
      >
        <MessageCircle className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer transition-all duration-200 ${
        isActive
          ? 'bg-primary/10 text-white/90 border-l-2 border-primary'
          : 'text-white/35 hover:text-white/70 hover:bg-white/[0.03] border-l-2 border-transparent'
      }`}
    >
      {editing ? (
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <input
            ref={inputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmRename();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="flex-1 bg-white/5 border border-white/10 px-1.5 py-0.5 text-[11px] text-white/80 outline-none focus:border-primary/40 min-w-0"
          />
          <button onClick={handleConfirmRename} className="text-green-400 hover:text-green-300 shrink-0">
            <Check className="w-3 h-3" />
          </button>
          <button onClick={() => setEditing(false)} className="text-white/30 hover:text-white/60 shrink-0">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <>
          <button onClick={onSelect} className="flex-1 text-left min-w-0">
            <span className="block text-[11px] truncate leading-tight">
              {session.title}
            </span>
          </button>
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-0.5 shrink-0"
              >
                <button
                  onClick={(e) => { e.stopPropagation(); setEditTitle(session.title); setEditing(true); }}
                  className="p-0.5 text-white/20 hover:text-primary transition-colors"
                  title="Rename"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="p-0.5 text-white/20 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

// â”€â”€â”€ Main Sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const {
    sessions, activeSessionId,
    clearMessages, setActiveSession, setMessages,
    removeSession, updateSessionTitle, setLoading,
  } = useChatStore();

  const handleNewChat = () => {
    clearMessages();
    navigate(ROUTES.CHAT);
  };

  const handleSelectSession = async (session: ChatSession) => {
    if (activeSessionId === session.id) return;
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

  const handleDeleteSession = async (sessionId: string) => {
    removeSession(sessionId);
    chatService.deleteSession(sessionId);
  };

  const handleRenameSession = async (sessionId: string, title: string) => {
    updateSessionTitle(sessionId, title);
    chatService.updateSession(sessionId, title);
  };

  const chatSessions = sessions.filter((s) => s.type === 'chat');

  return (
    <motion.nav
      animate={{ width: sidebarCollapsed ? 72 : 256 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="h-screen fixed left-0 top-0 bg-background border-r border-white/5 flex flex-col p-4 z-50 overflow-hidden"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10 px-1 pt-2">
        <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
          <Brain className="w-5 h-5 text-text-primary" />
        </div>
        {!sidebarCollapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h1 className="font-sans text-xl font-bold text-text-primary tracking-tight">
              ThinkSync <span className="text-text-secondary font-medium">OS</span>
            </h1>
            <p className="text-[10px] text-text-tertiary uppercase tracking-widest font-medium mt-0.5">Quantum Core</p>
          </motion.div>
        )}
      </div>

      {/* New Chat Button */}
      <button
        onClick={handleNewChat}
        className={`mb-6 w-full py-3.5 bg-primary text-background font-sans text-sm font-medium flex items-center justify-center gap-2 hover:bg-white transition-all duration-500 shadow-2xl active:scale-95 group ${
          sidebarCollapsed ? 'px-0' : 'px-4'
        }`}
      >
        <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500 shrink-0" />
        {!sidebarCollapsed && 'New Chat'}
      </button>

      {/* Main Navigation */}
      <div className="flex flex-col gap-1">
        <NavItem icon={LayoutDashboard} label="Workspace" path={ROUTES.DASHBOARD} active={location.pathname === ROUTES.DASHBOARD} />
        <NavItem icon={MessageSquare} label="AI Chat" path={ROUTES.CHAT} active={location.pathname === ROUTES.CHAT} />
        <NavItem icon={LibraryBig} label="Research" path={ROUTES.RESEARCH} active={location.pathname === ROUTES.RESEARCH} />
        <NavItem icon={Brain} label="RAG Agent" path={ROUTES.RAG_AGENT} active={location.pathname === ROUTES.RAG_AGENT} />
      </div>

      {/* â”€â”€ Conversation History â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {chatSessions.length > 0 && (
        <div className="mt-6 flex-1 flex flex-col min-h-0">
          {!sidebarCollapsed && (
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[9px] uppercase tracking-[0.2em] text-white/20 font-mono">Recent Chats</span>
              <span className="text-[9px] text-white/15">{chatSessions.length}</span>
            </div>
          )}
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-0.5 pr-1">
            {chatSessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={activeSessionId === session.id}
                collapsed={sidebarCollapsed}
                onSelect={() => handleSelectSession(session)}
                onDelete={() => handleDeleteSession(session.id)}
                onRename={(title) => handleRenameSession(session.id, title)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bottom Items */}
      <div className="mt-auto flex flex-col gap-1 border-t border-white/5 pt-4">

        {/* Collapse Toggle */}
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center py-2 mt-2 text-white/20 hover:text-primary transition-all"
        >
          <motion.div animate={{ rotate: sidebarCollapsed ? 180 : 0 }}>
            <ChevronLeft className="w-4 h-4" />
          </motion.div>
        </button>
      </div>
    </motion.nav>
  );
};
