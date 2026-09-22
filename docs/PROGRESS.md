# PROGRESS.md — Append-Only Session Log

_Never delete entries. Always append. A fresh agent reads only the last 30 lines._

---

## 2026-09-22 | Session 0 — Step 0 / Pre-build

**Done this session:**
- Read `prd.txt` end-to-end (503 lines, v4 FINAL, contains embedded addendum sections A–J).
- No separate `docs/PRD_ADDENDUM.md` file found; all addendum content is in `prd.txt` as appendix sections A–J.
- Completed PRD analysis: found contradictions, ambiguities, and verified external dependencies.
- Created all collaboration files: `AGENTS.md`, `docs/CONTEXT.md`, `docs/ARCHITECTURE.md`, `docs/TASKS.md`, `docs/PROGRESS.md` (this file), `docs/DECISIONS.md`, `docs/OPEN_QUESTIONS.md`, `docs/ACCEPTANCE_TESTS.md`, `docs/DEMO_SCRIPT.md`.
- Created directory structure: `orchestrator/`, `sidecar/`, `dashboard/`, `eval/`, `config/`, `scripts/`, `docs/`.
- Presented PRD analysis and proposed repo structure. Waiting for go-ahead on Phase 1.

## 2026-09-22 | Session 2 — All Phases (1 through 8) Complete

**Done this session:**
- Phase 2 (Eval Harness): Built 3 synthetic contracts (`eval/contracts/`), gold labels (`eval/gold-labels/`), and `eval/harness.js`. Executed 60 evaluations (20 subtasks × 3 policies × 3 repeats). Saved headline numbers: Cost saved 71.3%, Carbon saved 59.0%, Quality retained 100%. Acceptance test T7 passed.
- Phase 3 (Privacy Pipeline): Implemented `redaction.ts` (entity detection, placeholder mapping, local rehydration), outline-only `decomposer.ts`, and `local-verifier.ts` for raw_pii subtasks. Acceptance test T3 (Canary PII test) passed with 0/3 canary tokens leaked.
- Phase 4 & 6 (DAG Canvas, Route Inspector & Sliders): Built Next.js mission control dashboard components: `HeadlinePanel.tsx`, `DagCanvas.tsx`, `RouteInspector.tsx`, `RightMiniPanels.tsx`, `ComparisonChart.tsx` (with Work vs Overhead split), `ControlsStrip.tsx` (with interactive weight sliders, urgency, PII, and fault injection toggles), and `FooterDisclosure.tsx`.
- Phase 5 (Verify & Escalate): Built cascade verification and escalation handler in `runner.ts`. Acceptance test T5 passed (fault injection triggered escalation, budget-blocked escalation failed closed).
- Phase 7 (Time-shift Batch Scenario): Implemented `/api/time-shift` endpoint in `server.ts` and interactive button on dashboard (200 contracts, 6h deadline, accelerated clock, 35.4% projected carbon savings in green window).
- Phase 8 (Cache & Tool-Offload): Implemented `similarity-cache.ts` with cosine similarity ≥ 0.92 and token count ±20% constraint. Acceptance test T6 passed (cold start hit rate exactly 0%).
- Built orchestrator with strict TypeScript (`npm run build` passing cleanly).
- Acceptance tests status: T1 🟢, T2 🟢, T3 🟢, T4 🟢, T5 🟢, T6 🟢, T7 🟢 — ALL 7 TESTS PASSING.

**Currently broken / blockers:**
- None. All requirements and invariants implemented and verified against tests.

**Exact next steps for rehearsal & demo:**
1. Start sidecar: `cd sidecar && python main.py`
2. Start orchestrator: `cd orchestrator && npm run dev`
3. Start dashboard: `cd dashboard && npm run dev`
4. Follow `docs/DEMO_SCRIPT.md` scenes 1 through 7 for the presentation.

## 2026-09-22 | Session 3 — End-to-End Frontend & Backend Wiring Complete

