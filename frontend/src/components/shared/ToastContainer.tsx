import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useEffect } from 'react';
import { useUIStore, type Toast } from '../../store/uiStore';

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const colors = {
  success: 'border-green-500/30 text-green-400',
  error: 'border-red-500/30 text-red-400',
  info: 'border-primary/30 text-primary',
  warning: 'border-yellow-500/30 text-yellow-400',
};

const ToastItem = ({ toast }: { toast: Toast }) => {
  const removeToast = useUIStore((s) => s.removeToast);
  const Icon = icons[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, toast.duration || 5000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, removeToast]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      className={`
        flex items-start gap-3 p-4 bg-surface/95 border backdrop-blur-xl
        shadow-2xl min-w-[320px] max-w-[420px]
        ${colors[toast.type]}
      `}
    >
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium">{toast.title}</div>
        {toast.message && (
          <div className="text-white/50 text-xs mt-1">{toast.message}</div>
        )}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="text-white/20 hover:text-white/60 transition-colors shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
};

export const ToastContainer = () => {
  const toasts = useUIStore((s) => s.toasts);

  return (
    <div className="fixed top-6 right-6 z-[200] flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
};
