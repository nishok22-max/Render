import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload, FileText, Image, Database, Code2, X, RefreshCw, CheckCircle,
  AlertCircle, Archive, Brain, Send, Bot, User as UserIcon, Copy, Check,
  Trash2, Search, HardDrive, Sparkles, Loader2, BookOpen, Quote,
  ChevronDown, MessageSquare, FlaskConical, Wrench,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { useUIStore } from '../store/uiStore';
import { ragService, type RagDocument, type RagCitation, type RagSource } from '../services/ragService';
import { getFileCategory, formatFileSize, getFileExtension } from '../utils/fileUtils';
import { RagLoadingIndicator } from '../components/shared/RagLoadingIndicator';
import { formatRagResponse, shouldShowCitations, type RagResponseMode } from '../utils/ragFormatter';

// ——— Types ————————————————————————————————————————————————————————————————————————————————

interface RagMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  citations?: RagCitation[];
  sources?: RagSource[];
}

interface UploadEntry {
  id: string;
  file: File;
  filename: string;
  size: number;
  category: string;
  status: 'queued' | 'uploading' | 'processing' | 'parsed' | 'error';
  progress: number;
  error?: string;
}

// ——— File Type Icon ——————————————————————————————————————————————————————————————————————

const FileTypeIcon = ({ category }: { category: string }) => {
  const icons: Record<string, typeof FileText> = {
    image: Image, document: FileText, dataset: Database,
    code: Code2, compressed: Archive,
  };
  const Icon = icons[category] || FileText;
  return <Icon className="w-4 h-4" />;
};

// ——— Citation Card ———————————————————————————————————————————————————————————————————

const CitationCard = ({ citation }: { citation: RagCitation }) => (
  <motion.div
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-surface border border-border p-3 text-xs rounded-lg"
  >
    <div className="flex items-center gap-2 mb-1.5">
      <Quote className="w-3 h-3 text-text-tertiary" />
      <span className="text-text-secondary text-[10px] uppercase tracking-wider font-semibold">
        Source {citation.index}
      </span>
      <span className="text-text-tertiary text-[9px] ml-auto">
        {(citation.similarity * 100).toFixed(0)}% match
      </span>
    </div>
    <p className="text-text-tertiary leading-relaxed line-clamp-3">{citation.content}</p>
  </motion.div>
);

// ——— Collapsible Citations ———————————————————————————————————————————————————————————

