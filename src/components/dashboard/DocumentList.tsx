import { FileText, FileJson, FileCode, Database, File, Trash2, RefreshCw, CheckCircle, AlertCircle, Loader2, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type Document, workspaceService } from '../../services/workspaceService';
import { ROUTES } from '../../utils/constants';

function getFileIcon(type: string) {
  if (['pdf', 'docx', 'txt', 'md'].includes(type)) return FileText;
  if (['json'].includes(type)) return FileJson;
  if (['py', 'js', 'ts', 'java', 'c', 'cpp', 'html', 'css', 'sql'].includes(type)) return FileCode;
  if (['csv', 'xlsx'].includes(type)) return Database;
  return File;
}

function StatusBadge({ status }: { status: Document['status'] }) {
  if (status === 'parsed') return (
    <span className="flex items-center gap-1.5 text-emerald-400">
      <CheckCircle className="w-3.5 h-3.5" />
      <span className="text-xs font-medium">Indexed</span>
    </span>
  );
  if (status === 'processing') return (
    <span className="flex items-center gap-1.5 text-primary">
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      <span className="text-xs font-medium">Processing</span>
    </span>
  );
  if (status === 'error') return (
    <span className="flex items-center gap-1.5 text-red-400">
      <AlertCircle className="w-3.5 h-3.5" />
      <span className="text-xs font-medium">Error</span>
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-text-tertiary">
      <RefreshCw className="w-3.5 h-3.5" />
      <span className="text-xs font-medium">Empty</span>
    </span>
  );
}

export const DocumentList = ({
  documents,
  onDelete,
}: {
  documents: Document[];
  onDelete: (id: string) => void;
}) => {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (doc: Document) => {
    setDeleting(doc.id);
    await workspaceService.deleteDocument(doc.id);
    onDelete(doc.id);
    setDeleting(null);
  };

  const processingCount = documents.filter((d) => d.status === 'processing').length;

  return (
    <div className="bg-surface border border-border rounded-xl p-6 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium text-text-primary">Knowledge Base</h3>
        {processingCount > 0 ? (
          <span className="text-xs text-primary font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            {processingCount} indexing
          </span>
        ) : (
          <span className="text-xs text-text-tertiary font-medium">
            {documents.length} files
          </span>
        )}
      </div>

      {documents.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-10">
          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
            <Upload className="w-5 h-5 text-text-secondary" />
          </div>
          <p className="text-sm text-text-secondary">No documents uploaded</p>
          <button
            onClick={() => navigate(ROUTES.RAG_AGENT)}
            className="px-4 py-2 border border-border text-text-secondary text-sm font-medium rounded-md hover:border-border-hover hover:text-text-primary hover:bg-white/5 transition-colors"
          >
            Upload to RAG Agent
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5 overflow-y-auto no-scrollbar">
          <AnimatePresence>
            {documents.map((doc, i) => {
              const Icon = getFileIcon(doc.file_type);
              const isDeleting = deleting === doc.id;

              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10, height: 0 }}
                  transition={{ delay: 0.05 * i }}
                  whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.02)' }}
                  className="flex items-center justify-between px-3 py-3 rounded-lg transition-all group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* File icon with status indicator */}
                    <div className={`h-10 w-10 rounded-md border flex items-center justify-center shrink-0 relative overflow-hidden ${doc.status === 'processing' ? 'border-primary/30 bg-primary/5' : 'border-border bg-background'}`}>
                      {doc.status === 'processing' && (
                        <motion.div
                          animate={{ x: ['-100%', '100%'] }}
                          transition={{ repeat: Infinity, duration: 1.8, ease: 'linear' }}
                          className="absolute inset-0 bg-primary/10"
                        />
                      )}
                      <Icon className={`w-4 h-4 relative z-10 ${doc.status === 'processing' ? 'text-primary' : doc.status === 'parsed' ? 'text-emerald-400' : 'text-text-tertiary'}`} />
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text-primary truncate leading-snug max-w-[280px]">
                        {doc.filename}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <StatusBadge status={doc.status} />
                        {doc.file_size && (
                          <span className="text-xs text-text-tertiary">
                            {workspaceService.formatFileSize(doc.file_size)}
                          </span>
                        )}
                        {doc.chunk_count ? (
                          <span className="text-xs text-text-tertiary">
                            {doc.chunk_count} chunks
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-xs text-text-tertiary hidden group-hover:block">
                      {workspaceService.timeAgo(doc.created_at)}
                    </span>
                    <button
                      onClick={() => handleDelete(doc)}
                      disabled={isDeleting}
                      className="text-white/10 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100 p-1.5 disabled:opacity-50"
                      title="Delete document"
                    >
                      {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
