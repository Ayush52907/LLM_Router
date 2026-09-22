'use client';

/**
 * NotionButton — pill button with expanding black fill on hover.
 * Based on uiverse.io type1 button. B&W variant for Notion theme.
 */

import React from 'react';
import styled from 'styled-components';

const Btn = styled.button`
  height: 42px;
  min-width: 160px;
  padding: 0 24px;
  position: relative;
  background-color: transparent;
  cursor: pointer;
  border: 1.5px solid #1a1a1a;
  overflow: hidden;
  border-radius: 30px;
  color: #1a1a1a;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  transition: color 0.45s ease-in-out, border-color 0.45s ease-in-out;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%) scale(0);
    width: 10px;
    height: 10px;
    background: #1a1a1a;
    border-radius: 50%;
    z-index: 0;
    transition: transform 0.5s ease-in-out, opacity 0.5s ease-in-out;
    opacity: 0.7;
  }

  &:hover {
    color: #fff;
    border-color: transparent;
    box-shadow: 0 2px 16px rgba(0,0,0,0.18);
  }

  &:hover::after {
    transform: translate(-50%, -50%) scale(22);
    opacity: 1;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  &:disabled:hover { color: #1a1a1a; border-color: #1a1a1a; box-shadow: none; }
  &:disabled::after { display: none; }

  span {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 7px;
  }
`;

interface NotionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const NotionButton: React.FC<NotionButtonProps> = ({ children, ...props }) => (
  <Btn {...props}>
    <span>{children}</span>
  </Btn>
);
