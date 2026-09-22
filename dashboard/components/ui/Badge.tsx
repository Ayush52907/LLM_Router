'use client';

import React from 'react';

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'info' | 'local' | 'cloud' | 'outline';
export type BadgeSize = 'sm' | 'md';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  neutral: {
    bg: '#f4f4f5',
    text: '#52525b',
    border: '#e4e4e7',
  },
  success: {
    bg: '#ecfdf5',
    text: '#047857',
    border: '#a7f3d0',
  },
  warning: {
    bg: '#fffbeb',
    text: '#b45309',
    border: '#fde68a',
  },
  info: {
    bg: '#eff6ff',
    text: '#1d4ed8',
    border: '#bfdbfe',
  },
  local: {
    bg: '#f0fdf4',
    text: '#15803d',
    border: '#bbf7d0',
  },
  cloud: {
    bg: '#f8fafc',
    text: '#334155',
    border: '#cbd5e1',
  },
  outline: {
    bg: 'transparent',
    text: '#71717a',
    border: '#e4e4e7',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  icon,
  children,
  className = '',
  style,
  ...props
}) => {
  const v = variantStyles[variant] || variantStyles.neutral;
  const isSm = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium select-none transition-colors ${className}`}
      style={{
        backgroundColor: v.bg,
        color: v.text,
        border: `1px solid ${v.border}`,
        borderRadius: '6px',
        padding: isSm ? '1px 6px' : '2px 8px',
        fontSize: isSm ? '11px' : '12px',
        lineHeight: '1.4',
        ...style,
      }}
      {...props}
    >
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
