'use client';

import React from 'react';

interface CenterFlowProps {
  className?: string;
  intensity?: 'subtle' | 'normal' | 'vibrant';
  children?: React.ReactNode;
}

// Precalculated rounded spoke coordinates to prevent floating point SSR/client hydration differences
const SPOKES = Array.from({ length: 12 }, (_, i) => {
  const angle = (i * 30 * Math.PI) / 180;
  return {
    x1: Math.round((400 + Math.cos(angle) * 70) * 10) / 10,
    y1: Math.round((400 + Math.sin(angle) * 70) * 10) / 10,
    x2: Math.round((400 + Math.cos(angle) * 360) * 10) / 10,
    y2: Math.round((400 + Math.sin(angle) * 360) * 10) / 10,
  };
});

export const CenterFlow: React.FC<CenterFlowProps> = ({
  className = '',
  intensity = 'subtle',
  children,
}) => {
  const opacityMap = {
    subtle: 0.18,
    normal: 0.35,
    vibrant: 0.6,
  };

  const baseOpacity = opacityMap[intensity];

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Background radial flowing animation */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center -z-10 select-none overflow-hidden"
        style={{ opacity: baseOpacity }}
      >
        <svg
          className="w-[800px] h-[800px] max-w-none transform -translate-y-6"
          viewBox="0 0 800 800"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="centerGlow" cx="400" cy="400" r="400" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#18181b" stopOpacity="0.12" />
              <stop offset="50%" stopColor="#71717a" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="flowBeam" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#18181b" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#a1a1aa" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Central glow */}
          <circle cx="400" cy="400" r="380" fill="url(#centerGlow)" />

          {/* Concentric radial rings flowing outward */}
          <circle
            cx="400"
            cy="400"
            r="80"
            stroke="#18181b"
            strokeWidth="1.2"
            strokeDasharray="4 6"
            className="animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite]"
            style={{ transformOrigin: 'center' }}
          />
          <circle
            cx="400"
            cy="400"
            r="160"
            stroke="#18181b"
            strokeWidth="1"
            strokeDasharray="3 8"
            className="animate-[ping_6s_cubic-bezier(0,0,0.2,1)_infinite_1s]"
            style={{ transformOrigin: 'center' }}
          />
          <circle
            cx="400"
            cy="400"
            r="240"
            stroke="#71717a"
            strokeWidth="0.8"
            strokeDasharray="2 10"
            className="animate-[ping_8s_cubic-bezier(0,0,0.2,1)_infinite_2s]"
            style={{ transformOrigin: 'center' }}
          />
          <circle
            cx="400"
            cy="400"
            r="320"
            stroke="#a1a1aa"
            strokeWidth="0.6"
            strokeDasharray="1 12"
            className="animate-[ping_10s_cubic-bezier(0,0,0.2,1)_infinite_3s]"
            style={{ transformOrigin: 'center' }}
          />

          {/* Static reference rings */}
          <circle cx="400" cy="400" r="100" stroke="#e4e4e7" strokeWidth="1" />
          <circle cx="400" cy="400" r="180" stroke="#e4e4e7" strokeWidth="1" strokeDasharray="2 4" />
          <circle cx="400" cy="400" r="260" stroke="#f4f4f5" strokeWidth="1" />
          <circle cx="400" cy="400" r="340" stroke="#f4f4f5" strokeWidth="1" strokeDasharray="4 8" />

          {/* Subtle radial spoke lines */}
          {SPOKES.map((spoke, i) => (
            <line
              key={i}
              x1={spoke.x1}
              y1={spoke.y1}
              x2={spoke.x2}
              y2={spoke.y2}
              stroke="#e4e4e7"
              strokeWidth="0.8"
              strokeDasharray="4 12"
            />
          ))}
        </svg>
      </div>

      {children}
    </div>
  );
};
