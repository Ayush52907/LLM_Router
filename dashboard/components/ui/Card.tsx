'use client';

import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  hoverable = false,
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
        backgroundColor: '#ffffff',
        border: `1px solid ${hoverable && isHovered ? '#d4d4d8' : '#eaeaea'}`,
        borderRadius: '14px',
        boxShadow: hoverable && isHovered
          ? '0 6px 20px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.02)'
          : '0 1px 4px rgba(0, 0, 0, 0.02)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
