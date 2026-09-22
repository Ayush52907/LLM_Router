/**
 * Similarity Cache (PRD §3.1).
 *
 * Cache rule:
 *   (cosine similarity >= 0.92) AND (input token count within +/-20%)
 *
 * Invariants & constraints:
 *   - A cache hit skips Jev call.
 *   - But STILL re-runs the constraint check (Stage 2) and re-fetches current grid intensity.
 *   - A hit is never blindly trusted.
 *   - Cold start shows 0% hit rate honestly (T6).
 */

export interface CacheEntry {
  subtaskId: string;
  embedding: number[];
  inputTokens: number;
  routedModel: string;
  routedLocation: 'cloud' | 'local';
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class SimilarityCache {
  private entries: CacheEntry[] = [];
  private hits = 0;
  private misses = 0;

  constructor() {
    this.entries = [];
  }

  getHitRate(): { hits: number; misses: number; rate: number } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      rate: total === 0 ? 0 : this.hits / total,
    };
  }

  lookup(queryEmbedding: number[], queryTokens: number): CacheEntry | null {
    if (this.entries.length === 0) {
      this.misses++;
      return null;
    }

    let bestMatch: CacheEntry | null = null;
    let highestSim = -1;

    for (const entry of this.entries) {
      // 1. Token count check (within +/-20%)
      const tokenRatio = queryTokens / entry.inputTokens;
      if (tokenRatio < 0.80 || tokenRatio > 1.20) {
        continue; // Token count mismatch prevents short & long collisions
      }

      // 2. Cosine similarity check (>= 0.92)
      const sim = cosineSimilarity(queryEmbedding, entry.embedding);
      if (sim >= 0.92 && sim > highestSim) {
        highestSim = sim;
        bestMatch = entry;
      }
    }

    if (bestMatch) {
      this.hits++;
      return bestMatch;
    } else {
      this.misses++;
      return null;
    }
  }

  insert(entry: CacheEntry): void {
    this.entries.push(entry);
  }

  clear(): void {
    this.entries = [];
    this.hits = 0;
    this.misses = 0;
  }
}
