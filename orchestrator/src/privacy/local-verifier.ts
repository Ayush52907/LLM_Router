/**
 * Local judge verifier for raw_pii tasks (PRD Addendum A).
 *
 * Invariant 2: Cloud services never see raw PII.
 * For raw_pii subtasks, verification CANNOT use Jev (cloud).
 * It must use a local judge via Ollama (or local deterministic rule verification).
 */

export interface LocalVerificationResult {
  passed: boolean;
  score: number;
  reason: string;
}

export async function verifyRawPiiOutput(
  subtaskPrompt: string,
  output: string,
  expectedEntities?: string[]
): Promise<LocalVerificationResult> {
  // Local verification check
  if (!output || output.trim().length === 0) {
    return { passed: false, score: 0.0, reason: 'Empty output from local model' };
  }

  // If gold/expected entities provided, verify recall
  if (expectedEntities && expectedEntities.length > 0) {
    let foundCount = 0;
    for (const entity of expectedEntities) {
      if (output.toLowerCase().includes(entity.toLowerCase())) {
        foundCount++;
      }
    }
    const recall = foundCount / expectedEntities.length;
    const passed = recall >= 0.7; // 70% threshold
    return {
      passed,
      score: recall,
      reason: passed ? 'Sufficient entities extracted locally' : 'Insufficient entity recall in extraction',
    };
  }

  // Fallback heuristic: check if output contains standard entity indicators
  const hasEntities = /provider|customer|date|term|party/i.test(output);
  return {
    passed: hasEntities,
    score: hasEntities ? 0.85 : 0.40,
    reason: hasEntities ? 'Key contract entity fields present' : 'Missing standard contract entity keys',
  };
}