const CollapsibleCitations = ({ citations }: { citations: RagCitation[] }) => {
  const [open, setOpen] = useState(false);
  if (!citations.length) return null;

  return (
    <div className="mt-2 pl-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-text-tertiary hover:text-text-secondary transition-colors py-1"
      >
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        {citations.length} source{citations.length !== 1 ? 's' : ''} referenced
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-2 overflow-hidden pt-1"
          >
            {citations.map((c, i) => (
              <CitationCard key={i} citation={c} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ——— Message Bubble ——————————————————————————————————————————————————————————————————

const RagMessageBubble = ({ message, mode }: { message: RagMessage; mode: RagResponseMode }) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Apply the formatting pipeline only to assistant messages
  const displayContent = isUser
    ? message.content
    : formatRagResponse(message.content, mode);

  const showCitations = !isUser
    && shouldShowCitations(mode)
    && message.citations
    && message.citations.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-4 mb-6 ${isUser ? 'justify-end' : ''}`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-surface-elevated border border-border flex items-center justify-center shrink-0 mt-1 shadow-sm">
          <Brain className="w-4 h-4 text-text-primary" />
        </div>
      )}
      <div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
        <div className={`px-5 py-3.5 rounded-2xl ${isUser
          ? 'bg-surface-elevated border border-border text-text-primary rounded-tr-sm'
          : 'text-text-primary rounded-tl-sm'
        }`}>
          {isUser ? (
            <p className="text-[15px] whitespace-pre-wrap leading-relaxed">{displayContent}</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none text-text-secondary leading-relaxed text-[15px]
              prose-headings:text-text-primary prose-headings:font-sans prose-headings:font-semibold
              prose-strong:text-text-primary prose-code:text-text-primary
              prose-code:bg-surface-elevated prose-code:border prose-code:border-border prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-xs
              prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
              prose-p:mb-3 prose-li:mb-1">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {displayContent || (message.isStreaming ? '▌' : '')}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Citations — collapsible, only in research/technical modes */}
        {showCitations && (
          <CollapsibleCitations citations={message.citations!} />
        )}

        {/* Copy button */}
        {!isUser && !message.isStreaming && message.content && (
          <button onClick={handleCopy} className="mt-1.5 text-text-tertiary hover:text-text-secondary transition-colors p-1">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
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


// ——— RAG Agent Page ——————————————————————————————————————————————————————————————————————

export const RagAgentPage = () => {
  const addToast = useUIStore((s) => s.addToast);

  // ——— State —————————————————————————————————————————————————————————————————————————————
  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [messages, setMessages] = useState<RagMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [mode, setMode] = useState<RagResponseMode>('conversation');
  
  // ——— Unmount guard — prevents setState after unmount —————————————————————————————————
  const mountedRef = useRef(true);
  const pollTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Cancel all pending poll timers
      pollTimersRef.current.forEach(clearTimeout);
      pollTimersRef.current.clear();
    };
  }, []);

  const [retrievalLabel, setRetrievalLabel] = useState('RAG retrieving...');
  const [isDragging, setIsDragging] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [stats, setStats] = useState({ total_documents: 0, total_size_bytes: 0, parsed: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [abortFn, setAbortFn] = useState<(() => void) | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);

  // ——— Load data on mount ——————————————————————————————————————————————————————————————
  useEffect(() => {
    loadDocuments();
    loadSuggestions();
    loadStats();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadDocuments = async () => {
    try { setDocuments(await ragService.getDocuments()); } catch {}
  };
  const loadSuggestions = async () => {
    try { setSuggestions(await ragService.getSuggestions()); } catch {}
  };
  const loadStats = async () => {
    try { setStats(await ragService.getStats()); } catch {}
  };

  // ——— Upload handler ——————————————————————————————————————————————————————————————————
  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const newEntries: UploadEntry[] = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(),
      file,
      filename: file.name,
      size: file.size,
      category: getFileCategory(file.name),
      status: 'queued' as const,
      progress: 0,
    }));

    setUploads((prev) => [...newEntries, ...prev]);

    for (const entry of newEntries) {
      if (!mountedRef.current) break;
      setUploads((prev) => prev.map((u) => u.id === entry.id ? { ...u, status: 'uploading' } : u));
      try {
        await ragService.upload(entry.file, (progress) => {
          if (mountedRef.current)
            setUploads((prev) => prev.map((u) => u.id === entry.id ? { ...u, progress } : u));
        });
        if (!mountedRef.current) break;
        setUploads((prev) => prev.map((u) => u.id === entry.id ? { ...u, status: 'processing', progress: 100 } : u));
        addToast({ type: 'success', title: 'Uploaded to RAG KB', message: entry.filename });

        // Poll for parse completion — cancellable, stops on unmount
        const pollStatus = (attempts = 0) => {
          if (!mountedRef.current) return;
          if (attempts > 30) return;

          const timerId = setTimeout(async () => {
            pollTimersRef.current.delete(timerId);
            if (!mountedRef.current) return;
            try {
              const docs = await ragService.getDocuments();
              if (!mountedRef.current) return;
              const uploaded = docs.find((d) => d.filename === entry.filename);
              if (uploaded?.status === 'parsed') {
                setUploads((prev) => prev.map((u) => u.id === entry.id ? { ...u, status: 'parsed' } : u));
                loadDocuments();
                loadSuggestions();
                loadStats();
                return;
              }
              if (uploaded?.status === 'error') {
                setUploads((prev) => prev.map((u) => u.id === entry.id ? { ...u, status: 'error', error: 'Ingestion failed' } : u));
                return;
              }
            } catch {}
            pollStatus(attempts + 1);
          }, 2000);
          pollTimersRef.current.add(timerId);
        };
        pollStatus();
      } catch (err: any) {
        if (!mountedRef.current) break;
        setUploads((prev) => prev.map((u) => u.id === entry.id ? { ...u, status: 'error', error: err.message } : u));
        addToast({ type: 'error', title: 'Upload Failed', message: entry.filename });
      }
    }
  }, [addToast]);


  // ——— Chat handler ————————————————————————————————————————————————————————————————————
  const handleSend = async () => {
    const question = input.trim();
    if (!question || isStreaming) return;

    setInput('');
    setIsStreaming(true);
    setIsRetrieving(true);
    setRetrievalLabel('Searching knowledge base...');

    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', content: question },
      { id: assistantId, role: 'assistant', content: '', isStreaming: true },
    ]);

    try {
      const abort = await ragService.query(question, {
        onToken: (token) => {
          setIsRetrieving(false);  // retrieval done, LLM is generating
          setMessages((prev) => prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + token } : m
          ));
        },
        onCitations: (citations, sources) => {
          setMessages((prev) => prev.map((m) =>
            m.id === assistantId ? { ...m, citations, sources } : m
          ));
        },
        onRetrieval: (total, sources) => {
          setRetrievalLabel(`Retrieved ${total} chunks...`);
        },
        onStatus: (statusMsg) => {
          setRetrievalLabel(statusMsg || 'RAG retrieving...');
        },
        onError: (error) => {
          setIsRetrieving(false);
          setMessages((prev) => prev.map((m) =>
            m.id === assistantId ? { ...m, content: `Error: ${error}`, isStreaming: false } : m
          ));
          setIsStreaming(false);
        },
        onComplete: () => {
          setIsRetrieving(false);
          setMessages((prev) => prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          ));
          setIsStreaming(false);
        },
      });
      setAbortFn(() => abort);
    } catch {
      setIsRetrieving(false);
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId ? { ...m, content: 'Connection error.', isStreaming: false } : m
      ));
      setIsStreaming(false);
    }
  };

  // ——— Delete document —————————————————————————————————————————————————————————————————
  const handleDelete = async (docId: string) => {
    try {
      await ragService.deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      loadStats();
      loadSuggestions();
      addToast({ type: 'success', title: 'Deleted', message: 'Document removed from KB' });
    } catch {
      addToast({ type: 'error', title: 'Delete Failed', message: 'Could not remove document' });
    }
  };

  // ——— Filter documents ————————————————————————————————————————————————————————————————
  const filteredDocs = documents.filter((d) =>
    d.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isEmpty = messages.length === 0;

  // ——— Render ——————————————————————————————————————————————————————————————————————————

  return (
    <div className="flex h-[calc(100vh-64px)]">

      {/* ——— LEFT: Document Sidebar ——— */}
      <div className="w-72 border-r border-border flex flex-col bg-surface shrink-0">
        {/* Stats Header */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2 mb-4">
            <HardDrive className="w-4 h-4 text-text-secondary" />
            <span className="font-semibold text-sm text-text-primary">Knowledge Base</span>
          </div>
          <div className="grid grid-cols-3 gap-2 bg-surface-elevated rounded-xl p-3 border border-border">
            <div className="text-center border-r border-border">
              <div className="text-lg font-bold text-text-primary">{stats.total_documents}</div>
              <div className="text-[9px] uppercase tracking-wider text-text-tertiary mt-0.5">Files</div>
            </div>
            <div className="text-center border-r border-border">
              <div className="text-lg font-bold text-text-primary">{stats.parsed || 0}</div>
              <div className="text-[9px] uppercase tracking-wider text-text-tertiary mt-0.5">Indexed</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-text-primary">
                {stats.total_size_bytes > 1024 * 1024
                  ? `${(stats.total_size_bytes / 1024 / 1024).toFixed(1)}M`
                  : `${(stats.total_size_bytes / 1024).toFixed(0)}K`}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-text-tertiary mt-0.5">Size</div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2 px-3 py-2 bg-surface-elevated border border-border rounded-lg">
            <Search className="w-3.5 h-3.5 text-text-tertiary" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="bg-transparent text-text-primary text-xs outline-none w-full placeholder:text-text-tertiary"
            />
          </div>
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-1">
          <AnimatePresence>
            {filteredDocs.length === 0 ? (
              <div className="text-center py-12 text-text-tertiary text-xs">
                No documents yet
              </div>
            ) : (
              filteredDocs.map((doc) => (
                <motion.div
                  key={doc.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group cursor-default"
                >
                  <div className="text-text-tertiary">
                    <FileTypeIcon category={getFileCategory(doc.filename)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-text-primary text-[11px] truncate">{doc.filename}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-text-tertiary">{formatFileSize(doc.file_size)}</span>
                      <span className={`text-[9px] ${
                        doc.status === 'parsed' ? 'text-green-400' :
                        doc.status === 'processing' ? 'text-blue-400' :
                        doc.status === 'error' ? 'text-red-400' : 'text-text-tertiary'
                      }`}>
                        {doc.status === 'parsed' && <CheckCircle className="w-2.5 h-2.5 inline mr-0.5" />}
                        {doc.status === 'processing' && <RefreshCw className="w-2.5 h-2.5 inline mr-0.5 animate-spin" />}
                        {doc.status}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-text-tertiary hover:text-red-400 hover:bg-white/5 rounded transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ——— RIGHT: Main Area ——— */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ——— Header ——— */}
        <div className="px-8 pt-8 pb-4 flex justify-between items-start">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-text-secondary" />
              <span className="text-[10px] font-medium uppercase tracking-widest text-text-secondary">Document Intelligence</span>
            </div>
            <h2 className="font-sans text-3xl font-bold text-text-primary tracking-tight">
              Knowledge Search
            </h2>
            <p className="text-text-secondary text-sm mt-2 max-w-lg">
              Upload documents and ask questions — answers come directly from your files.
            </p>
          </div>
          
          {/* Mode Toggle — 3-way segmented control */}
          <div className="flex bg-surface-elevated border border-border p-1 rounded-xl shadow-sm">
            {([
              { key: 'conversation' as const, label: 'Chat', icon: MessageSquare },
              { key: 'research' as const, label: 'Research', icon: FlaskConical },
              { key: 'technical' as const, label: 'Technical', icon: Wrench },
            ]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  mode === key
                    ? 'bg-white/10 text-text-primary shadow'
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ——— Upload Zone ——— */}
        <div className="px-8 pb-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
            }}
            onClick={() => document.getElementById('rag-file-input')?.click()}
            className={`relative border-2 border-dashed transition-all duration-300 p-8 text-center cursor-pointer rounded-2xl ${
              isDragging
                ? 'border-text-primary bg-white/5'
                : 'border-border bg-surface-elevated hover:border-white/20'
            }`}
          >
            <input
              id="rag-file-input"
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files?.length && processFiles(e.target.files)}
              accept=".png,.jpg,.jpeg,.webp,.bmp,.tiff,.tif,.gif,.pdf,.docx,.txt,.md,.csv,.xlsx,.xls,.xlsm,.xlsb,.json,.jsonl,.ndjson,.xml,.yaml,.yml,.py,.java,.js,.ts,.c,.cpp,.html,.css,.sql,.zip,.tsv,.psv,.dat,.sqlite,.db,.parquet,.orc,.avro,.feather,.arrow,.hdf5,.h5,.mat,.pkl,.pickle,.joblib,.npy,.npz"
            />
            <div className="flex items-center justify-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                isDragging ? 'bg-white/10 text-text-primary' : 'bg-white/5 text-text-secondary'
              }`}>
                <Upload className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="font-sans font-semibold text-base text-text-primary">
                  {isDragging ? 'Release to upload' : 'Drop files into Knowledge Base'}
                </div>
                <div className="text-text-tertiary text-xs mt-1">
                  Images • Documents • Datasets • Code • Archives
                </div>
              </div>
            </div>
          </div>

          {/* Upload progress chips */}
          <AnimatePresence>
            {uploads.filter((u) => u.status !== 'parsed').length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex flex-wrap gap-2 mt-3 overflow-hidden"
              >
                {uploads.filter((u) => u.status !== 'parsed').map((u) => (
                  <div key={u.id} className="flex items-center gap-2 px-3 py-1.5 bg-surface-elevated border border-border rounded-lg text-xs">
                    <div className="text-text-secondary">
                      <FileTypeIcon category={u.category} />
                    </div>
                    <span className="text-text-primary truncate max-w-32">{u.filename}</span>
                    {u.status === 'uploading' && <Loader2 className="w-3 h-3 text-text-secondary animate-spin" />}
                    {u.status === 'processing' && <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />}
                    {u.status === 'error' && <AlertCircle className="w-3 h-3 text-red-400" />}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ——— Chat Area ——— */}
        <div ref={chatAreaRef} className="flex-1 overflow-y-auto px-8 no-scrollbar">
          {isEmpty ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6">
                <Brain className="w-7 h-7 text-text-primary" />
              </div>
              <h3 className="font-sans text-2xl font-bold text-text-primary mb-2">Ready to Answer</h3>
              <p className="text-text-secondary text-sm max-w-md mb-8">
                I only answer from documents you've uploaded. Upload some files and ask me anything about them.
              </p>

              {/* Quick Question Buttons */}
              <div className="flex flex-wrap gap-2 max-w-xl justify-center">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => { setInput(suggestion); }}
                    className="px-4 py-2 bg-surface-elevated border border-border rounded-xl text-text-secondary text-xs hover:text-text-primary hover:bg-white/5 transition-all"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="max-w-3xl mx-auto py-4">
              <AnimatePresence>
                {messages.map((msg) => (
                  <RagMessageBubble key={msg.id} message={msg} mode={mode} />
                ))}
              </AnimatePresence>

              {/* —— RAG Retrieval Loading Indicator —— */}
              <RagLoadingIndicator
                isRetrieving={isRetrieving}
                label={retrievalLabel}
                className="mb-4"
              />

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ——— Composer ——— */}
        <div className="px-8 pb-6 pt-3">
          <div className="max-w-3xl mx-auto p-2 flex items-center gap-3 rounded-[32px] bg-surface-elevated border border-border shadow-sm">
            <div className="pl-3 py-2 flex items-center text-text-secondary shrink-0">
              <Brain className="w-5 h-5" />
            </div>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask about your uploaded documents..."
              className="flex-1 bg-transparent text-text-primary text-base outline-none placeholder:text-text-tertiary"
              disabled={isStreaming}
            />
            {isStreaming ? (
              <button
                onClick={() => { abortFn?.(); setIsStreaming(false); }}
                className="p-3 bg-white text-black hover:bg-white/90 transition-all rounded-full mb-0 mr-0.5"
              >
                <X className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-3 bg-white text-black hover:bg-white/90 transition-all disabled:opacity-20 disabled:hover:bg-white rounded-full mb-0 mr-0.5"
              >
                <Send className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="text-center mt-3">
             <span className="text-[10px] text-text-tertiary tracking-wide">
              Document Search • Answers From Your Files Only • {stats.total_documents} files uploaded
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
