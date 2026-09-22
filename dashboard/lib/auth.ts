/**
 * dashboard/lib/auth.ts
 *
 * Client-side authentication helpers for the EcoRouter mission-control dashboard.
 *
 *   getToken()           — read session token from storage
 *   getUserEmail()       — read current user's email
 *   setSession(...)      — persist session token & email upon successful OTP verification
 *   clearSession()       — clear local session data
 *   isAuthenticated()    — boolean check for active non-expired session
 *   authFetch(url, opts) — authenticated fetch wrapper injecting Bearer token & handling 401
 *   logout()             — call orchestrator logout and redirect to /login
 */

const TOKEN_KEY = 'ecr_session_token';
const EMAIL_KEY = 'ecr_session_email';
const EXPIRES_KEY = 'ecr_session_expires';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  if (!token) return null;

  // Check client-side expiry if recorded
  const expiresStr = sessionStorage.getItem(EXPIRES_KEY) || localStorage.getItem(EXPIRES_KEY);
  if (expiresStr) {
    const expiresAt = parseInt(expiresStr, 10);
    if (!isNaN(expiresAt) && Date.now() > expiresAt) {
      clearSession();
      return null;
    }
  }

  return token;
}

export function getUserEmail(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(EMAIL_KEY) || localStorage.getItem(EMAIL_KEY) || null;
}

export function setSession(token: string, email: string, expiresAt?: number): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(EMAIL_KEY, email);
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EMAIL_KEY, email);

  if (expiresAt) {
    sessionStorage.setItem(EXPIRES_KEY, expiresAt.toString());
    localStorage.setItem(EXPIRES_KEY, expiresAt.toString());
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EMAIL_KEY);
  sessionStorage.removeItem(EXPIRES_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/**
 * Authenticated fetch wrapper.
 * Automatically injects `Authorization: Bearer <token>` into outgoing requests.
 * On 401 response, purges session and redirects to /login.
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response | null> {
  const token = getToken();

  const headers = new Headers(options.headers ?? {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response | null = null;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    return null;
  }

  if (response.status === 401) {
    clearSession();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    return null;
  }

  return response;
}

/**
 * Logs out the current user by notifying the server and clearing local storage.
 */
export async function logout(apiBase: string = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || 'http://localhost:3001'): Promise<void> {
  const token = getToken();
  if (token) {
    try {
      await fetch(`${apiBase}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch {
      // Ignore network errors during logout
    }
  }

  clearSession();
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}