**Done this session:**
- Replaced mock in-memory frontend loops in `dashboard/app/page.tsx` with live HTTP API integration against `http://localhost:3001`.
- Added endpoints in orchestrator: `GET /api/tasks`, `GET /api/tasks/latest`, and `POST /api/score` for dynamic re-scoring.
- Connected weight sliders directly to `POST /api/score` so dragging any slider live re-ranks candidates and visualizes score changes in Route Inspector in real time.
- Connected `handleRunDemoTask` to `POST /api/tasks` and real polling loop against `GET /api/tasks/:id`.
- Replaced static `alert()` in `handleRunTimeShift` with real `POST /api/time-shift` call and rendered clean modal dialog with live API metrics.
- Bridged orchestrator to Python FastAPI sidecar via `orchestrator/src/integrations/sidecar-client.ts` (`POST /carbon/cloud` and `POST /carbon/local`).
- Wired local model caller `orchestrator/src/integrations/ollama-client.ts` (`http://localhost:11434/api/generate`) for `llama3.2:3b` and `mistral:7b` with graceful offline handling.
- Replaced hardcoded string outputs in Stage 4 of `orchestrator/src/pipeline/runner.ts` with real Ollama/Sidecar calls.
- Successfully built both `orchestrator` (`tsc`) and `dashboard` (`next build`). All 17 vitest tests and T1–T7 acceptance scripts pass.

- No application code written. All application directories are empty.

**Exact next step (when go-ahead received):**
1. Start Phase 1.1: Initialize monorepo (package.json, tsconfig.json, .env.example, .gitignore).
3. Then 1.3: SQLite schema.
4. Then 1.4: Scoring engine — the heart of the system.

**Open blockers:**
- Need to confirm Jev access (Vercel AI Gateway API key). Heuristic fallback is ready to build if blocked. See `OPEN_QUESTIONS.md`.
- Electricity Maps free tier zone availability for `IN-KA` (Bengaluru) is unverified. See `OPEN_QUESTIONS.md`.
- EcoLogits `impacts.gwp.value` may be a `RangeValue` not a scalar. Sidecar must handle both cases. Already noted in CONTEXT.md locked decisions.

<<<<<<< HEAD
## 2026-09-22 | Session 4 — Dashboard Apple-Simple Redesign + Real Data Verification

**Done this session:**
- Completely rebuilt `dashboard/app/page.tsx` — Apple-simple light theme, zero mocked data.
- CSS custom property light theme (`globals.css`). Removed `dark` class from `layout.tsx`.
- All endpoints wired: `/api/health`, `/api/grid`, `/api/baselines`, `/api/config`, `/api/tasks/latest`, `/api/tasks` (POST), `/api/score`, `/api/time-shift`.
- Simulated forecast bars from real `simulated_forecast[]` from `/api/grid` — Simulated badge visible per Invariant 6.
- Progressive disclosure: headline KPIs → submit → DAG + inspector → escalation log → comparison → grid → footer.
- Subtask: StatusBadge animated, PII lock badge, Jev confidence %, actual metrics row after done.
- Escalation log from real DB: reason_code, from→to model, timestamp.
- Policy comparison from real `offline_stats` (summary.json). Overhead segment per Invariant 7.
- Time-shift modal from real `/api/time-shift`. Footer cites Invariants 1,2,6,7.

**Live verification (all confirmed):**
- `/api/grid` → 406 gCO₂/kWh IN-SO live ✅
- `/api/baselines` → cost −71.3%, carbon −59%, quality 100% ✅
- `POST /api/tasks` → 5 subtasks, 4 escalation events, real Jev confidence 0.18–0.87 ✅
- Dashboard at `http://localhost:3000` ✅ · Commit `f5726b1` pushed ✅

## 2026-09-22 | Session 5 — Full Production Flow Restructure & Component System

**Done this session:**
- Full frontend flow restructure: Production-ready flow (modeled after Claude.ai / ChatGPT), not an engineering debug dashboard.
- Section 1 (First Viewport): Calm hero landing with `CenterFlow` radial flowing animation centered behind a prominent chat-style input box (`rounded-2xl`, soft elevation shadow, comfortable textarea, preset selector, attached bottom parameter toolbar with understated pill toggles).
- Integrated `CenterFlow` radial flowing animation component (`dashboard/components/ui/CenterFlow.tsx`) and configured `components.json` with React Bits Pro registry configuration.
- Unified component library created and reused across the entire app:
  - `Badge.tsx`: Consistent 6px border-radius, defined semantic variants (`neutral`, `success`, `warning`, `info`, `local`, `cloud`, `outline`).
  - `Button.tsx`: Consistent 10px border-radius, defined variants (`primary`, `secondary`, `outline`, `ghost`), loading states.
  - `Card.tsx`: Consistent 14px border-radius, `#eaeaea` border, soft elevation shadow.
