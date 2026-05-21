import { type ReactNode } from 'react';

interface GoldBadgeProps {
  children: ReactNode;
  className?: string;
  pulse?: boolean;
  variant?: 'default' | 'outline' | 'solid';
}

export const GoldBadge = ({
  children,
  className = '',
  pulse = false,
  variant = 'default',
}: GoldBadgeProps) => {
  const variants = {
    default: 'bg-primary/10 text-primary border-primary/20',
    outline: 'bg-transparent text-primary border-primary/30',
    solid: 'bg-primary text-background border-primary',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-2 px-3 py-1 border text-[10px]
        uppercase tracking-[0.2em] font-semibold
        ${variants[variant]}
        ${pulse ? 'animate-pulse-soft' : ''}
        ${className}
      `}
    >
      {pulse && (
        <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(197,160,89,0.5)]" />
      )}
      {children}
    </span>
  );
};
