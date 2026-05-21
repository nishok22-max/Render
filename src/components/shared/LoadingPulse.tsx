import { motion } from 'motion/react';

interface LoadingPulseProps {
  lines?: number;
  className?: string;
}

export const LoadingPulse = ({ lines = 3, className = '' }: LoadingPulseProps) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0.05 }}
          animate={{ opacity: [0.05, 0.12, 0.05] }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.15 }}
          className="h-3 bg-white/5 rounded-sm"
          style={{ width: `${85 - i * 15}%` }}
        />
      ))}
    </div>
  );
};

export const LoadingDots = () => {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1, 0.8] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          className="w-1.5 h-1.5 rounded-full bg-primary"
        />
      ))}
    </div>
  );
};