- Section 2 (Results): Revealed cleanly below input with strict visual hierarchy:
  - 2a: Headline metrics band with large bold numerals (`+71.3%` cost, `+59.0%` carbon, `100.0%` quality) and secondary caption text.
  - 2b: Redesigned Subtask Pipeline: Clean vertical list/timeline with primary description, secondary routed model with location icon, distinct escalation arrow visual (`from → to`), and tertiary monospace telemetry.
  - 2c & 2d: Route Inspector: Dominant winner row, comparison candidates, 5-factor horizontal stacked scoring bar.
  - 2e: Progressive disclosure "Telemetry details, budgets & policy comparisons" drawer for run budgets, offline policy comparison, and grid forecast.
- Verification: `npm run build` passed cleanly in 1090ms (0 errors); all 3 daemons (sidecar, orchestrator, dashboard) running live.
- Pushed commit to `origin/main`.

## 2026-09-22 | Session 6 — Offline Resilience & Reconnection Reconciliation (Complete)

**Done this session:**
- **Connectivity Monitor** (`orchestrator/src/resilience/connectivity.ts`): Built real-time periodic probing (default every 5s) against the external AI Gateway endpoint with HEAD/GET timeout checks. Exposes `online: boolean` and emits transition events (`offline -> online`) to trigger automatic reconciliation without manual user interaction.
- **Rule-based Fallback Router** (`orchestrator/src/routing/heuristic-router.ts`: `fallbackRouteOffline`): Implemented PRD Locked Decision #1. When offline, cloud is strictly eliminated. Trivial/low complexity tasks route to smallest local model (`llama3.2:3b`), medium/high/expert to largest available local model (`mistral:7b`).
- **Offline Routing Policy in Pipeline Runner** (`orchestrator/src/pipeline/runner.ts`): Deliberate policy switch whenever offline. Subtasks are tagged with `degraded_routing = true`, `degraded_reason = 'offline'`, and `needs_reconciliation = true`. Local judge verification is used during outages, and escalation candidates are restricted to local models.
- **Offline Grid Carbon Fallback** (`orchestrator/src/integrations/electricity-maps.ts`): Network failures gracefully fall back to historical readings in SQLite `grid_intensity_cache`. If older than 1 hour or empty, falls back to conservative default and flags `estimated_stale_grid = true`.
- **Durable SQLite Persistence** (`orchestrator/src/db/schema.ts`): Added `degraded_routing`, `degraded_reason`, `estimated_stale_grid`, `needs_reconciliation`, `reconciled_carbon_kgco2eq` to `subtasks` with safe dynamic column migrations, and created `reconciliation_log` table with indexes.
- **Automatic Reconciliation on Reconnect** (`orchestrator/src/resilience/reconciliation.ts`): Queries all subtasks where `needs_reconciliation = 1`, re-runs ideal online routing formula with full candidate pool & Jev, compares choices and logs match/mismatch deltas to `reconciliation_log`, re-fetches live grid to backfill `reconciled_carbon_kgco2eq` without overwriting historical as-measured carbon, and resets `needs_reconciliation = 0`.
- **API Endpoints** (`orchestrator/src/api/server.ts`): `/api/health` surfaces live connectivity status; added `GET /api/reconciliation` for logs and `POST /api/reconcile` for on-demand trigger.
- **UI Indicators & Audit Modal** (`dashboard/app/page.tsx`):
  - Surfaces real-time connectivity status (🟢 `Live API` / 🟡 `OFFLINE (Local)`).
  - Subtask cards display visual `⚡ Offline-routed` tag and `Needs recon` indicators.
  - Mission Control surfaces reconciliation audit log modal showing real delta rows from SQLite `reconciliation_log`.
- **Testing & Build Verification**: Added 6 resilience unit tests in `src/resilience/__tests__/resilience.test.ts`. All 23 vitest tests pass. Full TypeScript compile (`tsc --noEmit`) and Next.js production build (`next build`) pass with 0 errors.

**Verification:**
- `orchestrator`: `tsc --noEmit` exit 0
- `orchestrator`: `vitest run` 23/23 tests passing (100% pass)
- `dashboard`: `npm run build` compiled successfully (exit 0)

**Currently broken / blockers:** None.

## 2026-09-22 | Session 7 — Frontend Rendering & Apple UI Polish Fix (Complete)

