import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { type ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export const Modal = ({ isOpen, onClose, title, children, className = '' }: ModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`
              fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101]
              bg-surface/95 border border-white/10 backdrop-blur-2xl shadow-2xl
              min-w-[400px] max-w-[640px] w-full max-h-[80vh] overflow-hidden
              ${className}
            `}
          >
            {title && (
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <h3 className="font-serif text-xl text-white italic">{title}</h3>
                <button
                  onClick={onClose}
                  className="text-white/30 hover:text-primary transition-colors p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
