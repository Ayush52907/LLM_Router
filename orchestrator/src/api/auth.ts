/**
 * OTP-based Email Authentication Module.
 *
 * Flow:
 *   POST /api/auth/request-otp  → generates 6-digit OTP, emails user (or logs to console in dev mode)
 *   POST /api/auth/verify-otp   → validates OTP, returns a short-lived session token
 *
 * Session store: in-memory Map (hackathon scope — no Redis, no DB).
 * OTP TTL: 10 minutes. Session token TTL: 30 minutes.
 *
 * Email delivery:
 *   If EMAIL_PASS is set → sends via Nodemailer (Gmail SMTP / any SMTP provider).
 *   If EMAIL_PASS is absent → prints OTP to console with [OTP DEV MODE] prefix.
 *
 * authMiddleware: Express middleware that validates `Authorization: Bearer <token>`.
 *   Mount on all protected routes. /api/health and /api/auth/* are always public.
 */

import crypto from 'crypto';
import type { Request, Response, NextFunction, Router } from 'express';
import { Router as createRouter } from 'express';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const OTP_TTL_MS = 10 * 60 * 1000;      // 10 minutes
const SESSION_TTL_MS = 30 * 60 * 1000;  // 30 minutes

// ─────────────────────────────────────────────────────────────────────────────
// In-memory stores
// ─────────────────────────────────────────────────────────────────────────────

interface OtpRecord {
  otp: string;
  expiresAt: number;
  attempts: number;
}

interface SessionRecord {
  email: string;
  expiresAt: number;
}

const otpStore = new Map<string, OtpRecord>();           // email → OTP record
const sessionStore = new Map<string, SessionRecord>();   // token → session record

// Sweep expired entries every 5 minutes to avoid memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, rec] of otpStore) {
    if (rec.expiresAt < now) otpStore.delete(key);
  }
  for (const [token, rec] of sessionStore) {
    if (rec.expiresAt < now) sessionStore.delete(token);
  }
}, 5 * 60 * 1000);

// ─────────────────────────────────────────────────────────────────────────────
// OTP generation
// ─────────────────────────────────────────────────────────────────────────────

/** Generates a cryptographically random 6-digit OTP, zero-padded. */
export function generateOtp(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, '0');
}

// ─────────────────────────────────────────────────────────────────────────────
// Email delivery
// ─────────────────────────────────────────────────────────────────────────────

async function sendOtpEmail(toEmail: string, otp: string): Promise<void> {
  const emailFrom = process.env['EMAIL_FROM'];
  const emailPass = process.env['EMAIL_PASS'];

  if (!emailPass || !emailFrom) {
    // Dev mode: print to console — visible in the orchestrator terminal
    console.log(
      `\n╔══════════════════════════════════════════════╗\n` +
      `║  [OTP DEV MODE]  No email credentials set.  ║\n` +
      `║  To: ${toEmail.padEnd(38)}║\n` +
      `║  OTP: ${otp.padEnd(38)}║\n` +
      `║  Valid for 10 minutes.                       ║\n` +
      `╚══════════════════════════════════════════════╝\n`
    );
    return;
  }

  // Live email via Nodemailer — lazy import so nodemailer is optional in dev
  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      service: 'gmail',
      auth: { user: emailFrom, pass: emailPass },
    });

    await transporter.sendMail({
      from: `"EcoRouter Auth" <${emailFrom}>`,
      to: toEmail,
      subject: 'Your EcoRouter Login OTP',
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 400px; margin: 40px auto; color: #1d1d1f;">
          <h2 style="font-weight: 600; font-size: 18px; margin-bottom: 4px;">EcoRouter Login</h2>
          <p style="color: #6e6e73; font-size: 14px; margin-bottom: 32px;">Your one-time password (valid for 10 minutes):</p>
          <div style="text-align: center; letter-spacing: 10px; font-size: 36px; font-weight: 700; font-family: monospace; padding: 24px; background: #f5f5f7; border-radius: 12px;">
            ${otp}
          </div>
          <p style="color: #86868b; font-size: 12px; margin-top: 24px;">If you did not request this code, ignore this email.</p>
        </div>
      `,
      text: `Your EcoRouter OTP is: ${otp}\nThis code expires in 10 minutes.`,
    });

    console.log(`[Auth] OTP email sent to ${toEmail}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Auth] Failed to send OTP email to ${toEmail}: ${msg}`);
    // Re-throw so the endpoint can return an error to the client
    throw new Error(`Email delivery failed: ${msg}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Token generation
// ─────────────────────────────────────────────────────────────────────────────

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth middleware
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Express middleware that validates `Authorization: Bearer <token>`.
 * Returns 401 if the token is missing, invalid, or expired.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: missing or malformed Authorization header' });
    return;
  }

  const token = header.slice(7).trim();
  const session = sessionStore.get(token);

  if (!session) {
    res.status(401).json({ error: 'Unauthorized: invalid session token' });
    return;
  }

  if (session.expiresAt < Date.now()) {
    sessionStore.delete(token);
    res.status(401).json({ error: 'Unauthorized: session expired — please log in again' });
    return;
  }

  // Attach email to request for downstream use
  (req as any).userEmail = session.email;
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth Router
// ─────────────────────────────────────────────────────────────────────────────

