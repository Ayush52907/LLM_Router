'use client';

/**
 * Login Page — OTP-based email authentication.
 *
 * Step 1: User enters email → POST /api/auth/request-otp
 * Step 2: User enters 6-digit OTP → POST /api/auth/verify-otp
 *         → stores token in sessionStorage → redirects to /
 */

import React, { useState, useRef, useEffect } from 'react';
import { setToken, isAuthenticated } from '../../lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? 'http://localhost:3001';

type Step = 'email' | 'otp' | 'success';

export default function LoginPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Already authenticated → redirect immediately
  useEffect(() => {
    if (isAuthenticated()) {
      window.location.href = '/';
    }
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  // ── Step 1: Request OTP ────────────────────────────────────────────────────

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to send OTP. Please try again.');
        return;
      }
      setDevMode(data.dev_mode === true);
      setStep('otp');
      setResendCountdown(60);
      // Focus first OTP input
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch {
      setError('Cannot reach the server. Is the orchestrator running?');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Verify OTP ─────────────────────────────────────────────────────

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const otpValue = otp.join('');
    if (otpValue.length < 6) {
      setError('Please enter all 6 digits of the OTP.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Verification failed. Please try again.');
        // Clear OTP inputs on wrong attempt
        setOtp(['', '', '', '', '', '']);
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
        return;
      }
      setToken(data.token);
      setStep('success');
      setTimeout(() => { window.location.href = '/'; }, 1200);
    } catch {
      setError('Cannot reach the server. Is the orchestrator running?');
    } finally {
      setLoading(false);
    }
  }

  // ── OTP input helpers ──────────────────────────────────────────────────────

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    setError(null);
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    // Auto-submit when all 6 digits are filled
    if (digit && index === 5 && next.every(Boolean)) {
      // Brief delay so state settles before submit
      setTimeout(() => {
        document.getElementById('otp-submit-btn')?.click();
      }, 80);
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      setOtp(pasted.split(''));
      otpRefs.current[5]?.focus();
    }
  }

  async function handleResend() {
    if (resendCountdown > 0) return;
    setOtp(['', '', '', '', '', '']);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setResendCountdown(60);
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center font-sans antialiased px-4">
      {/* Brand */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 mb-2">
          <span className="font-semibold text-[#1d1d1f] text-base tracking-tight">EcoRouter</span>
          <span className="text-[#86868b] text-sm">·</span>
          <span className="text-[#6e6e73] text-sm">Carbon-Aware LLM Dispatch</span>
        </div>
        <p className="text-xs text-[#86868b]">Secure access via email OTP</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-[#f5f5f7] rounded-2xl p-8 shadow-sm">

        {/* Step: Email entry */}
        {step === 'email' && (
          <form onSubmit={handleRequestOtp} className="space-y-5">
            <div>
              <h1 className="text-[17px] font-semibold text-[#1d1d1f] mb-1">Sign in</h1>
              <p className="text-xs text-[#6e6e73]">
                Enter your email to receive a one-time password.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#1d1d1f]" htmlFor="email-input">
                Email address
              </label>
              <input
                id="email-input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1d6] bg-white text-sm text-[#1d1d1f] placeholder-[#aeaeb2] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f] transition"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#3a3a3c] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending…' : 'Send OTP'}
            </button>
          </form>
        )}

        {/* Step: OTP entry */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <h1 className="text-[17px] font-semibold text-[#1d1d1f] mb-1">Enter OTP</h1>
              <p className="text-xs text-[#6e6e73]">
                We sent a 6-digit code to{' '}
                <span className="font-medium text-[#1d1d1f]">{email}</span>.
              </p>
              {devMode && (
                <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
                  Dev mode: OTP is printed in the orchestrator terminal.
                </p>
              )}
            </div>

            {/* 6 OTP input boxes */}
            <div className="flex gap-2 justify-between" onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-10 h-12 text-center text-lg font-mono font-semibold rounded-xl border border-[#d1d1d6] bg-white text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f] transition caret-transparent"
                />
              ))}
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              id="otp-submit-btn"
              type="submit"
              disabled={loading || otp.some((d) => !d)}
              className="w-full py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#3a3a3c] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying…' : 'Verify & Sign In'}
            </button>

            <div className="flex items-center justify-between text-xs text-[#6e6e73]">
              <button
                type="button"
                onClick={() => { setStep('email'); setOtp(['', '', '', '', '', '']); setError(null); }}
                className="hover:text-[#1d1d1f] underline underline-offset-2 transition"
              >
                ← Change email
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCountdown > 0 || loading}
                className="hover:text-[#1d1d1f] disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend OTP'}
              </button>
            </div>
          </form>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div className="text-center space-y-3 py-4">
            <div className="w-12 h-12 rounded-full bg-[#1d1d1f] flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[#1d1d1f]">Authenticated</p>
            <p className="text-xs text-[#6e6e73]">Redirecting to dashboard…</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="mt-8 text-[11px] text-[#aeaeb2] text-center max-w-xs">
        OTP is valid for 10 minutes. Session expires after 30 minutes of inactivity.
      </p>
    </div>
  );
}