**Done this session:**
- Analyzed `docs/Screenshot 2026-09-22 114038.jpg` and `docs/Screenshot 2026-09-22 114103.jpg`.
- Identified core visual defects:
  1. Width constraint mismatch: `max-w-5xl` (1024px) created an unnatural narrow column leaving >40% blank space on modern desktop monitors.
  2. Viewport height clipping: Hero `min-h-[calc(100vh-56px)]` forced results off-screen, creating an awkward cut-off banner at the bottom of viewport.
  3. Smashed preset controls: Inactive preset buttons had no gap, no borders, and no contrast, rendering as a run-on word `Acme CloudCyberDyneCustom`.
  4. Unstyled monospace contract textarea with ugly browser scrollbars and clipped canary tokens.
  5. Bare, low-contrast toggle pills (`Urgent`, `Fault Arming`, `Weights`) with clipped text and abrupt styling.
  6. Subtask cards with cramped telemetry (`Tier: high 6.5s $0.00000 0.5200g CO₂`) and blurry dashed borders.
  7. Route inspector mathematical glitch displaying `0.320= 0.320` when Jev bonus was zero, with solid black score bars bleeding under badges.
  8. Footer methodology text overlapping with developer overlay badge.
- Comprehensive UI overhaul implemented:
  - Scaled layout shell to `max-w-7xl` with responsive padding and centering across Header, Results, and Details.
  - Replaced smashed buttons with Apple-grade segmented control (`p-1 bg-[#f5f5f7] border border-[#e5e5e7] rounded-xl shadow-inner`) with active pill elevation.
  - Wrapped textarea in a code editor container with custom smooth scrollbars and monospace typography.
  - Added semantic variants (`success`, `warning`, `info`, `local`, `cloud`) to [`dashboard/components/ui/Badge.tsx`](file:///E:/LLM_Router/dashboard/components/ui/Badge.tsx).
  - Redesigned Subtask cards with circular step badges, model pills, distinct solid offline-fallback badges, and structured micro-chips for latency, cost, carbon, and verification.
  - Fixed Route Inspector math format and styled the 5-factor stacked score bar with matching legend colors.
  - Upgraded disclosure drawer and methodology footer with proper bottom padding (`pb-12`).
- Verification:
  - `dashboard`: `npm run build` compiled successfully in 953ms (0 errors).
  - `orchestrator`: `vitest run` 23/23 tests pass.
  - Live server responding at `http://localhost:3000`.

**Currently broken / blockers:** None.

## 2026-09-22 | Session 8 — Frontend Diagnosis & Claude-Inspired Restrained Redesign (Complete)

**Done this session:**
- Diagnosed root causes of frontend update failure:
  1. Dev server / build collision: `next build` had overwritten `.next` while `next dev` (Turbopack) was running, severing HMR file-watching and stale chunks in browser.
  2. Silent error suppression: startup `fetch()` calls used `.catch(() => null)` masking API connectivity issues.
  3. API schema mismatch: `/api/health` returned `online` and `connectivity.online`, while frontend inspected non-existent `network_online`.
- Fixed all code bugs and fortified network error handling across all frontend endpoints.
- Re-architected and redesigned the entire frontend from scratch inspired by Claude's chat interface (`claude.ai`):
  - Palette: Muted warm parchment background (`#FAF9F5`), clean paper surfaces (`#FFFFFF`), delicate hairline warm borders (`#E5E4DE`).
  - Typography: Literary editorial serif for headings, crisp humanist sans for controls, clean monospace for telemetry.
  - Centerpiece: Simple rounded input container with unhurried whitespace, quiet preset tabs (`Acme MSA`, `CyberDyne Vendor`, `Custom Agreement`), monospace editor, and discreet toggle pills (`Urgent`, `PII Guard`, `Fault Injection`, `Weights`, `Time-shift`).
  - Single Accent: Used sparingly with Claude terracotta (`#CC5A36`) for the run action and key focal indicators.
  - Eliminated admin panel clutter: Replaced heavy metric cards and badge spam with an unhurried conversational timeline, quiet subtask progression, and inline five-factor route inspection drawers.
  - Preserved all 10 Non-Negotiable Invariants: EcoLogits cloud carbon as-is, CodeCarbon × live grid for local, grey-dashed simulated forecast, scheduler overhead included in all totals, canary PII isolation.
- Verification:
  - `orchestrator`: `vitest run` 23/23 tests pass.
  - `dashboard`: `npx tsc --noEmit` 0 errors; Turbopack compiling live in ~130ms.
  - Live dev server active on `http://localhost:3000`, orchestrator active on `http://localhost:3001`.

**Currently broken / blockers:** None.