export function createAuthRouter(): Router {
  const router = createRouter();

  /**
   * POST /api/auth/request-otp
   * Body: { email: string }
   * Response: { message: string }
   *
   * Generates a 6-digit OTP and sends it to the given email address.
   * Idempotent: a new OTP replaces any existing one for the same email.
   */
  router.post('/request-otp', async (req: Request, res: Response) => {
    const { email } = req.body as { email?: string };

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'A valid email address is required' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const otp = generateOtp();

    otpStore.set(normalizedEmail, {
      otp,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
    });

    try {
      await sendOtpEmail(normalizedEmail, otp);
      const isDevMode = !process.env['EMAIL_PASS'];
      res.json({
        message: 'OTP sent. Check your email (or use the dev code below).',
        dev_mode: isDevMode,
        dev_otp: isDevMode ? otp : undefined,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });

  /**
   * POST /api/auth/verify-otp
   * Body: { email: string, otp: string }
   * Response: { token: string, expiresAt: number }
   *
   * Validates the OTP. Returns a session token on success.
   * Max 5 attempts per OTP before it is invalidated.
   */
  router.post('/verify-otp', (req: Request, res: Response) => {
    const { email, otp } = req.body as { email?: string; otp?: string };

    if (!email || !otp) {
      res.status(400).json({ error: 'email and otp are required' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const record = otpStore.get(normalizedEmail);

    if (!record) {
      res.status(401).json({ error: 'No OTP was requested for this email. Request a new one.' });
      return;
    }

    if (record.expiresAt < Date.now()) {
      otpStore.delete(normalizedEmail);
      res.status(401).json({ error: 'OTP has expired. Request a new one.' });
      return;
    }

    // Brute-force protection: max 5 attempts
    if (record.attempts >= 5) {
      otpStore.delete(normalizedEmail);
      res.status(429).json({ error: 'Too many incorrect attempts. Request a new OTP.' });
      return;
    }

    // Constant-time comparison to prevent timing attacks
    const expectedBuf = Buffer.from(record.otp, 'utf8');
    const receivedBuf = Buffer.from(otp.trim(), 'utf8');
    const isMatch =
      expectedBuf.length === receivedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, receivedBuf);

    if (!isMatch) {
      record.attempts += 1;
      const attemptsLeft = 5 - record.attempts;
      res.status(401).json({
        error: `Incorrect OTP. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`,
      });
      return;
    }

    // Success — issue session token
    otpStore.delete(normalizedEmail);
    const token = generateSessionToken();
    const expiresAt = Date.now() + SESSION_TTL_MS;

    sessionStore.set(token, { email: normalizedEmail, expiresAt });

    console.log(`[Auth] Login successful for ${normalizedEmail}`);

    res.json({ token, expiresAt });
  });

  return router;
}
