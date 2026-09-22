/**
 * Electricity Maps integration — interface + live implementation + fixture mock.
 *
 * Used to get live grid intensity for the configured local zone (e.g. IN-KA).
 * Carbon computation for LOCAL candidates: energy * this value.
 * Cloud candidates NEVER use this — see PRD §6a and AGENTS.md Invariant 1.
 *
 * Mode controlled by ELECTRICITY_MAPS_MODE env var:
 *   "mock"  → returns fixture value (default, for dev/CI)
 *   "live"  → calls real Electricity Maps API
 */

import { getDb } from '../db/schema.js';

// ─────────────────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface GridIntensityResult {
  zone: string;
  /** Grams of CO₂ equivalent per kWh */
  gco2_per_kwh: number;
  fetched_at: number;
  source: 'live' | 'mock' | 'cache';
}

export interface IElectricityMapsClient {
  getLatestIntensity(zone: string): Promise<GridIntensityResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock implementation — deterministic, offline-safe
// ─────────────────────────────────────────────────────────────────────────────

/** Mock intensity per zone (gCO2/kWh). Plausible estimates for demo. */
const MOCK_INTENSITIES: Record<string, number> = {
  'IN-KA': 650,   // Bengaluru — coal-heavy grid, approximate
  'US-CAL-CISO': 200, // California
  'DE': 350,      // Germany
  'FR': 85,       // France (nuclear-heavy)
};

const MOCK_FALLBACK_GCO2_PER_KWH = 650;

export class MockElectricityMapsClient implements IElectricityMapsClient {
  async getLatestIntensity(zone: string): Promise<GridIntensityResult> {
    return {
      zone,
      gco2_per_kwh: MOCK_INTENSITIES[zone] ?? MOCK_FALLBACK_GCO2_PER_KWH,
      fetched_at: Date.now(),
      source: 'mock',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Live implementation — calls Electricity Maps v3 API
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class LiveElectricityMapsClient implements IElectricityMapsClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://api.electricitymap.org') {
    if (!apiKey) throw new Error('ELECTRICITY_MAPS_API_KEY is required for live mode');
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async getLatestIntensity(zone: string): Promise<GridIntensityResult> {
    // Check DB cache first
    const cached = this.getCached(zone);
    if (cached) return cached;

    // Call Electricity Maps API
    const url = `${this.baseUrl}/v3/carbon-intensity/latest?zone=${encodeURIComponent(zone)}`;
    const response = await fetch(url, {
      headers: { 'auth-token': this.apiKey },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Electricity Maps API error for zone ${zone}: ${response.status} ${response.statusText} — ${text}`
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- external API response
    const data = (await response.json()) as any;

    // Response field: carbonIntensity (gCO2eq/kWh)
    const gco2PerKwh: number = data.carbonIntensity;
    if (typeof gco2PerKwh !== 'number' || isNaN(gco2PerKwh)) {
      throw new Error(
        `Electricity Maps API returned unexpected carbonIntensity value: ${JSON.stringify(data)}`
      );
    }

    const fetchedAt = Date.now();
    this.saveToCache(zone, fetchedAt, gco2PerKwh);

    return { zone, gco2_per_kwh: gco2PerKwh, fetched_at: fetchedAt, source: 'live' };
  }

  private getCached(zone: string): GridIntensityResult | null {
    const db = getDb();
    const cutoff = Date.now() - CACHE_TTL_MS;
    const row = db
      .prepare(
        `SELECT zone, fetched_at, current_gco2_per_kwh
         FROM grid_intensity_cache
         WHERE zone = ? AND fetched_at >= ?
         ORDER BY fetched_at DESC
         LIMIT 1`
      )
      .get(zone, cutoff) as { zone: string; fetched_at: number; current_gco2_per_kwh: number } | undefined;

    if (!row) return null;
    return {
      zone: row.zone,
      gco2_per_kwh: row.current_gco2_per_kwh,
      fetched_at: row.fetched_at,
      source: 'cache',
    };
  }

  private saveToCache(zone: string, fetchedAt: number, gco2PerKwh: number): void {
    const db = getDb();
    db.prepare(
      `INSERT OR REPLACE INTO grid_intensity_cache (zone, fetched_at, current_gco2_per_kwh)
       VALUES (?, ?, ?)`
    ).run(zone, fetchedAt, gco2PerKwh);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory — reads ELECTRICITY_MAPS_MODE from env
// ─────────────────────────────────────────────────────────────────────────────

export function createElectricityMapsClient(): IElectricityMapsClient {
  const mode = process.env['ELECTRICITY_MAPS_MODE'] ?? 'mock';

  if (mode === 'live') {
    const apiKey = process.env['ELECTRICITY_MAPS_API_KEY'];
    if (!apiKey) {
      console.warn(
        '[ElectricityMaps] ELECTRICITY_MAPS_MODE=live but ELECTRICITY_MAPS_API_KEY is not set. ' +
        'Falling back to mock. Add your key to .env to use live data.'
      );
      return new MockElectricityMapsClient();
    }
    return new LiveElectricityMapsClient(apiKey);
  }

  return new MockElectricityMapsClient();
}
