'use client';

import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  subtle?: boolean;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  hoverable = false,
  subtle = false,
  children,
  className = '',
  style,
  ...props
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      onMouseEnter={() => hoverable && setIsHovered(true)}
      onMouseLeave={() => hoverable && setIsHovered(false)}
      className={`transition-all duration-200 ${className}`}
      style={{
        backgroundColor: subtle ? '#f5f5f7' : '#ffffff',
        border: `1px solid ${hoverable && isHovered ? '#d2d2d7' : '#e5e5e7'}`,
        borderRadius: '18px',
        boxShadow: hoverable && isHovered
          ? '0 6px 18px rgba(0, 0, 0, 0.05)'
          : subtle ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.02)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
