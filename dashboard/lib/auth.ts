/**
 * dashboard/lib/auth.ts
 *
 * Client-side auth helpers for the EcoRouter dashboard.
 *
 *   getToken()           — read session token from sessionStorage
 *   setToken(t)          — persist session token after successful OTP verify
 *   clearToken()         — remove token (logout)
 *   authFetch(url, opts) — fetch wrapper that injects `Authorization: Bearer <token>`
 *                          Returns null on 401 so callers can redirect to /login.
 */

const TOKEN_KEY = 'ecr_session_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/**
 * Authenticated fetch wrapper.
 * Automatically injects `Authorization: Bearer <token>` into every request.
 * Returns null and redirects to /login on a 401 response.
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
    clearToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
  }

  return response;
}
