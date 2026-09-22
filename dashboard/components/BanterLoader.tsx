'use client';

/**
 * BanterLoader — 3×3 grid of animated boxes.
 * Adapted for Notion B&W theme: black boxes on white background.
 * Original: uiverse.io banter-loader concept.
 */

import React from 'react';
import styled, { keyframes } from 'styled-components';

// ── 9 unique keyframe animations ──────────────────────────────────────────────

const moveBox1 = keyframes`
  9.09%   { transform: translate(-26px,0) }
  18.18%  { transform: translate(0,0) }
  27.27%  { transform: translate(0,0) }
  36.36%  { transform: translate(26px,0) }
  45.45%  { transform: translate(26px,26px) }
  63.63%  { transform: translate(26px,26px) }
  72.72%  { transform: translate(26px,0) }
  81.81%  { transform: translate(0,0) }
  90.90%  { transform: translate(-26px,0) }
  100%    { transform: translate(0,0) }
`;
const moveBox2 = keyframes`
  9.09%   { transform: translate(0,0) }
  18.18%  { transform: translate(26px,0) }
  27.27%  { transform: translate(0,0) }
  36.36%  { transform: translate(26px,0) }
  45.45%  { transform: translate(26px,26px) }
  63.63%  { transform: translate(26px,26px) }
  72.72%  { transform: translate(26px,26px) }
  81.81%  { transform: translate(0,26px) }
  90.90%  { transform: translate(0,26px) }
  100%    { transform: translate(0,0) }
`;
const moveBox3 = keyframes`
  9.09%   { transform: translate(-26px,0) }
  18.18%  { transform: translate(-26px,0) }
  27.27%  { transform: translate(0,0) }
  36.36%  { transform: translate(-26px,0) }
  63.63%  { transform: translate(-26px,0) }
  72.72%  { transform: translate(-26px,0) }
  81.81%  { transform: translate(-26px,-26px) }
  90.90%  { transform: translate(0,-26px) }
  100%    { transform: translate(0,0) }
`;
const moveBox4 = keyframes`
  9.09%   { transform: translate(-26px,0) }
  18.18%  { transform: translate(-26px,0) }
  27.27%  { transform: translate(-26px,-26px) }
  36.36%  { transform: translate(0,-26px) }
  45.45%  { transform: translate(0,0) }
  54.54%  { transform: translate(0,-26px) }
  72.72%  { transform: translate(0,-26px) }
  81.81%  { transform: translate(-26px,-26px) }
  90.90%  { transform: translate(-26px,0) }
  100%    { transform: translate(0,0) }
`;
const moveBox5 = keyframes`
  36.36%  { transform: translate(26px,0) }
  72.72%  { transform: translate(26px,0) }
  81.81%  { transform: translate(26px,-26px) }
  90.90%  { transform: translate(0,-26px) }
  100%    { transform: translate(0,0) }
`;
const moveBox6 = keyframes`
  18.18%  { transform: translate(-26px,0) }
  27.27%  { transform: translate(-26px,0) }
  36.36%  { transform: translate(0,0) }
  63.63%  { transform: translate(0,0) }
  72.72%  { transform: translate(0,26px) }
  81.81%  { transform: translate(-26px,26px) }
  90.90%  { transform: translate(-26px,0) }
  100%    { transform: translate(0,0) }
`;
const moveBox7 = keyframes`
  9.09%   { transform: translate(26px,0) }
  27.27%  { transform: translate(26px,0) }
  36.36%  { transform: translate(0,0) }
  45.45%  { transform: translate(0,-26px) }
  54.54%  { transform: translate(26px,-26px) }
  63.63%  { transform: translate(0,-26px) }
  72.72%  { transform: translate(0,-26px) }
  81.81%  { transform: translate(0,0) }
  90.90%  { transform: translate(26px,0) }
  100%    { transform: translate(0,0) }
`;
const moveBox8 = keyframes`
  18.18%  { transform: translate(-26px,0) }
  27.27%  { transform: translate(-26px,-26px) }
  36.36%  { transform: translate(0,-26px) }
  54.54%  { transform: translate(0,-26px) }
  72.72%  { transform: translate(0,-26px) }
  81.81%  { transform: translate(26px,-26px) }
  90.90%  { transform: translate(26px,0) }
  100%    { transform: translate(0,0) }
`;
const moveBox9 = keyframes`
  9.09%   { transform: translate(-26px,0) }
  18.18%  { transform: translate(-26px,0) }
  27.27%  { transform: translate(0,0) }
  36.36%  { transform: translate(-26px,0) }
  45.45%  { transform: translate(0,0) }
  63.63%  { transform: translate(-26px,0) }
  72.72%  { transform: translate(-26px,0) }
  81.81%  { transform: translate(-52px,0) }
  90.90%  { transform: translate(-26px,0) }
  100%    { transform: translate(0,0) }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  gap: 24px;
`;

const Grid = styled.div`
  position: relative;
  width: 72px;
  height: 72px;
`;

const Box = styled.div<{ $n: number }>`
  float: left;
  position: relative;
  width: 20px;
  height: 20px;
  margin-right: 6px;

  &:nth-child(3n)   { margin-right: 0; margin-bottom: 6px; }
  &:last-child      { margin-bottom: 0; }

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: #1a1a1a;
  }

  &:nth-child(1)::before,
  &:nth-child(4)::before { margin-left: 26px; }
  &:nth-child(3)::before { margin-top: 52px; }

  &:nth-child(1) { animation: ${moveBox1} 4s infinite; }
  &:nth-child(2) { animation: ${moveBox2} 4s infinite; }
  &:nth-child(3) { animation: ${moveBox3} 4s infinite; }
  &:nth-child(4) { animation: ${moveBox4} 4s infinite; }
  &:nth-child(5) { animation: ${moveBox5} 4s infinite; }
  &:nth-child(6) { animation: ${moveBox6} 4s infinite; }
  &:nth-child(7) { animation: ${moveBox7} 4s infinite; }
  &:nth-child(8) { animation: ${moveBox8} 4s infinite; }
  &:nth-child(9) { animation: ${moveBox9} 4s infinite; }
`;

const Label = styled.p`
  font-size: 13px;
  color: #6b6b6b;
  letter-spacing: 0.02em;
  font-weight: 500;
`;

interface BanterLoaderProps {
  label?: string;
}

export const BanterLoader: React.FC<BanterLoaderProps> = ({ label = 'Running pipeline…' }) => (
  <Overlay>
    <Grid>
      {Array.from({ length: 9 }).map((_, i) => <Box key={i} $n={i + 1} />)}
    </Grid>
    <Label>{label}</Label>
  </Overlay>
);
