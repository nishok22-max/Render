import { type ReactNode } from 'react';

interface LuxuryLabelProps {
  children: ReactNode;
  className?: string;
  gold?: boolean;
  italic?: boolean;
}

export const LuxuryLabel = ({
  children,
  className = '',
  gold = false,
  italic = true,
}: LuxuryLabelProps) => {
  return (
    <span
      className={`
        tracking-[0.3em] uppercase text-[10px] font-semibold
        ${gold ? 'text-primary italic' : 'opacity-40'}
        ${italic ? 'italic' : ''}
        ${className}
      `}
    >
      {children}
    </span>
  );
};
