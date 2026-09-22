# DECISIONS.md — Architecture Decision Log (ADR-style)

_Log every deviation from the PRD here BEFORE implementing it. Each entry: date, decision, alternatives considered, why._

---

### 2026-09-22 | ADR-006: ts-node incompatible with TypeScript 7 — plain JS for scripts

**Decision:** `ts-node@10` cannot load TypeScript 7. Scripts that run standalone use `.js`. `vitest` handles TS7 for tests.

**Why:** TypeScript 7 is installed by default. Not worth pinning for hackathon scope. `tsx` is a future fix if needed.

---

### 2026-09-22 | ADR-007: Registry cloud carbon = realistic EcoLogits-derived order-of-magnitude estimates

**Decision:** `gpt-4o-mini: 0.00080/1k`, `gpt-4o: 0.00280/1k` (kgCO2eq). T1 requires these to be high enough that boosting carbon weight flips a subtask from cloud to local. Will be overwritten by real EcoLogits measurements at sidecar startup.

**Alternatives:** Use EcoLogits API values directly at startup (correct long-term approach). Registry values serve as initialization until live.

---

### 2026-09-22 | ADR-003: Jev bonus coefficient — use 0.02 (Addendum B)

**Decision:** Use `jev_confidence × 0.02` as the Jev bonus, not `× 0.05` from PRD body §3.3.

**Why:** Addendum overrides PRD on conflicts (per task prompt). Addendum B is explicit. OQ-007 resolved.

**PRD reference:** Addendum B (bonus), §3.3 (conflicting value).

---

### 2026-09-22 | ADR-004: Jev via TypeSafe AI playground API, not Vercel AI Gateway

**Decision:** Use the TypeSafe AI direct API (`api.typesafe.ai`) with key `TYPESAFE_API_KEY`, not the Vercel AI Gateway. The `experimental_evaluate` import from `ai` SDK should still work; the base URL is configured via the provider setup.

**Alternatives:** Vercel AI Gateway (no key available now). Heuristic fallback (always built regardless).

**Why:** Human confirmed TypeSafe playground key is available; Vercel Gateway key is not. Build Jev interface to use `api.typesafe.ai` as the provider endpoint. Fallback heuristic router is built regardless per PRD.

**Impact:** Update `TYPESAFE_API_KEY` in `.env.example`. Verify that `experimental_evaluate` works with the direct TypeSafe endpoint (not just through Vercel gateway).

---

### 2026-09-22 | ADR-005: Electricity Maps — mock first, real key added later

**Decision:** Build the Electricity Maps integration behind the interface now with a fixture mock returning a plausible `IN-KA` intensity value (e.g., 650 gCO2/kWh). The env var `ELECTRICITY_MAPS_API_KEY` goes in `.env.example`. Human will add real key when ready.

**Why:** No key available now but PRD requires the interface to exist. Mock is sufficient for Phase 1 gate (T1, T2). Real data needed before demo rehearsal.

**Impact:** All Phase 1 tests run against mock. Live path exists but gated by key presence.

---

## Template

```
### [YYYY-MM-DD] ADR-NNN: [Title]
**Decision:** ...
**Alternatives:** ...
**Why:** ...
**PRD reference:** Section X
```

---

### 2026-09-22 | ADR-001: EcoLogits GWP field — use `.mean` for scalar operations

**Decision:** In the Python sidecar, when `impacts.gwp.value` is a `RangeValue` object (not a scalar float), use `.value.mean` for the scalar stored and returned. Log `.value.min` and `.value.max` for transparency but don't surface them in the scoring formula.

**Alternatives:**
- Use `.value.max` (conservative/pessimistic): biases against cloud candidates.
- Use `.value.min` (optimistic): biases toward cloud candidates.
- Fail if not a scalar: brittle, breaks on newer EcoLogits versions that always return ranges.

**Why:** `.mean` is the central estimate, consistent with how EcoLogits documentation presents the point value. The PRD says "use EcoLogits output as-is" — the mean is the intended scalar representation of a range. Log min/max for UI display (shows uncertainty range in Route Inspector).

**PRD reference:** Section 5/6a (carbon rule), Locked Decision 6. Addendum D.

---

### 2026-09-22 | ADR-002: PRD addendum is embedded in prd.txt, not a separate file

**Decision:** The PRD addendum (sections A–J) is embedded directly in `prd.txt` rather than being a separate `docs/PRD_ADDENDUM.md`. Treat the full `prd.txt` as the single source of truth. No separate addendum file was found or created.

**Alternatives:**
- Split into separate files for cleaner referencing.

**Why:** No separate file existed. Splitting would create divergence risk. The prd.txt addendum sections (A–J) supersede earlier sections as stated in the task prompt.

**PRD reference:** Prompt instruction "the addendum overrides the PRD on any conflict."
