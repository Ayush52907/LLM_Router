'use client';

/**
 * CommentPanel — comment card with react button + reply textarea.
 * Adapted from uiverse.io form component for Notion B&W theme.
 * Used as: Route Inspector detail panel, subtask output viewer.
 */

import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { Lock, Cloud, HardDrive, CheckCircle, AlertTriangle } from 'lucide-react';

// ── Animations ─────────────────────────────────────────────────────────────────

const ripple = keyframes`
  0%   { transform: scale(0); opacity: 0.5; }
  100% { transform: scale(1); opacity: 0; }
`;

// ── Shell ─────────────────────────────────────────────────────────────────────

const Card = styled.div`
  width: 100%;
  background: #ffffff;
  border: 1px solid #e9e9e9;
  border-radius: 12px;
  overflow: hidden;
`;

const CardTitle = styled.div`
  height: 46px;
  display: flex;
  align-items: center;
  padding: 0 18px;
  border-bottom: 1px solid #f0f0f0;
  font-weight: 700;
  font-size: 13px;
  color: #1a1a1a;
  letter-spacing: 0.02em;
  position: relative;

  &::after {
    content: '';
    width: 6ch;
    height: 2px;
    position: absolute;
    bottom: -1px;
    left: 18px;
    background: #1a1a1a;
  }
`;

const TitleRight = styled.div`
  margin-left: auto;
  font-size: 10px;
  font-weight: 500;
  color: #9b9b9b;
  font-family: monospace;
`;

// ── Comment row ───────────────────────────────────────────────────────────────

const CommentGrid = styled.div`
  display: grid;
  grid-template-columns: 38px 1fr;
  gap: 14px;
  padding: 16px 18px;
`;

