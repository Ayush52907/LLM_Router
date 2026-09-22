# DEMO_SCRIPT.md — ~5 Minute Demo Flow

_Keep this current as features land. Last updated: 2026-09-22_

---

## Pre-Demo Checklist

- [ ] Ollama running with `llama3.2:3b` (local-small) and `mistral:7b` (local-medium) pulled
- [ ] Sidecar running: `cd sidecar && uvicorn main:app`
- [ ] Orchestrator running: `cd orchestrator && npm run dev`
- [ ] Dashboard running: `cd dashboard && npm run dev`
- [ ] Database is fresh OR pre-warmed with known state (document which)
- [ ] Real grid intensity fetched (shows current Bengaluru value, not stale)
- [ ] T1–T5 and T7 all green from last rehearsal run

---

## Scene 1 — The Problem (0:00–0:45)

**Say:** "Every agent workflow blindly sends every step to GPT-4. Nobody can see what each step actually costs in time, money, or carbon. Here's the dispatcher that proves the saving instead of asserting it."

**Show:** The empty dashboard. Point to the headline panel (Cost saved / Carbon saved / Quality retained) — currently at 0. Point to the three comparison bars — show the offline eval numbers labeled "measured offline." Say: "These numbers are real. We ran this 60 times."

**What is real:** Offline eval numbers (measured).
**What is simulated:** Nothing yet.

---

## Scene 2 — Submit the Task (0:45–1:30)

**Say:** "Thirty-page vendor contract. Five steps. Watch how each one gets routed differently."

**Action:** Submit the demo task. Watch the DAG canvas animate.

**Point out:**
- Extract parties/dates node → lock icon → "🔒 forced local" badge. Say: "That's PII. It never leaves this machine."
- Routing animation (pulsing) → each node picks a model.
- Classify clauses → local-small (score wins, cost and energy dominate for a trivial task).
- Flag risky clauses → cloud-strong (accuracy floor forces it — a 0.55-tier model can't meet the 0.80 floor for a high-complexity task).

**What is real:** Actual routing decisions from the scoring formula.
**What is estimated:** Predicted cost/carbon (labeled "predicted").

---

## Scene 3 — The Route Inspector (1:30–2:30)

**Say:** "Not a black box. Click any node."

**Action:** Click the "Flag risky clauses" node.

**Show:**
- Candidate table: 4 rows (local-small, cloud-small, cloud-mid, cloud-strong).
- Stacked bar: each segment colored by factor (lat/acc/cost/energy/carbon).
- Cloud-strong wins because the accuracy floor eliminates the others.
- Jev's bonus chip: show the tiny delta. Say: "Jev is a hint. The formula decides."

**What is real:** Score breakdown using current weights and live grid intensity.
**What is simulated:** Nothing in this panel.

---

## Scene 4 — Escalation (2:30–3:15)

**Say:** "Watch what happens when a model fails verification."

**Action:** Toggle "Inject failure" on the "Draft reply email" subtask. Watch it execute, fail Jev's boolean check, escalate (node flashes red, second badge appears showing small → strong model).

**Point out:**
- Escalation log entry with reason code.
- Overhead: the escalation call is visible in the "This system" overhead segment of the comparison chart.
- Say: "We include this cost. Our totals include every call we make."

**What is real:** Real escalation logic (Jev boolean check + escalation call).
**What is simulated:** The failure injection is labeled "injected fault" in the UI.

**Backup plan if Jev is unavailable:** Heuristic fallback router routes the same subtask. Escalation still fires. Say: "Jev is down — you're seeing the rule-based fallback, which also uses the same scoring formula."

---

## Scene 5 — Slider Demo (3:15–3:45)

**Say:** "What if carbon is your top priority?"

**Action:** Move `w_carbon` slider from 0.15 to 0.50. At least one subtask (classify clauses) re-routes visibly.

**Point out:** The DAG updates. The stacked bar in the Route Inspector shifts — carbon segment is now dominant.

**What is real:** Live recalculation using the scoring formula.
**What is simulated:** Nothing.

---

## Scene 6 — The Honest Numbers (3:45–4:30)

**Say:** "Here's the summary. These numbers are real."

**Show:** Bottom comparison chart. Three bars:
- Always-strongest: 100% cost, 100% carbon, 100% quality (baseline)
- Random: ~X% cost, variable quality
- **This system:** ~Y% cost saved, ~Z% carbon saved, quality retained ≥ 95%

**Point out:** The "overhead" segment in the This System bar. Say: "That's our own cost — Jev calls, embedding, verification. We include it."

**Also point out:** Footer — "Cloud vs local carbon uses different measurement boundaries." Say: "We disclose this because it matters. A cloud vs local comparison can be systematically biased toward local."

**What is real:** Measured offline eval numbers.
**What is estimated/labeled:** Live run deltas labeled "live estimate."

---

## Scene 7 — Carbon Grid Panel (optional, if time: 4:30–5:00)

**Show:** Right panel, grid gauge. Current Bengaluru intensity: [real value] gCO2/kWh.

**Show:** Grey-dashed simulated forecast below it, with "Simulated — not live data" badge.

**Say:** "The solid line is real. The dashed line is what time-shifting would look like with a real forecast. We run a real data poller so by demo day you can see yesterday's actual curve."

**What is real:** Current grid intensity value.
**What is simulated:** Forecast curve (clearly labeled, visually distinct).

---

## Recovery Plans

| What breaks | What to say | What to show |
|---|---|---|
| Jev API down | "Jev is down — fallback router active." | Heuristic router still scores and routes. |
| Electricity Maps down | "Grid intensity unavailable — using last cached value." | Cached value with `(cached)` label. |
| Ollama OOM | Pre-run and cache a mock response. | Label it "pre-computed." |
| Cloud model rate-limit | Use mock fixture for that subtask. | Label "mocked (rate limited)." |
| Sidecar crashes | Mock sidecar with fixed carbon values. | Label "estimated (sidecar offline)." |

---

## What Is Real vs. Simulated vs. Estimated — Master Table

| Item | Status | Label in UI |
|---|---|---|
| Routing decisions | Real (scoring formula) | (no label needed) |
| Baseline comparison bars | Real (offline eval, N=60) | "Measured offline" |
| Live run cost/carbon deltas | Estimated (registry-based) | "Live estimate" |
| Current grid intensity | Real (Electricity Maps live) | (solid gauge) |
| Forecast curve | Simulated (hand-authored JSON) | "Simulated — not live data" (grey dashed) |
| Jev confidence scores | Real (from Jev API) | (shown in Route Inspector) |
| Escalation fault injection | Injected (not natural failure) | "Injected fault" badge |
| PII redaction | Real (Presidio/spaCy) | "best-effort NER" in footer |
| Accuracy tier values | Benchmark-derived estimates | "MMLU-based tier estimate" in registry |
