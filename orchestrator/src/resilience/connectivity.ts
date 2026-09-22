/**
 * Connectivity Monitor (Offline Resilience).
 *
 * Real, periodic connectivity monitoring for the orchestrator.
 * Checks reachability of the cloud gateway endpoint.
 *
 * Exposes:
 *   - online status via getConnectivityMonitor().isOnline
 *   - /api/health connectivity metadata
 *   - automatic listener callbacks on offline -> online transitions for reconciliation
 */

export interface ConnectivityState {
  online: boolean;
  lastChecked: number;
  lastTransition: number;
  probeUrl: string;
  checkCount: number;
  failureCount: number;
}

type StatusListener = (isOnline: boolean, wasOnline: boolean) => void | Promise<void>;

export class ConnectivityMonitor {
  private _isOnline = true;
  private _lastChecked = 0;
  private _lastTransition = Date.now();
  private _checkCount = 0;
  private _failureCount = 0;
  private _timer: NodeJS.Timeout | null = null;
  private _listeners: StatusListener[] = [];
  private _probeUrl: string;
  private _isChecking = false;
  private _mockOnline: boolean | null = null;

  constructor(probeUrl?: string) {
    this._probeUrl =
      probeUrl ||
      process.env['CONNECTIVITY_PROBE_URL'] ||
      'https://generativelanguage.googleapis.com';
  }

  setMockOnline(val: boolean | null): void {
    const previous = this.isOnline;
    this._mockOnline = val;
    if (val !== null && val !== previous) {
      this._isOnline = val;
      this._lastTransition = Date.now();
      for (const listener of this._listeners) {
        try {
          listener(val, previous);
        } catch {
          // ignore
        }
      }
    }
  }

  get isOnline(): boolean {
    if (this._mockOnline !== null) return this._mockOnline;
    return this._isOnline;
  }

  get probeUrl(): string {
    return this._probeUrl;
  }

  getState(): ConnectivityState {
    return {
      online: this._isOnline,
      lastChecked: this._lastChecked,
      lastTransition: this._lastTransition,
      probeUrl: this._probeUrl,
      checkCount: this._checkCount,
      failureCount: this._failureCount,
    };
  }

  onStatusChange(listener: StatusListener): () => void {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }

  /**
   * Probe the external gateway endpoint with a short timeout.
   * Real network check — fails if network disconnected or gateway unreachable.
   */
  async checkNow(): Promise<boolean> {
    if (this._mockOnline !== null) {
      this._isOnline = this._mockOnline;
      return this._isOnline;
    }
    if (this._isChecking) return this._isOnline;
    this._isChecking = true;

    const previousOnline = this._isOnline;
    let reachable = false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      try {
        // Try HEAD first (lightweight)
        const resp = await fetch(this._probeUrl, {
          method: 'HEAD',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        // Any HTTP response (even 4xx/5xx) indicates TCP/HTTP connectivity to the host
        reachable = resp.status > 0;
      } catch {
        clearTimeout(timeoutId);
        // Try GET with short timeout if HEAD wasn't allowed or timed out
        const getController = new AbortController();
        const getTimeoutId = setTimeout(() => getController.abort(), 2000);
        try {
          const getResp = await fetch(this._probeUrl, {
            method: 'GET',
            signal: getController.signal,
          });
          clearTimeout(getTimeoutId);
          reachable = getResp.status > 0;
        } catch {
          clearTimeout(getTimeoutId);
          reachable = false;
        }
      }
    } catch {
      reachable = false;
    } finally {
      this._isChecking = false;
    }

    this._checkCount++;
    this._lastChecked = Date.now();

    if (!reachable) {
      this._failureCount++;
    }

    if (reachable !== previousOnline) {
      this._isOnline = reachable;
      this._lastTransition = Date.now();
      console.log(
        `[ConnectivityMonitor] Network status changed: ${previousOnline ? 'ONLINE' : 'OFFLINE'} → ${
          reachable ? 'ONLINE' : 'OFFLINE (Local fallback engaged)'
        }`
      );

      // Trigger listeners
      for (const listener of this._listeners) {
        try {
          const res = listener(reachable, previousOnline);
          if (res && typeof (res as any).catch === 'function') {
            (res as Promise<void>).catch(err => {
              console.error('[ConnectivityMonitor] Listener error:', err);
            });
          }
        } catch (err) {
          console.error('[ConnectivityMonitor] Listener error:', err);
        }
      }
    } else {
      this._isOnline = reachable;
    }

    return this._isOnline;
  }

  start(intervalMs = 6000): void {
    if (this._timer) return;
    // Initial check
    this.checkNow().catch(() => {});
    this._timer = setInterval(() => {
      this.checkNow().catch(() => {});
    }, intervalMs);
  }

  stop(): void {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }
}

let _monitorInstance: ConnectivityMonitor | null = null;

export function getConnectivityMonitor(): ConnectivityMonitor {
  if (!_monitorInstance) {
    _monitorInstance = new ConnectivityMonitor();
  }
  return _monitorInstance;
}
