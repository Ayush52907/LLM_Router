'use client';

import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  loading?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, { bg: string; text: string; border: string; hoverBg: string; hoverBorder: string }> = {
  primary: {
    bg: '#18181b',
    text: '#ffffff',
    border: '#18181b',
    hoverBg: '#27272a',
    hoverBorder: '#27272a',
  },
  secondary: {
    bg: '#f4f4f5',
    text: '#18181b',
    border: '#e4e4e7',
    hoverBg: '#e4e4e7',
    hoverBorder: '#d4d4d8',
  },
  outline: {
    bg: '#ffffff',
    text: '#3f3f46',
    border: '#e4e4e7',
    hoverBg: '#f4f4f5',
    hoverBorder: '#d4d4d8',
  },
  ghost: {
    bg: 'transparent',
    text: '#52525b',
    border: 'transparent',
    hoverBg: '#f4f4f5',
    hoverBorder: 'transparent',
  },
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  children,
  className = '',
  style,
  ...props
}) => {
  const v = variantStyles[variant] || variantStyles.primary;
  const [isHovered, setIsHovered] = React.useState(false);

  const paddingMap = {
    sm: '4px 10px',
    md: '8px 16px',
    lg: '12px 24px',
  };

  const fontMap = {
    sm: '12px',
    md: '13px',
    lg: '15px',
  };

  return (
    <button
      disabled={disabled || loading}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`inline-flex items-center justify-center gap-2 font-medium select-none cursor-pointer transition-all duration-150 disabled:opacity-45 disabled:cursor-not-allowed ${className}`}
      style={{
        backgroundColor: isHovered && !disabled && !loading ? v.hoverBg : v.bg,
        color: v.text,
        border: `1px solid ${isHovered && !disabled && !loading ? v.hoverBorder : v.border}`,
        borderRadius: '10px',
        padding: paddingMap[size],
        fontSize: fontMap[size],
        lineHeight: '1.4',
        boxShadow: variant === 'primary' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : icon ? (
        <span className="inline-flex shrink-0">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
};
