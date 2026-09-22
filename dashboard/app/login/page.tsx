'use client';

import React, { useState, useRef, useEffect } from 'react';
import { setSession, isAuthenticated, getToken } from '../../lib/auth';
import { Mail, ArrowRight, CheckCircle2, ArrowLeft, ShieldCheck, RefreshCw, KeyRound, Sparkles } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || 'http://localhost:3001';

type Step = 'email' | 'otp' | 'success';

export default function LoginPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  // If already authenticated, redirect to / immediately
  useEffect(() => {
    if (isAuthenticated()) {
      window.location.href = '/';
    }
  }, []);

  // Autofocus email input on mount
  useEffect(() => {
    if (step === 'email') {
      setTimeout(() => emailInputRef.current?.focus(), 50);
    } else if (step === 'otp') {
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    }
  }, [step]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // ── Step 1: Request OTP from Backend ───────────────────────────────────────

  async function handleRequestOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      setResendCountdown(60);
      setStep('otp');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Server unreachable. Ensure orchestrator is running.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Verify OTP with Backend ────────────────────────────────────────

  async function handleVerifyOtp(codeToVerify?: string) {
    const code = codeToVerify || otp.join('');
    if (code.length !== 6) {
      setError('Please enter all 6 digits.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: code,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Verification failed. Please try again.');
      }

      // Persist session
      setSession(data.token, data.email || email, data.expiresAt);
      setStep('success');

      // Seamless transition to mission control
      setTimeout(() => {
        window.location.href = '/';
      }, 900);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed.';
      setError(msg);
      // Clear OTP inputs on error for rapid retry
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } finally {
      setLoading(false);
    }
  }

  // ── Digit Input Navigation & Paste Helpers ─────────────────────────────────

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const nextOtp = [...otp];
    nextOtp[index] = digit;
    setOtp(nextOtp);
    setError(null);

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all 6 digits are provided
    if (digit && index === 5 && nextOtp.every(Boolean)) {
      setTimeout(() => {
        handleVerifyOtp(nextOtp.join(''));
      }, 50);
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const digits = pasted.split('');
      setOtp(digits);
      otpRefs.current[5]?.focus();
      setTimeout(() => {
        handleVerifyOtp(pasted);
      }, 50);
    }
  }

  return (
    <div className="min-h-screen bg-black text-neutral-100 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Subtle ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-neutral-800/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-neutral-900/20 blur-[100px] rounded-full pointer-events-none" />

      {/* Brand Header */}
      <div className="mb-8 text-center relative z-10">
        <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-[#121212] border border-[#262626] mb-4">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-300">
            EcoRouter Dispatch
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-1.5">
          Mission Control Access
        </h1>
        <p className="text-xs text-neutral-400 max-w-sm">
          Carbon- and Latency-Aware Multi-LLM Workflow Orchestration
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-[#0a0a0a] border border-[#262626] rounded-2xl p-7 shadow-2xl relative z-10 backdrop-blur-md">
        
        {/* STEP 1: Email Entry */}
        {step === 'email' && (
          <form onSubmit={handleRequestOtp} className="space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <KeyRound className="w-4 h-4 text-white" />
                <h2 className="text-sm font-semibold text-white tracking-wide">Sign In</h2>
              </div>
              <p className="text-xs text-neutral-400">
                Enter your work email address. We will generate and dispatch a secure 6-digit OTP.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="email-input" className="block text-xs font-medium text-neutral-300">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="email-input"
                  ref={emailInputRef}
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  placeholder="operator@organization.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#262626] bg-[#121212] text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-all font-mono"
                />
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/60 rounded-xl px-3.5 py-2.5 flex items-start gap-2">
                <span className="text-red-400 font-bold">!</span>
                <span className="leading-snug">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-semibold tracking-wide flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Dispatching OTP...</span>
                </>
              ) : (
                <>
                  <span>Send Verification Code</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            {/* Dev helper pill */}
            <div className="pt-2 border-t border-[#1f1f1f] flex items-center justify-between text-[11px] text-neutral-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
                Zero raw PII leaves machine
              </span>
              <button
                type="button"
                onClick={() => {
                  setEmail('operator@ecorouter.local');
                  setError(null);
                }}
                className="text-neutral-400 hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
              >
                Use local demo email
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: OTP Verification */}
        {step === 'otp' && (
          <form onSubmit={(e) => { e.preventDefault(); handleVerifyOtp(); }} className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-white tracking-wide">Enter 6-Digit Code</h2>
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setOtp(['', '', '', '', '', '']);
                    setError(null);
                  }}
                  className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Change
                </button>
              </div>
              <p className="text-xs text-neutral-400">
                Dispatched to <span className="text-white font-mono font-medium">{email}</span>
              </p>
            </div>

            {/* Backend Orchestration Dispatch Notice */}
            <div className="p-3 rounded-xl bg-[#121212] border border-[#262626] text-xs flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-white shrink-0 mt-0.5" />
              <div className="text-neutral-400 text-[11px] leading-relaxed">
                OTP dispatched. Please retrieve the 6-digit code from the <strong className="text-white font-medium">backend orchestration terminal</strong> or your email.
              </div>
            </div>

            {/* 6 Digit Input Boxes */}
            <div className="flex gap-2 justify-between" onPaste={handleOtpPaste}>
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => { otpRefs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  className={`w-11 h-13 text-center text-lg font-mono font-bold rounded-xl border bg-[#121212] text-white transition-all caret-transparent focus:outline-none ${
                    digit
                      ? 'border-neutral-400 bg-neutral-900/60 ring-1 ring-neutral-400/20'
                      : 'border-[#262626] focus:border-white focus:ring-1 focus:ring-white/20'
                  }`}
                />
              ))}
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/60 rounded-xl px-3.5 py-2.5 flex items-start gap-2">
                <span className="text-red-400 font-bold">!</span>
                <span className="leading-snug">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || otp.some((d) => !d)}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-semibold tracking-wide flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Validating Credentials...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verify & Sign In</span>
                </>
              )}
            </button>

            {/* Resend Action */}
            <div className="flex items-center justify-between text-xs text-neutral-500 pt-1">
              <span>Code expires in 10 minutes</span>
              <button
                type="button"
                onClick={() => handleRequestOtp()}
                disabled={resendCountdown > 0 || loading}
                className="text-neutral-400 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Authenticated Success */}
        {step === 'success' && (
          <div className="py-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center mx-auto shadow-lg shadow-white/10 animate-bounce">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Access Granted
            </h2>
            <p className="text-xs text-neutral-400 font-mono">
              Redirecting to EcoRouter Mission Control...
            </p>
          </div>
        )}

      </div>

      {/* Bottom Security Disclosures */}
      <div className="mt-8 text-center text-[11px] text-neutral-500 max-w-sm space-y-1">
        <p>Session valid for 30 minutes. Protected by constant-time verification.</p>
        <p className="text-neutral-600 font-mono text-[10px]">EcoRouter v1.0.0 · Bangalore Local Zone IN-KA</p>
      </div>
    </div>
  );
}
