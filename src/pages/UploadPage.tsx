import { motion, AnimatePresence } from 'motion/react';
import { useState, useCallback } from 'react';
import { Upload, FileText, Image, Database, Code2, X, RefreshCw, CheckCircle, AlertCircle, Archive } from 'lucide-react';
import { useUploadStore, type UploadFile } from '../store/uploadStore';
import { useUIStore } from '../store/uiStore';
import { uploadService } from '../services/uploadService';
import { getFileCategory, formatFileSize, getFileExtension } from '../utils/fileUtils';
import { LuxuryLabel } from '../components/shared/LuxuryLabel';

const FileTypeIcon = ({ category }: { category: string }) => {
  const icons: Record<string, typeof FileText> = { image: Image, document: FileText, dataset: Database, code: Code2, compressed: Archive };
  const Icon = icons[category] || FileText;
  return <Icon className="w-5 h-5" />;
};

const FileCard = ({ file }: { file: UploadFile }) => {
  const { removeFile, retryFile } = useUploadStore();
  const statusColors: Record<string, string> = { queued: 'text-white/30', uploading: 'text-primary', processing: 'text-primary', parsed: 'text-green-400', error: 'text-red-400' };

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
      className="bg-white/[0.03] border border-white/5 p-5 group hover:bg-white/[0.05] transition-all relative overflow-hidden">
      {(file.status === 'uploading' || file.status === 'processing') && (
        <motion.div animate={{ x: ['-100%', '200%'] }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
          className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
      )}
      <div className="flex items-start gap-4 relative z-10">
        <div className={`w-12 h-12 border border-white/10 flex items-center justify-center ${file.status === 'parsed' ? 'text-green-400/60' : file.status === 'error' ? 'text-red-400/60' : 'text-white/20'}`}>
          <FileTypeIcon category={file.category} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-medium truncate mb-1">{file.filename}</div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-wider text-white/30">{formatFileSize(file.size)}</span>
            <span className={`text-[10px] uppercase tracking-wider ${statusColors[file.status]} flex items-center gap-1.5`}>
              {(file.status === 'uploading' || file.status === 'processing') && <RefreshCw className="w-3 h-3 animate-spin" />}
              {file.status === 'parsed' && <CheckCircle className="w-3 h-3" />}
              {file.status === 'error' && <AlertCircle className="w-3 h-3" />}
              {file.status}
            </span>
          </div>
          {file.status === 'uploading' && (
            <div className="mt-3 h-[2px] w-full bg-white/5 overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${file.progress}%` }} className="h-full bg-primary" />
            </div>
          )}
          {file.error && <div className="text-red-400/70 text-xs mt-2">{file.error}</div>}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {file.status === 'error' && <button onClick={() => retryFile(file.id)} className="p-1.5 text-white/20 hover:text-primary"><RefreshCw className="w-3.5 h-3.5" /></button>}
          <button onClick={() => removeFile(file.id)} className="p-1.5 text-white/20 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </motion.div>
  );
};

export const UploadPage = () => {
  const { files, addFiles, updateFile, setUploading } = useUploadStore();
  const addToast = useUIStore((s) => s.addToast);
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const newFiles: UploadFile[] = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(), file, filename: file.name, fileType: getFileExtension(file.name),
      size: file.size, category: getFileCategory(file.name), status: 'queued' as const, progress: 0,
    }));
    addFiles(newFiles);
    setUploading(true);
    for (const uf of newFiles) {
      updateFile(uf.id, { status: 'uploading' });
      try {
        const response = await uploadService.uploadFile(uf.file, (progress) => updateFile(uf.id, { progress }));
        updateFile(uf.id, { status: 'processing', progress: 100, documentId: response.document_id });
        setTimeout(() => updateFile(uf.id, { status: 'parsed' }), 2000);
        addToast({ type: 'success', title: 'Uploaded', message: uf.filename });
      } catch (err: any) {
        updateFile(uf.id, { status: 'error', error: err.message || 'Upload failed' });
        addToast({ type: 'error', title: 'Upload Failed', message: uf.filename });
      }
    }
    setUploading(false);
  }, [addFiles, updateFile, setUploading, addToast]);

  return (
    <div className="p-12 lg:p-16 xl:p-20">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <LuxuryLabel gold className="mb-6 block">File Processing Center</LuxuryLabel>
        <h2 className="font-serif text-5xl text-white italic tracking-tight mb-4">Upload & <span className="gold-text">Analyze</span></h2>
        <p className="text-white/30 text-sm max-w-lg mb-12">Drop files to ingest into the knowledge base. Documents are parsed, chunked, embedded, and stored for semantic retrieval.</p>
      </motion.div>

      <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files); }}
        className={`relative border-2 border-dashed transition-all duration-500 p-16 text-center cursor-pointer mb-12 ${isDragging ? 'border-primary/60 bg-primary/5' : 'border-white/10 bg-white/[0.02] hover:border-white/20'}`}
        onClick={() => document.getElementById('file-input')?.click()}>
        <input id="file-input" type="file" multiple className="hidden" onChange={(e) => e.target.files?.length && processFiles(e.target.files)}
          accept=".png,.jpg,.jpeg,.webp,.bmp,.tiff,.tif,.gif,.pdf,.docx,.txt,.md,.csv,.xlsx,.xls,.xlsm,.xlsb,.json,.jsonl,.ndjson,.xml,.yaml,.yml,.py,.java,.js,.ts,.c,.cpp,.html,.css,.sql,.zip,.tsv,.psv,.dat,.sqlite,.db,.parquet,.orc,.avro,.feather,.arrow,.hdf5,.h5,.mat,.pkl,.pickle,.joblib,.npy,.npz" />
        <div className={`w-16 h-16 mx-auto mb-6 rounded-full border flex items-center justify-center ${isDragging ? 'border-primary/40 bg-primary/10' : 'border-white/10'}`}>
          <Upload className={`w-6 h-6 ${isDragging ? 'text-primary' : 'text-white/20'}`} />
        </div>
        <div className="font-serif text-2xl text-white italic mb-3">{isDragging ? 'Release to upload' : 'Drop files here'}</div>
        <div className="text-white/30 text-xs uppercase tracking-wider">Images • Documents • Datasets • Code • Archives</div>
      </div>

      {files.length > 0 && (
        <div>
          <LuxuryLabel className="mb-6 block">Uploaded Files ({files.length})</LuxuryLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            <AnimatePresence>{files.map((f) => <FileCard key={f.id} file={f} />)}</AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
};
