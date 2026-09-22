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
    // Console delivery: print clearly to orchestrator terminal
    console.log(
      `\n` +
      `╔══════════════════════════════════════════════════════════╗\n` +
      `║  🔐 [EcoRouter Orchestrator OTP Dispatch]               ║\n` +
      `║  Target:  ${toEmail.padEnd(46)}║\n` +
      `║  OTP:     ${otp.padEnd(46)}║\n` +
      `║  Expires: 10 minutes                                     ║\n` +
      `╚══════════════════════════════════════════════════════════╝\n`
    );
    return;
  }

  // Live email via Nodemailer
  try {
    const nodemailer = await import('nodemailer');
    const host = process.env['EMAIL_HOST'];
    const port = process.env['EMAIL_PORT'] ? parseInt(process.env['EMAIL_PORT'], 10) : undefined;
    const service = process.env['EMAIL_SERVICE'] || (!host ? 'gmail' : undefined);

    const transportOptions: any = host
      ? { host, port: port || 587, secure: port === 465, auth: { user: emailFrom, pass: emailPass } }
      : { service, auth: { user: emailFrom, pass: emailPass } };

    const transporter = nodemailer.default.createTransport(transportOptions);

    await transporter.sendMail({
      from: `"EcoRouter Auth" <${emailFrom}>`,
      to: toEmail,
      subject: 'Your EcoRouter Login OTP',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 440px; margin: 40px auto; color: #111111; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 16px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <div style="margin-bottom: 24px;">
            <div style="display: inline-block; width: 28px; height: 28px; background: #000000; border-radius: 8px; vertical-align: middle; margin-right: 8px;"></div>
            <span style="font-size: 16px; font-weight: 700; letter-spacing: -0.02em; color: #000000;">EcoRouter</span>
          </div>
          <h2 style="font-weight: 600; font-size: 20px; margin: 0 0 8px 0; color: #000000; letter-spacing: -0.02em;">One-Time Password</h2>
          <p style="color: #666666; font-size: 14px; line-height: 1.5; margin: 0 0 24px 0;">Use the single-use code below to complete your sign-in. This verification code expires in 10 minutes.</p>
          <div style="text-align: center; letter-spacing: 12px; font-size: 36px; font-weight: 700; font-family: 'SF Mono', Monaco, Consolas, monospace; padding: 20px; background: #f7f7f8; border: 1px solid #ededed; border-radius: 12px; color: #000000;">
            ${otp}
          </div>
          <p style="color: #888888; font-size: 12px; margin-top: 28px; line-height: 1.4; border-top: 1px solid #f0f0f0; paddingTop: 16px;">
            If you did not request this verification code, please ignore this email. Never share this code with anyone.
          </p>
        </div>
      `,
      text: `Your EcoRouter OTP is: ${otp}\nThis code expires in 10 minutes.\nIf you did not request this code, ignore this email.`,
    });

    console.log(`[Auth] OTP email dispatched to ${toEmail}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Auth] Failed to send OTP email to ${toEmail}: ${msg}`);
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
  if (process.env['AUTH_DISABLED'] === 'true') {
    (req as any).userEmail = 'dev@ecorouter.local';
    return next();
  }

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
   * Response: { message: string, dev_mode?: boolean, dev_otp?: string }
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
      res.json({
        message: 'OTP sent. Please check the backend orchestration console or your email.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });

  /**
   * POST /api/auth/verify-otp
   * Body: { email: string, otp: string }
   * Response: { token: string, expiresAt: number, email: string }
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

    res.json({ token, expiresAt, email: normalizedEmail });
  });

  /**
   * GET /api/auth/me
   * Validates the active session token and returns caller identity.
   */
  router.get('/me', authMiddleware, (req: Request, res: Response) => {
    const userEmail = (req as any).userEmail;
    res.json({ email: userEmail, authenticated: true });
  });

  /**
   * POST /api/auth/logout
   * Invalidates current session token.
   */
  router.post('/logout', (req: Request, res: Response) => {
    const header = req.headers['authorization'];
    if (header && header.startsWith('Bearer ')) {
      const token = header.slice(7).trim();
      sessionStore.delete(token);
    }
    res.json({ message: 'Logged out successfully' });
  });

  return router;
}
