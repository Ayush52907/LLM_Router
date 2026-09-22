# AGENTS.md — Rules for every agent working in this repo

## Read-First Order (always, at every session start)
1. `AGENTS.md` (this file)
2. `docs/CONTEXT.md`
3. `docs/TASKS.md`
4. Last 30 lines of `docs/PROGRESS.md`

Open all other docs **on demand only**. Never load the full repo at session start.

---

## Working Protocol

- Work in **small vertical slices**. After each slice, run the relevant tests and update `docs/TASKS.md` and `docs/PROGRESS.md`.
- Follow the **build order** (Section 14 of the PRD / `docs/TASKS.md`) and **stop at each phase gate** for human review. Do not start a later phase early. Do not build anything beyond the CUT LINE until everything above it passes.
- Any **deviation from the PRD** goes into `docs/DECISIONS.md` first. Ask before big deviations.
- **Never fabricate** results, benchmark numbers, or API behavior. If something is unverified, say so and add it to `docs/OPEN_QUESTIONS.md`.
- Build every external dependency (Jev, Electricity Maps, Ollama, sidecar) behind an **interface with a mock/fixture** implementation, so we can develop and demo offline. Include the heuristic rule-based fallback router from the PRD.
- **Secrets** go in `.env` (gitignored), with a committed `.env.example`. Never hardcode keys.
- Prefer **boring, simple solutions**. Hackathon scope: no auth, no queues, no distributed anything.
- **Config values** (weights, bounds, thresholds, floors, tier tables) live in `config/` only, never scattered through code.
- Update `docs/TASKS.md` and `docs/PROGRESS.md` at the end of every working session.

---

## Code Conventions

- **Language:** TypeScript (orchestrator, dashboard, scripts), Python (sidecar only).
- **Formatting:** `prettier` for TS/TSX, `black` for Python.
- **Types:** strict TypeScript (`strict: true`). No `any` without a comment explaining why.
- **Errors:** never swallow errors silently. Log with context, propagate up.
- **Interfaces first:** define the interface/type before implementation. Mocks implement the same interface.
- **File naming:** `kebab-case` for files, `PascalCase` for classes, `camelCase` for functions/variables.
- **No magic numbers:** constants live in `config/` or typed enums. No bare `0.7`, `0.92`, etc. inline.
- **Comments:** explain the "why", not the "what". The scoring formula comment must cite the PRD section.
- **Tests:** keep tests co-located in `__tests__/` or `.test.ts` alongside the source file.

---

## NON-NEGOTIABLE INVARIANTS

These are hard rules. No exceptions. No silent relaxation. Log a warning and surface it if you even approach a boundary.

1. **Cloud carbon = EcoLogits' output as-is.** NEVER apply grid intensity to a cloud candidate. Local carbon = CodeCarbon measured energy × live grid intensity.
2. **Cloud services never see raw PII.** Decomposer, Jev routing, verification, and cache embeddings for `pii` tasks use redacted or metadata-only inputs, or local models. Test T3 (canary PII) must pass.
3. **Scoring uses `w_acc * (1 - fixed_norm(accuracy))`, a candidate-dependent term.** Normalization bounds are fixed absolute values produced by `calibrate_bounds`, never pool min-max.
4. **Jev's suggestion is only a small bonus (`confidence × 0.02`).** The formula makes the final decision.
5. **Accuracy means a benchmark-derived tier estimate, never "measured accuracy".** Registry updates are called "adaptive calibration", never "learning".
6. **Simulated data is always visually distinct** (grey dashed + "Simulated" badge) and never mixed with real data. Estimated and measured baseline numbers are always labeled.
7. **The scheduler's own overhead** (decomposer, Jev, embedding, verification, escalation calls) is always included in "this system" totals.
8. **Time-shifting applies to local candidates only.**
9. **Headline savings numbers come from the measured offline eval**, not from registry-simulated baselines.
10. **No silent constraint relaxation.** Accuracy floors are relaxed last, with a logged warning.

---

## Never Do This

- `energy * zone_intensity` for a cloud candidate (violates Invariant 1)
- Send raw document text to any cloud API for a `pii`-flagged task (violates Invariant 2)
- Use pool min-max for score normalization (violates Invariant 3)
- Present Jev's answer as a routing decision without the scoring formula (violates Invariant 4)
- Call registry calibration "learning" or "training" in UI or code comments (violates Invariant 5)
- Show a grey-dashed simulated curve without a visible "Simulated" badge (violates Invariant 6)
- Report overhead-excluded totals as "this system" performance (violates Invariant 7)
- Apply time-shifting logic to a cloud candidate (violates Invariant 8)
- Show live demo run numbers as "proven savings" without the offline eval table visible (violates Invariant 9)
- Silently drop a subtask below its accuracy floor without a logged warning (violates Invariant 10)
- Hardcode secrets, API keys, or config weights in source files
- Start a new phase before the phase gate is cleared
- Grow any doc beyond one page; summarize or archive instead
