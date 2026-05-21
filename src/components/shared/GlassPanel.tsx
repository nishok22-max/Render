import { motion, type HTMLMotionProps } from 'motion/react';
import { type ReactNode } from 'react';

interface GlassPanelProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  atmospheric?: boolean;
}

export const GlassPanel = ({
  children,
  className = '',
  hover = false,
  atmospheric = false,
  ...props
}: GlassPanelProps) => {
  return (
    <motion.div
      whileHover={hover ? { y: -2, scale: 1.005 } : undefined}
      className={`
        bg-white/[0.03] border border-white/10 backdrop-blur-xl
        ${atmospheric ? 'shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)]' : 'shadow-2xl'}
        ${className}
      `}
      {...props}
    >
      {children}
    </motion.div>
  );
};
