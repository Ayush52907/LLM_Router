/**
 * Ollama Client for local LLM inference (PRD §5).
 * Connects to http://localhost:11434/api/generate
 * Falls back to domain-specific structured synthesizer when offline.
 */

import { generateDomainSubtaskOutput } from '../pipeline/output-synthesizer.js';

export interface OllamaGenerateResult {
  response: string;
  inputTokens: number;
  outputTokens: number;
  totalDurationMs: number;
  model: string;
  source: 'ollama' | 'ollama_offline';
}

export class OllamaClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434';
  }

  async generate(
    model: string,
    prompt: string,
    context?: { subtaskType?: string; description?: string },
    timeoutMs: number = 60000
  ): Promise<OllamaGenerateResult> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Ollama returned status ${resp.status}: ${text}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (await resp.json()) as any;
      const durationMs = data.total_duration ? Math.round(data.total_duration / 1e6) : 1000;

      return {
        response: data.response || '',
        inputTokens: data.prompt_eval_count || Math.round(prompt.length / 4),
        outputTokens: data.eval_count || Math.round((data.response || '').length / 4),
        totalDurationMs: durationMs,
        model,
        source: 'ollama',
      };
    } catch {
      // Graceful offline fallback with domain-specific structured output
      const synthesized = generateDomainSubtaskOutput(
        model,
        context?.subtaskType ?? 'other',
        context?.description ?? prompt.substring(0, 100),
        prompt
      );

      return {
        response: synthesized,
        inputTokens: Math.round(prompt.length / 4),
        outputTokens: Math.round(synthesized.length / 4),
        totalDurationMs: 1200,
        model,
        source: 'ollama_offline',
      };
    }
  }
}

export const defaultOllamaClient = new OllamaClient();
