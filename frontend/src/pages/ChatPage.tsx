import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Paperclip, Image as ImageIcon, Code2, Sparkles, StopCircle, Bot, User as UserIcon, Copy, Check, X, FileText, Loader2, Cpu, Globe, Brain, Eye, Workflow, PanelLeftOpen, PanelLeftClose, Plus, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { useChatStore, type Message } from '../store/chatStore';
import { useUploadStore } from '../store/uploadStore';
import { useUIStore } from '../store/uiStore';
import { chatService } from '../services/chatService';
import { LoadingDots } from '../components/shared/LoadingPulse';
import { GlassPanel } from '../components/shared/GlassPanel';

const AGENT_META: Record<string, { label: string; icon: typeof Cpu; color: string }> = {
  deep_research:    { label: 'Researching',       icon: Globe,     color: 'text-blue-400' },
  rag_knowledge:    { label: 'Searching Files',    icon: Brain,     color: 'text-purple-400' },
  vision:           { label: 'Analyzing Image',    icon: Eye,       color: 'text-emerald-400' },
  code_intelligence:{ label: 'Reviewing Code',     icon: Cpu,       color: 'text-yellow-400' },
  file_processor:   { label: 'Processing File',    icon: FileText,  color: 'text-orange-400' },
  orchestrator:     { label: 'Thinking',           icon: Workflow,  color: 'text-primary' },
  general_chat:     { label: 'ThinkSync',           icon: Bot,       color: 'text-primary' },
};

// â”€â”€â”€ Extract plain text from React children (for copy button) â”€â”€â”€
function extractTextContent(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractTextContent).join('');
  if (typeof node === 'object' && 'props' in node) {
    return extractTextContent((node as any).props?.children);
  }
  return '';
}

