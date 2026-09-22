# OPEN_QUESTIONS.md — Blockers & Unresolved Items

_Move items to `DECISIONS.md` when resolved. Each entry: date added, question, what's blocking it._

---

## Critical Blockers

### OQ-001: Jev / Vercel AI Gateway access — UNVERIFIED
**Date:** 2026-09-22
**Question:** Can we access `typesafe-ai/jev` via `experimental_evaluate` from the Vercel AI Gateway in our hackathon environment? Does it require a specific plan tier?
**Impact:** Core routing and verification depend on Jev. Heuristic fallback exists but reduces the demo's credibility.
**Blocking:** Phase 1.7 (Jev interface) — can build mock now, need real access before demo rehearsal.
**Action needed:** Test with a real API key. Check if `AI_GATEWAY_API_KEY` env var is the right key name.

### OQ-002: Electricity Maps `IN-KA` zone on free tier — UNVERIFIED
**Date:** 2026-09-22
**Question:** Is the `IN-KA` (Bengaluru) zone available on the Electricity Maps free personal tier? The free tier is documented as having limited zone access.
**Impact:** If `IN-KA` is unavailable, we need a fallback zone or to use a hardcoded estimate (must be labeled "estimated").
**Blocking:** Phase 1.6 (Electricity Maps integration).
**Action needed:** Sign up for free tier, call `/v3/carbon-intensity/latest?zone=IN-KA` with real API key and verify response.

---

## High Priority

### OQ-003: `experimental_evaluate` response structure for `score` type — PARTIALLY VERIFIED
**Date:** 2026-09-22
**Question:** The PRD uses `levels: ['trivial', 'low', 'medium', 'high', 'expert']` for the score type. Does `experimental_evaluate` return the string level name or a numeric position (0.0–1.0)?
**Impact:** `complexity_tier` assignment in Stage 3.2 depends on this. If numeric, we need a mapping.
**Research found:** Web search indicates `score` returns a fractional position (0.0–1.0) and a distribution. The PRD assumes it returns a level string directly. Need to verify which is correct.
**Action needed:** Test with a real Jev call or check ai-sdk.dev docs (URL returned 404 during research).

### OQ-004: EcoLogits with Vercel AI Gateway models — UNVERIFIED
**Date:** 2026-09-22
**Question:** EcoLogits patches standard provider SDKs (OpenAI, Anthropic, etc.). If we route cloud calls through Vercel AI Gateway, does EcoLogits still intercept and instrument them correctly? Or do we call EcoLogits directly via the sidecar's `/carbon/cloud` endpoint with token counts?
**Impact:** The sidecar architecture may need to proxy actual LLM calls through EcoLogits, rather than being called separately with token counts.
**Action needed:** Check EcoLogits docs for how it handles proxied/gateway requests vs. direct SDK calls.

### OQ-005: CodeCarbon on Windows vs Linux — UNVERIFIED
**Date:** 2026-09-22
**Question:** CodeCarbon uses RAPL (Intel) and NVML (NVIDIA) for hardware energy measurement. On Windows, RAPL access is restricted. Does CodeCarbon fall back to TDP estimation on Windows, and is the fallback accurate enough?
**Impact:** The PRD discloses that "CodeCarbon on non-server hardware often falls back to TDP estimation with noise from concurrent processes." This is a known limitation, already in the UI footer disclosure. But we need to know what values to expect.
**Action needed:** Run `codecarbon detect` and `EmissionsTracker()` test on the dev machine.

---

## Lower Priority

### OQ-006: `markitdown` vs `pdf-parse` for PDF→MD
**Date:** 2026-09-22
**Question:** Which PDF tool is faster/more reliable for the demo contract? `markitdown` (Microsoft) vs `pdf-parse` (npm)?
**Impact:** Phase 8 (lowest priority; drop first under time pressure). No impact on Phase 1–3.

### OQ-007: Scoring formula Jev bonus — PRD has inconsistency
**Date:** 2026-09-22
**Question:** The PRD body (Section 3.3) says Jev bonus = `jev_confidence × 0.05`. Addendum B says `jev_confidence × 0.02`. Which is correct?
**Resolution pending:** Addendum overrides PRD per task prompt. Use **0.02** (Addendum B). Log in DECISIONS.md.
**Action needed:** Log as ADR once confirmed by human.

### OQ-008: `nomic-embed-text` via Ollama — availability
**Date:** 2026-09-22
**Question:** Is `nomic-embed-text` available in the Ollama instance? It needs to be pulled separately (`ollama pull nomic-embed-text`).
**Impact:** Phase 3 (privacy pipeline). PII task embeddings will fail without it.
