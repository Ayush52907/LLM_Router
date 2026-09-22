/**
 * Sidecar HTTP Client.
 *
 * Communicates with the Python FastAPI sidecar on SIDECAR_BASE_URL (default: http://localhost:8000).
 * Handles:
 *   - POST /carbon/cloud (EcoLogits)
 *   - POST /carbon/local (CodeCarbon * Grid Intensity)
 *   - GET /health
 */

export interface CloudCarbonResult {
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  gwp_mean_kgco2eq: number;
  gwp_min_kgco2eq?: number;
  gwp_max_kgco2eq?: number;
  source: string;
}

export interface LocalCarbonResult {
  zone: string;
  energy_kwh: number;
  grid_intensity_gco2_per_kwh: number;
  carbon_kgco2eq: number;
  grid_source: string;
  source: string;
}

export class SidecarClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env['SIDECAR_BASE_URL'] || 'http://localhost:8000';
  }

  async getHealth(): Promise<{ status: string; mode: string } | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
      if (!resp.ok) return null;
      return (await resp.json()) as { status: string; mode: string };
    } catch {
      return null;
    }
  }

  async estimateCloudCarbon(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<CloudCarbonResult | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/carbon/cloud`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
        }),
        signal: AbortSignal.timeout(3000),
      });
      if (!resp.ok) return null;
      return (await resp.json()) as CloudCarbonResult;
    } catch (err) {
      console.warn(`[SidecarClient] Failed to reach sidecar at ${this.baseUrl}/carbon/cloud:`, err);
      return null;
    }
  }

  async calculateLocalCarbon(
    zone: string,
    energyKwh: number,
    durationSeconds?: number
  ): Promise<LocalCarbonResult | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/carbon/local`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zone,
          energy_kwh: energyKwh,
          duration_seconds: durationSeconds,
        }),
        signal: AbortSignal.timeout(3000),
      });
      if (!resp.ok) return null;
      return (await resp.json()) as LocalCarbonResult;
    } catch (err) {
      console.warn(`[SidecarClient] Failed to reach sidecar at ${this.baseUrl}/carbon/local:`, err);
      return null;
    }
  }
}

export const defaultSidecarClient = new SidecarClient();