// â”€â”€â”€ Code Block with Copy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// children are React elements from rehype-highlight (spans with syntax classes)
// We render them directly for syntax highlighting, and extract text only for copy.
const CodeBlock = ({ children, className }: { children: ReactNode; className?: string }) => {
  const [copied, setCopied] = useState(false);
  const language = className?.replace(/language-/g, '').replace(/hljs\s*/g, '').trim() || '';

  const handleCopy = () => {
    const text = extractTextContent(children).replace(/\n$/, '');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4 bg-black/40 border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface-elevated">
        <span className="text-[10px] uppercase tracking-widest text-text-tertiary font-semibold">{language}</span>
        <button onClick={handleCopy} className="text-text-tertiary hover:text-text-primary transition-colors">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto bg-[#0a0a0a]">
        <code className={`${className || ''} text-[13px] font-mono leading-relaxed`}>{children}</code>
      </pre>
    </div>
  );
};

// â”€â”€â”€ Message Bubble â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MessageBubble = ({ message }: { message: Message }) => {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'} mb-6`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-surface-elevated border border-border flex items-center justify-center shrink-0 mt-1 shadow-sm">
          <Bot className="w-4 h-4 text-text-primary" />
        </div>
      )}

      <div className={`max-w-[75%] ${isUser ? 'order-first' : ''}`}>
        {isUser ? (
          <div className="bg-surface-elevated border border-border px-5 py-3.5 rounded-3xl text-text-primary text-[15px] leading-relaxed shadow-sm">
            {/* Show inline image thumbnails in user messages */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {message.attachments.map((att) => (
                  <div key={att.id} className="relative">
                    <img
                      src={att.url}
                      alt={att.filename}
                      className="w-16 h-16 object-cover rounded border border-white/10"
                    />
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white/60 text-center truncate px-1">
                      {att.filename}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {message.content}
          </div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none text-text-secondary leading-relaxed pt-1.5 text-[15px]">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                // Override pre to avoid double-wrapping (CodeBlock has its own <pre>)
                pre({ children }) {
                  return <>{children}</>;
                },
                code({ className, children, ...props }) {
                  const isInline = !className;
                  if (isInline) {
                    return <code className="bg-surface-elevated border border-border rounded px-1.5 py-0.5 text-text-primary text-xs font-mono" {...props}>{children}</code>;
                  }
                  // Block code: children are React elements from rehype-highlight
                  // Pass them directly â€” NEVER call String() on React elements
                  return <CodeBlock className={className}>{children}</CodeBlock>;
                },
              }}
            >
              {message.content}
            </ReactMarkdown>

            {/* Citations */}
            {message.citations && message.citations.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                {message.citations.map((c, i) => (
                  <a
                    key={i}
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-lg text-[10px] uppercase tracking-widest font-semibold text-text-tertiary hover:text-text-primary hover:border-text-secondary/50 transition-all no-underline shadow-sm"
                  >
                    <span className="text-blue-400">[{i + 1}]</span>
                    <span className="truncate max-w-[200px]">{c.title}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {message.isStreaming && (
          <div className="mt-2">
            <LoadingDots />
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center shrink-0 mt-1 shadow-sm">
          <UserIcon className="w-4 h-4 text-text-secondary" />
        </div>
      )}
    </motion.div>
  );
};

// â”€â”€â”€ Chat Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const ChatPage = () => {
  const {
    messages, isStreaming, addMessage, appendToMessage,
    updateMessage, setStreaming, setError,
    activeAgent, agentPipeline, setAgentStatus,
    activeSessionId, setActiveSession, sessions, setSessions,
    addSession, updateSessionTitle, setMessages, setLoading,
  } = useChatStore();

  // GLOBAL upload store â€” persists across tab switches
  const {
    imageAttachments, isLoadingImages,
    addImageAttachments, removeImageAttachment, clearImageAttachments,
    validateImage,
  } = useUploadStore();

  const addToast = useUIStore((s) => s.addToast);
  const [input, setInput] = useState('');
  const [abortFn, setAbortFn] = useState<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const titleGeneratedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // â”€â”€â”€ Load sessions on mount â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    chatService.getSessions('chat').then((sessions) => {
      setSessions(sessions.map((s: any) => ({
        id: s.id,
        title: s.title || 'New Chat',
        type: s.type || 'chat',
        messageCount: s.message_count || 0,
        createdAt: s.created_at || new Date().toISOString(),
        updatedAt: s.updated_at || new Date().toISOString(),
      })));
    }).catch(() => {});
  }, [setSessions]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // â”€â”€â”€ Image Upload Handler (images only â€” validates type) â”€â”€â”€â”€â”€â”€
  const handleImageUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of fileArray) {
      const result = validateImage(file);
      if (result.valid) {
        validFiles.push(file);
      } else {
        errors.push(`${file.name}: ${result.error}`);
      }
    }

    for (const err of errors) {
      addToast({ type: 'error', title: 'Invalid Image', message: err });
    }

    if (validFiles.length > 0) {
      await addImageAttachments(validFiles);
      addToast({
        type: 'success',
        title: 'Images Attached',
        message: `${validFiles.length} image(s) ready for analysis`,
      });
    }
  }, [addImageAttachments, addToast, validateImage]);

  // â”€â”€â”€ General File Upload Handler (images + documents) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // This is used by the paperclip button. Images are validated; non-images
  // (PDF, DOCX, TXT, code files, etc.) are accepted directly without
  // image-type validation â€” the backend orchestrator routes by extension.
  const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

  const handleGeneralFileUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const imageFiles: File[] = [];
    const docFiles: File[] = [];
    const errors: string[] = [];

    for (const file of fileArray) {
      if (file.size === 0) {
        errors.push(`${file.name}: File is empty or corrupted.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: Too large (max 50 MB).`);
        continue;
      }
      if (IMAGE_MIME_TYPES.has(file.type)) {
        imageFiles.push(file);
      } else {
        docFiles.push(file);
      }
    }

    for (const err of errors) {
      addToast({ type: 'error', title: 'Invalid File', message: err });
    }

    // Route images through validated upload
    if (imageFiles.length > 0) await handleImageUpload(imageFiles);

    // Route documents directly â€” backend decides how to process them
    if (docFiles.length > 0) {
      await addImageAttachments(docFiles);
      addToast({
        type: 'success',
        title: 'Files Attached',
        message: `${docFiles.length} file(s) ready to send`,
      });
    }
  }, [handleImageUpload, addImageAttachments, addToast]);

  // â”€â”€â”€ Drag & Drop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleImageUpload(e.dataTransfer.files);
    }
  }, [handleImageUpload]);

  // â”€â”€â”€ Paste Handler (clipboard images â€” single fire, hold-proof) â”€â”€
  const lastPasteAt = useRef<number>(0);

  const handlePaste = useCallback((e: React.ClipboardEvent | ClipboardEvent) => {
    const now = Date.now();
    // Ignore repeated paste events from holding Ctrl+V (1 second cooldown)
    if (now - lastPasteAt.current < 1000) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const ext = item.type.split('/')[1] || 'png';
          const named = new File([file], `screenshot-${now}.${ext}`, { type: item.type });
          imageFiles.push(named);
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      lastPasteAt.current = now;   // mark cooldown ONLY when an image was actually pasted
      // Only take the first image from the clipboard (one paste = one image)
      handleImageUpload([imageFiles[0]]);
      addToast({ type: 'success', title: 'Image pasted', message: imageFiles[0].name });
    }
  }, [handleImageUpload, addToast]);

  // Listen for paste anywhere on the window (no textarea focus needed)
  useEffect(() => {
    const onWindowPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const hasImage = Array.from(items).some((i) => i.type.startsWith('image/'));
      if (hasImage) handlePaste(e);
    };
    window.addEventListener('paste', onWindowPaste);
    return () => window.removeEventListener('paste', onWindowPaste);
  }, [handlePaste]);

  // â”€â”€â”€ Code Toggle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const toggleCode = () => {
    if (input.startsWith('```') && input.endsWith('```')) {
      setInput(input.slice(3, -3).trim());
    } else {
      setInput(`\`\`\`\n${input}\n\`\`\``);
    }
  };

  // â”€â”€â”€ Send Message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSend = async () => {
    const trimmed = input.trim();
    // Allow sending with only images (no text required)
    if ((!trimmed && imageAttachments.length === 0) || isStreaming) return;

    // Build the final prompt (fallback to description request if images but no text)
    const prompt = trimmed || 'Analyze and describe the attached image(s) in detail.';

    // â”€â”€ Auto-create session on first message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let sessionId = activeSessionId;
    const isFirstMessage = messages.length === 0;

    if (!sessionId) {
      try {
        const newSession = await chatService.createSession('New Chat', 'chat');
        sessionId = newSession.id;
        setActiveSession(sessionId);
        addSession({
          id: sessionId,
          title: 'New Chat',
          type: 'chat',
          messageCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch {
        // Continue without persistence
        sessionId = crypto.randomUUID();
        setActiveSession(sessionId);
      }
    }

    // Build user message with attachment metadata for display
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed || '[Image attached for analysis]',
      timestamp: new Date().toISOString(),
      attachments: imageAttachments
        .filter((a) => a.status === 'ready')
        .map((a) => ({
          id: a.id,
          filename: a.filename,
          fileType: a.mimeType,
          size: a.size,
          url: a.preview,
        })),
    };
    addMessage(userMsg);
    setInput('');
    setStreaming(true);

    // Persist user message to backend
    // Removed because backend automatically saves it
    // if (sessionId) {
    //   chatService.saveMessage(sessionId, 'user', userMsg.content);
    // }

    // Add placeholder assistant message
    const assistantId = crypto.randomUUID();
    addMessage({
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    });

    // Capture for title generation
    const firstMessageText = prompt;
    const currentSessionId = sessionId;

    try {
      // Build the API payload with image data
      const attachments = chatService.buildAttachments(imageAttachments);

      const abort = await chatService.sendMessage(
        {
          message: prompt,
          session_id: sessionId || undefined,
          attachments: attachments.length > 0 ? attachments : undefined,
        },
        (token) => appendToMessage(assistantId, token),
        (response) => {
          updateMessage(assistantId, {
            isStreaming: false,
            citations: response.message.citations,
            reasoningSteps: response.message.reasoningSteps,
          });
          setStreaming(false);
          setAgentStatus(null, [], null);   // clear agent badge
          // Clear images ONLY after successful send
          clearImageAttachments();

          // Persist assistant message
          // Removed because backend automatically saves it
          // if (currentSessionId) {
          //   chatService.saveMessage(currentSessionId, 'assistant', response.message.content);
          // }

          // â”€â”€ Auto-generate title on first message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          if (isFirstMessage && currentSessionId && !titleGeneratedRef.current.has(currentSessionId)) {
            titleGeneratedRef.current.add(currentSessionId);
            chatService.generateTitle(currentSessionId, firstMessageText).then((title) => {
              updateSessionTitle(currentSessionId, title);
            });
          }
        },
        (error) => {
          updateMessage(assistantId, { isStreaming: false, content: `Error: ${error}` });
          setStreaming(false);
          setAgentStatus(null, [], null);
          setError(error);
          addToast({ type: 'error', title: 'Chat Error', message: error });
          // Do NOT clear images on error â€” let user retry
        },
        undefined,  // onReasoning
        (status) => setAgentStatus(status.agent, status.pipeline, status.input_type),
        (cit) => {
          updateMessage(assistantId, {
            citations: cit.citations.map((c) => ({ title: c.title, url: c.url, snippet: '', relevance: 1 })),
          });
        },
      );
      setAbortFn(() => abort);
    } catch {
      setStreaming(false);
    }
  };

  const handleStop = () => {
    abortFn?.();
    setStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = messages.length === 0;
  const hasImages = imageAttachments.length > 0;
  const canSend = (input.trim().length > 0 || hasImages) && !isStreaming && !isLoadingImages;

  // â”€â”€â”€ Session sidebar state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [showSidebar, setShowSidebar] = useState(true);
  const [loadingSession, setLoadingSession] = useState<string | null>(null);

  const loadSession = useCallback(async (sessionId: string) => {
    if (sessionId === activeSessionId || isStreaming) return;
    setLoadingSession(sessionId);
    setActiveSession(sessionId);
    setMessages([]);
    try {
      const msgs = await chatService.getSessionMessages(sessionId);
      setMessages(msgs);
    } catch {
      setMessages([]);
    } finally {
      setLoadingSession(null);
    }
  }, [activeSessionId, isStreaming, setActiveSession, setMessages]);

  const handleNewChat = useCallback(() => {
    if (isStreaming) return;
    setMessages([]);
    setActiveSession(null);
    clearImageAttachments();
    setInput('');
  }, [isStreaming, setMessages, setActiveSession, clearImageAttachments]);

  return (
    <div className="flex h-[calc(100vh-4rem)]">

      {/* â”€â”€â”€ Session Sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <AnimatePresence initial={false}>
        {showSidebar && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 220, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 border-r border-white/5 bg-white/[0.01] flex flex-col overflow-hidden"
          >
            {/* Sidebar header */}
            <div className="h-14 px-3 border-b border-border flex items-center justify-between">
              <button
                onClick={() => setShowSidebar(false)}
                className="p-2 text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors rounded-lg"
                title="Hide sessions"
              >
                <PanelLeftClose className="w-5 h-5" />
              </button>
              <button
                onClick={handleNewChat}
                disabled={isStreaming}
                className="p-2 text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors disabled:opacity-30 rounded-lg"
                title="New chat"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-1">
              {sessions.length === 0 ? (
                <div className="text-center py-10">
                  <MessageSquare className="w-5 h-5 text-text-tertiary mx-auto mb-2" />
                  <p className="text-xs text-text-secondary">No sessions</p>
                </div>
              ) : (
                sessions.map((s) => {
                  const isActive = s.id === activeSessionId;
                  const isLoading = loadingSession === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => loadSession(s.id)}
                      disabled={isLoading || isStreaming}
                      className={`w-full text-left px-3 py-2.5 transition-colors rounded-lg flex items-start gap-3 group ${
                        isActive
                          ? 'bg-white/10'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 text-text-secondary animate-spin shrink-0 mt-0.5" />
                      ) : (
                        <MessageSquare className={`w-4 h-4 shrink-0 mt-0.5 ${isActive ? 'text-text-primary' : 'text-text-tertiary group-hover:text-text-secondary'}`} />
                      )}
                      <div className="min-w-0">
                        <div className={`text-sm leading-snug truncate ${isActive ? 'font-medium text-text-primary' : 'text-text-secondary group-hover:text-text-primary'}`}>
                          {s.title || 'New Chat'}
                        </div>
                        {s.messageCount > 0 && (
                          <div className="text-xs text-text-tertiary mt-1">
                            {s.messageCount} messages
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* â”€â”€â”€ Main chat column â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div
        className="flex-1 flex flex-col min-w-0"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Toggle sidebar button when closed */}
        {!showSidebar && (
          <div className="absolute top-4 left-4 z-10">
            <button
              onClick={() => setShowSidebar(true)}
              className="p-2 text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors rounded-lg"
              title="Show sessions"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>
          </div>
        )}

      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-primary/5 border-2 border-dashed border-primary/40 flex items-center justify-center pointer-events-none"
          >
            <div className="text-center">
              <ImageIcon className="w-12 h-12 text-primary/60 mx-auto mb-3" />
              <p className="text-primary/80 text-lg font-serif italic">Drop images here</p>
              <p className="text-white/30 text-xs mt-1">PNG, JPG, JPEG, WEBP â€” Max 20 MB</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-8 lg:px-16 xl:px-24 py-8 no-scrollbar">
        {isEmpty ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full text-center max-w-2xl mx-auto"
          >
            <div className="w-16 h-16 rounded-full bg-surface-elevated border border-border flex items-center justify-center mb-8 shadow-sm">
              <Bot className="w-8 h-8 text-text-primary" />
            </div>
            <h2 className="text-3xl font-semibold text-text-primary mb-3">
              How can I help you today?
            </h2>
            <p className="text-text-tertiary text-sm max-w-md leading-relaxed">
              Ask me anything — I can help with research, analysis, conversations, and more. Just type or upload a file to get started.
            </p>

            {/* Quick Suggestions */}
            <div className="flex flex-wrap gap-3 mt-12 max-w-2xl justify-center">
              {[
                'Help me brainstorm ideas',
                'Explain something complex simply',
                'Write a summary for me',
                'Research a topic in depth',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="px-4 py-2.5 bg-surface border border-border text-text-secondary text-sm font-medium hover:text-text-primary hover:bg-white/5 hover:border-text-secondary/50 rounded-xl transition-all shadow-sm"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <AnimatePresence>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </AnimatePresence>

            {/* â”€â”€ Live Agent Status Badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <AnimatePresence>
              {isStreaming && activeAgent && (() => {
                const meta = AGENT_META[activeAgent] || { label: activeAgent, icon: Bot, color: 'text-primary' };
                const Icon = meta.icon;
                return (
                  <motion.div
                    key="agent-badge"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="flex items-center gap-3 mb-4 px-3 py-2 bg-white/[0.03] border border-white/5 w-fit"
                  >
                    <Icon className={`w-3.5 h-3.5 ${meta.color} animate-pulse`} />
                    <span className={`text-[10px] uppercase tracking-widest ${meta.color}`}>{meta.label}</span>
                  </motion.div>
                );
              })()}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* â”€â”€â”€ Unified Floating Composer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="px-8 lg:px-16 xl:px-24 pb-6">
        <div className="max-w-4xl mx-auto p-2 flex flex-col gap-2 rounded-[32px] bg-surface-elevated border border-border shadow-sm">

          {/* Image Preview Chips (from GLOBAL store) */}
          <AnimatePresence>
            {hasImages && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex flex-wrap gap-2 px-3 pt-2 pb-1 overflow-hidden"
              >
                {imageAttachments.map((img) => (
                  <motion.div
                    key={img.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="group relative flex items-center gap-2 px-2 py-1.5 bg-white/5 border border-white/10 rounded-xl"
                  >
                    {img.status === 'loading' ? (
                      <Loader2 className="w-6 h-6 text-text-secondary animate-spin" />
                    ) : (
                      <img
                        src={img.preview}
                        alt={img.filename}
                        className="w-8 h-8 object-cover rounded border border-white/10"
                      />
                    )}
                    <div className="flex flex-col">
                      <span className="text-xs text-text-secondary truncate max-w-[120px]">
                        {img.filename}
                      </span>
                      <span className="text-[10px] text-text-tertiary">
                        {img.status === 'loading' ? 'Processing...' :
                         img.status === 'error' ? 'Error' :
                         `${(img.size / 1024).toFixed(0)} KB`}
                      </span>
                    </div>
                    <button
                      onClick={() => removeImageAttachment(img.id)}
                      className="ml-1 text-text-tertiary hover:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}

                {/* Clear all button */}
                {imageAttachments.length > 1 && (
                  <button
                    onClick={clearImageAttachments}
                    className="text-xs text-text-tertiary hover:text-red-400 px-2 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Analyzing indicator */}
          {isLoadingImages && (
            <div className="flex items-center gap-2 px-4 py-1 text-text-secondary">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Processing images...</span>
            </div>
          )}

          <div className="flex items-end gap-3 w-full pl-2">
            {/* Attachment Buttons */}
            <div className="flex gap-1 pb-1">
              {/* Hidden image input (images only) */}
              <input
                type="file"
                ref={imageInputRef}
                className="hidden"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/bmp,image/tiff,image/gif"
                multiple
                onChange={(e) => {
                  if (e.target.files?.length) handleImageUpload(e.target.files);
                  e.target.value = ''; // Reset so same file can be re-selected
                }}
              />
              {/* Hidden general file input (paperclip â€” handles all file types) */}
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/bmp,image/tiff,image/gif,.pdf,.docx,.txt,.md,.csv,.xlsx,.xls,.xlsm,.xlsb,.json,.jsonl,.ndjson,.xml,.yaml,.yml,.py,.java,.js,.ts,.c,.cpp,.html,.css,.sql,.zip,.tsv,.psv,.dat,.sqlite,.db,.parquet,.orc,.avro,.feather,.arrow,.hdf5,.h5,.mat,.pkl,.pickle,.joblib,.npy,.npz,.bmp,.tiff,.tif,.gif"
                multiple
                onChange={(e) => {
                  if (e.target.files?.length) handleGeneralFileUpload(e.target.files);
                  e.target.value = '';
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoadingImages}
                className="p-2.5 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50 rounded-full hover:bg-white/5"
                title="Attach file"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                isLoadingImages
                  ? 'Processing images...'
                  : hasImages
                  ? 'Ask about the image(s), or press Enter to analyze...'
                  : 'Ask anything'
              }
              rows={1}
              className="flex-1 bg-transparent border-none outline-none resize-none text-text-primary text-base placeholder:text-text-tertiary font-sans leading-relaxed max-h-[200px] py-3.5 focus:ring-0"
              disabled={isLoadingImages}
            />

            {/* Send / Stop */}
            {isStreaming ? (
              <button
                onClick={handleStop}
                className="p-3 bg-white text-black hover:bg-white/90 transition-all rounded-full mb-1 mr-1"
              >
                <StopCircle className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="p-3 bg-white text-black hover:bg-white/90 transition-all disabled:opacity-20 disabled:hover:bg-white rounded-full mb-1 mr-1"
              >
                <Send className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-[10px] font-medium text-text-tertiary mt-3">
          ThinkSync • Smart AI Assistant • Responses may not always be accurate
        </p>
      </div>
      </div>
    </div>
  );
};