const ReactCol = styled.div`
  width: 38px;
  background: #f5f5f5;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const ReactBtn = styled.button`
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  position: relative;
  border-radius: 8px;

  &::after {
    content: '';
    width: 38px;
    height: 38px;
    position: absolute;
    background: #1a1a1a;
    border-radius: 50%;
    z-index: 0;
    transform: scale(0);
  }

  &:hover::after { animation: ${ripple} 0.5s ease-in-out forwards; }
  &:hover svg { color: #1a1a1a; }
`;

const Divider = styled.hr`
  width: 70%;
  height: 1px;
  background: #e0e0e0;
  border: none;
`;

const Count = styled.span`
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #6b6b6b;
`;

const ContentCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const UserRow = styled.div`
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 10px;
  align-items: center;
`;

const Avatar = styled.div`
  width: 36px;
  height: 36px;
  background: #f0f0f0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;

  &::after {
    content: '';
    width: 9px;
    height: 9px;
    position: absolute;
    right: 0; bottom: 0;
    border-radius: 50%;
    background: #1a1a1a;
    border: 2px solid #fff;
  }
`;

const UserInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const UserName = styled.span`
  font-weight: 700;
  font-size: 12px;
  color: #1a1a1a;
`;

const UserMeta = styled.p`
  font-size: 10px;
  color: #9b9b9b;
  font-weight: 500;
`;

const CommentBody = styled.p`
  font-size: 12px;
  line-height: 1.6;
  color: #4a4a4a;
  font-weight: 500;
`;

// ── Badges ────────────────────────────────────────────────────────────────────

const Badge = styled.span<{ $type?: 'pii' | 'local' | 'cloud' | 'escalated' | 'ok' | 'fail' | 'default' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid;
  letter-spacing: 0.03em;
  
  ${p => {
    switch (p.$type) {
      case 'pii':      return 'border-color:#1a1a1a; color:#1a1a1a; background:#f5f5f5;';
      case 'local':    return 'border-color:#1a1a1a; color:#1a1a1a; background:#f5f5f5;';
      case 'cloud':    return 'border-color:#d0d0d0; color:#6b6b6b; background:#fafafa;';
      case 'escalated':return 'border-color:#1a1a1a; color:#fff; background:#1a1a1a;';
      case 'ok':       return 'border-color:#1a1a1a; color:#1a1a1a; background:#f5f5f5;';
      case 'fail':     return 'border-color:#1a1a1a; color:#fff; background:#1a1a1a;';
      default:         return 'border-color:#e0e0e0; color:#6b6b6b; background:#fafafa;';
    }
  }}
`;

// ── Text-box / reply area ─────────────────────────────────────────────────────

const TextBox = styled.div`
  background: #f5f5f5;
  padding: 8px;
`;

const BoxInner = styled.div`
  background: #fff;
  border-radius: 8px;
  padding: 8px;
`;

const Textarea = styled.textarea`
  width: 100%;
  height: 36px;
  resize: none;
  border: none;
  border-radius: 4px;
  padding: 8px;
  font-size: 12px;
  outline: none;
  color: #1a1a1a;
  font-family: inherit;
  &::placeholder { color: #b0b0b0; }
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 4px;
`;

const ToolBtn = styled.button`
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #9b9b9b;
  &:hover { background: #f0f0f0; color: #1a1a1a; }
`;

const SendBtn = styled.button`
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a1a;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #fff;
  margin-left: auto;
  &:hover { background: #333; }
`;

// ── Props & exports ───────────────────────────────────────────────────────────

export interface SubtaskComment {
  id: string;
  title: string;
  meta: string;
  body: string;
  piiClass?: string | null;
  routedModel?: string | null;
  routedLocation?: 'cloud' | 'local' | null;
  jevConfidence?: number | null;
  verificationPass?: boolean | null;
  escalated?: boolean;
  escalatedFrom?: string | null;
}

interface CommentPanelProps {
  title: string;
  rightLabel?: string;
  comment?: SubtaskComment | null;
  emptyText?: string;
}

export const CommentPanel: React.FC<CommentPanelProps> = ({
  title, rightLabel, comment, emptyText = 'Select a subtask to inspect its route.',
}) => {
  const [reply, setReply] = useState('');

  const isPii = comment?.piiClass === 'raw_pii';

  return (
    <Card>
      <CardTitle>
        {title}
        {rightLabel && <TitleRight>{rightLabel}</TitleRight>}
      </CardTitle>

      {comment ? (
        <>
          <CommentGrid>
            {/* React column — shows jev confidence as "likes" */}
            <ReactCol>
              <ReactBtn title="Jev confidence">
                <svg fill="none" viewBox="0 0 24 24" width={15} height={15}>
                  <path
                    fill={comment.jevConfidence !== null && (comment.jevConfidence ?? 0) > 0.7 ? '#1a1a1a' : 'none'}
                    strokeLinecap="round" strokeWidth={2} stroke="#1a1a1a"
                    d="M19.4626 3.99415C16.7809 2.34923 14.4404 3.01211 13.0344 4.06801C12.4578 4.50096 12.1696 4.71743 12 4.71743C11.8304 4.71743 11.5422 4.50096 10.9656 4.06801C9.55962 3.01211 7.21909 2.34923 4.53744 3.99415C1.01807 6.15294 0.221721 13.2749 8.33953 19.2834C9.88572 20.4278 10.6588 21 12 21C13.3412 21 14.1143 20.4278 15.6605 19.2834C23.7783 13.2749 22.9819 6.15294 19.4626 3.99415Z"
                  />
                </svg>
              </ReactBtn>
              <Divider />
              <Count>{comment.jevConfidence !== null ? `${Math.round((comment.jevConfidence ?? 0) * 100)}` : '—'}</Count>
            </ReactCol>

            {/* Content column */}
            <ContentCol>
              <UserRow>
                <Avatar>
                  {isPii ? <Lock size={14} color="#1a1a1a" /> : (
                    comment.routedLocation === 'local'
                      ? <HardDrive size={14} color="#1a1a1a" />
                      : <Cloud size={14} color="#6b6b6b" />
                  )}
                </Avatar>
                <UserInfo>
                  <UserName style={{ fontFamily: 'monospace' }}>
                    {comment.routedModel ?? 'Unrouted'}
                  </UserName>
                  <UserMeta>{comment.meta}</UserMeta>
                </UserInfo>
              </UserRow>

              {/* Badge row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {isPii && (
                  <Badge $type="pii">
                    <Lock size={8} /> Forced local (PII)
                  </Badge>
                )}
                {comment.routedLocation && !isPii && (
                  <Badge $type={comment.routedLocation === 'local' ? 'local' : 'cloud'}>
                    {comment.routedLocation === 'local' ? <HardDrive size={8} /> : <Cloud size={8} />}
                    {comment.routedLocation}
                  </Badge>
                )}
                {comment.escalated && (
                  <Badge $type="escalated">
                    <AlertTriangle size={8} /> escalated from {comment.escalatedFrom}
                  </Badge>
                )}
                {comment.verificationPass !== null && comment.verificationPass !== undefined && (
                  <Badge $type={comment.verificationPass ? 'ok' : 'fail'}>
                    <CheckCircle size={8} /> {comment.verificationPass ? 'Verified' : 'Verify failed'}
                  </Badge>
                )}
              </div>

              <CommentBody>{comment.body}</CommentBody>
            </ContentCol>
          </CommentGrid>

          <TextBox>
            <BoxInner>
              <Textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                placeholder="Add a note about this route decision…"
              />
              <Toolbar>
                {/* Formatting buttons — B/I/U */}
                {['B', 'I', 'U'].map(f => (
                  <ToolBtn key={f} type="button">
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{f}</span>
                  </ToolBtn>
                ))}
                <SendBtn type="button" onClick={() => setReply('')} title="Send">
                  <svg fill="none" viewBox="0 0 24 24" width={14} height={14}>
                    <path strokeLinejoin="round" strokeLinecap="round" strokeWidth={2.5} stroke="#fff" d="M12 5L12 20" />
                    <path strokeLinejoin="round" strokeLinecap="round" strokeWidth={2.5} stroke="#fff" d="M7 9L12 4L17 9" />
                  </svg>
                </SendBtn>
              </Toolbar>
            </BoxInner>
          </TextBox>
        </>
      ) : (
        <div style={{ padding: '32px 18px', color: '#9b9b9b', fontSize: 13, textAlign: 'center' }}>
          {emptyText}
        </div>
      )}
    </Card>
  );
};
