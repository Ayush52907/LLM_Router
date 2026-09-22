# CONTEXT.md — Carbon- and Latency-Aware Agent Workflow Scheduler

_Fast-onboarding page. One page. Read this before touching code._

---

## Goal

Build a middleware router that sits between a task submission UI and a pool of LLMs (cloud + local). It decomposes a user task into subtasks, picks the best `(model, location)` pair for each using a five-factor score, executes via cascade verification, and reports **measured** savings vs. real baselines — not claimed savings.

---

## Pitch Framing (say this, build to this)

> "Same output quality for less cost, latency, and carbon — proven, not claimed."

- Carbon is **one axis**, not the whole pitch.
- The differentiator is the **honesty layer**: real baseline comparison with scheduler overhead included, disclosed measurement limitations, willingness to show where we don't win.
- Prior art is acknowledged: RouteLLM (model routing), FrugalGPT (cascade), Green Software Foundation Carbon Aware SDK (shift compute). Our contribution is the **combination + measurement discipline**.

---

## Demo Workload (fixed — do not substitute)

**Task:** "Process this 30-page vendor contract PDF: extract parties and dates, classify each clause, summarize obligations, flag risky clauses, and draft a reply email."

Uses a **synthetic contract with fake PII and planted risky clauses** (gold labels for eval).

| Subtask | PII Class | Expected Route |
|---|---|---|
| Extract parties/dates | `raw_pii` | small local (forced) |
| Classify clauses | `redacted_ok`, trivial | small local (score wins) |
| Flag risky clauses | `redacted_ok`, high | strong cloud (floor forces it) |
| Summarize obligations | `redacted_ok`, medium | scored |
| Draft reply email | `redacted_ok` + placeholders | cloud, local rehydration |

---

## Fixed Terminology (use exactly these terms everywhere)

| Correct | Wrong |
|---|---|
| adaptive calibration | learning, training, weight update |
| accuracy tier (benchmark-derived) | measured accuracy, task-level correctness |
| fixed_norm(x, 0, bound) | min-max normalization, pool normalization |
| simulated forecast | live forecast, real forecast |
| escalation | retry, fallback |
| sidecar | carbon service |

---

## Locked Decisions (do not revisit without a DECISIONS.md entry + approval)

1. Jev via Vercel AI Gateway (`typesafe-ai/jev`); heuristic fallback router if blocked.
2. Python FastAPI sidecar for both EcoLogits (cloud) and CodeCarbon (local).
3. Accuracy tier = benchmark estimate; never presented as measured per-task value.
4. Escalation cap = 2; top-tier failure does not retry.
5. Grid carbon = current-value only, local zone only, real; forecast = simulated, always grey-dashed.
6. **Carbon rule:** Local = `measured_energy_kwh × live_grid_intensity`. Cloud = `EcoLogits.impacts.gwp` as-is. No zone lookup for cloud. Ever.
7. Cloud-vs-local carbon comparison is methodologically inconsistent — permanently disclosed in UI footer.
8. Baseline comparison (Always-strongest + Random) is mandatory. Without it, the submission is "a prototype", not "a proven saving."
9. Headline numbers come from the measured offline eval (N=20 subtasks × 3 contracts × 3 runs), not live estimates.
10. Time-shifting applies to local candidates only. Cloud carbon is not grid-dependent.
11. `impacts.gwp.value` may be a `RangeValue`; use `.mean` for scalar operations (or check type). This is an API detail to handle in sidecar code.

---

## Privacy Boundary

- Raw document text for `raw_pii` subtasks: **stays on local machine only**.
- Jev routing calls receive only `{description, type, token_count, sensitivity}` — never document text.
- Embeddings for `pii` tasks use local `nomic-embed-text` via Ollama.
- Redaction is best-effort NER (Presidio/spaCy + regex) — disclosed in UI footer.

---

## Stack Summary

| Layer | Choice |
|---|---|
| Orchestrator | Node.js + TypeScript |
| Cloud LLMs | Vercel AI Gateway |
| Local LLMs | Ollama |
| Carbon (cloud) | EcoLogits via Python sidecar |
| Carbon (local) | CodeCarbon × Electricity Maps (sidecar) |
| Grid intensity | Electricity Maps `/v3/carbon-intensity/latest` |
| Embeddings | `text-embedding-3-small` (public) or `nomic-embed-text` via Ollama (PII) |
| DB | SQLite (`better-sqlite3`) |
| Dashboard | Next.js + Recharts |
| PDF→MD | `markitdown` or `pdf-parse` |
