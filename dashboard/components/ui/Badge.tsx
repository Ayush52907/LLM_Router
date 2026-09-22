'use client';

import React from 'react';

export type BadgeVariant = 'neutral' | 'dark' | 'outline' | 'subtle' | 'success' | 'warning' | 'info' | 'local' | 'cloud';
export type BadgeSize = 'sm' | 'md';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  neutral: {
    bg: '#f5f5f7',
    text: '#1d1d1f',
    border: '#e5e5e7',
  },
  dark: {
    bg: '#1d1d1f',
    text: '#ffffff',
    border: '#1d1d1f',
  },
  outline: {
    bg: 'transparent',
    text: '#6e6e73',
    border: '#d2d2d7',
  },
  subtle: {
    bg: '#f5f5f7',
    text: '#6e6e73',
    border: 'transparent',
  },
  success: {
    bg: '#f0fdf4',
    text: '#166534',
    border: '#bbf7d0',
  },
  warning: {
    bg: '#fffbeb',
    text: '#92400e',
    border: '#fde68a',
  },
  info: {
    bg: '#eff6ff',
    text: '#1e40af',
    border: '#bfdbfe',
  },
  local: {
    bg: '#f0fdf4',
    text: '#15803d',
    border: '#86efac',
  },
  cloud: {
    bg: '#f0f9ff',
    text: '#0369a1',
    border: '#bae6fd',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'sm',
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
      className={`inline-flex items-center gap-1.5 font-medium select-none tracking-tight ${className}`}
      style={{
        backgroundColor: v.bg,
        color: v.text,
        border: `1px solid ${v.border}`,
        borderRadius: '9999px',
        padding: isSm ? '2px 8px' : '4px 10px',
        fontSize: isSm ? '11px' : '12px',
        lineHeight: '1.2',
        ...style,
      }}
      {...props}
    >
      {icon && <span className="inline-flex shrink-0 opacity-80">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
