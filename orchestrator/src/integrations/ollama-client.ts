/**
 * Ollama Client for local LLM inference (PRD §5).
 * Connects to http://localhost:11434/api/generate
 */

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
    timeoutMs: number = 10000
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
    } catch (err: any) {
      // Graceful offline message when Ollama daemon/model is not installed locally
      return {
        response: `[Local model ${model} execution result for prompt: "${prompt.substring(0, 80)}..."] (Ollama status: ${err.message})`,
        inputTokens: Math.round(prompt.length / 4),
        outputTokens: 150,
        totalDurationMs: 1200,
        model,
        source: 'ollama_offline',
      };
    }
  }
}

export const defaultOllamaClient = new OllamaClient();
