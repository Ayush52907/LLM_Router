# ACCEPTANCE_TESTS.md — T1–T7 Status

_Run before every rehearsal. Update status column after each run._
_Last updated: 2026-09-22_

---

| ID | Name | Status | Phase |
|---|---|---|---|
| T1 | Slider flip | 🟢 Passing | Phase 1 gate |
| T2 | Jev bounded | 🟢 Passing | Phase 1 gate |
| T3 | Canary PII | 🟢 Passing | Phase 3 gate |
| T4 | Floor check | 🟢 Passing | Phase 1 |
| T5 | Escalation | 🟢 Passing | Phase 5 |
| T6 | Cold start | 🟢 Passing | Phase 8 |
| T7 | Baseline | 🟢 Passing | Phase 2 gate |

---

## T1 — Slider Flip

**Definition:** Moving `w_carbon` from 0.15 to 0.5 (with other weights rebalanced to sum to 1) flips at least one subtask in the demo task from cloud to local.

**Why it matters:** Proves the scoring formula actually responds to weight changes — the v2 bug was an accuracy term that didn't vary by candidate.

**How to run:**
```bash
cd orchestrator
npx ts-node scripts/test-slider-flip.ts
```

**Expected output:** At least one subtask shows `routed_to: cloud` with w_carbon=0.15 and `routed_to: local` with w_carbon=0.5.

**If it fails:** Fix the registry (check cloud vs local carbon values) or bounds (check `carbon_kgco2eq` bound is not too large, making all values clamp to near-0). Do NOT adjust the formula or weights to paper over it.

---

## T2 — Jev Bounded

**Definition:** With the Jev confidence bonus removed (set `jev_confidence = 0`), no more than 1 routing decision in the 5-subtask demo task changes.

**Why it matters:** Proves Jev is a bonus, not the deciding factor. The formula must dominate.

**How to run:**
```bash
cd orchestrator
npx ts-node scripts/test-jev-bounded.ts
```

**Expected output:** 0 or 1 subtask changes routing when bonus is zeroed out. If 2+ change, Jev's bonus weight is too large.

---

## T3 — Canary PII Test

**Definition:** Plant unique fake PII strings in the synthetic contract (e.g., `CANARY-PARTY-12345-ACME-CORP`). Log all outbound HTTP requests. Assert zero canary strings appear in any outbound request body to a non-local destination.

**Why it matters:** This is the live proof for the privacy claim. Show the outbound HTTP log during the demo.

**How to run:**
```bash
cd orchestrator
npx ts-node scripts/canary-pii-test.ts --contract eval/contracts/synthetic-01.md --log-outbound
```

**Expected output:** `✅ PASS: 0 canary strings found in outbound requests to external hosts.`

---

## T4 — Floor Check

**Definition:** No subtask in the demo task routes to a model whose `accuracy_tier` is below `effective_floor(complexity_tier)` without a logged relaxation warning.

**Why it matters:** Ensures the accuracy floor is enforced and not silently dropped.

**How to run:**
```bash
cd orchestrator
npx ts-node scripts/test-floor-check.ts
```

**Expected output:** For each subtask, either the routed model meets the floor, OR a warning log entry exists with `reason: accuracy_floor_relaxed`.

---

## T5 — Escalation

**Definition:** (a) A fault-injected subtask triggers escalation to a higher-tier model. (b) An escalation that would breach the workflow budget fails closed (status `failed`, reason `budget_blocked_escalation`).

**How to run:**
```bash
cd orchestrator
npx ts-node scripts/test-escalation.ts --inject-failure subtask-3
```

**Expected output:**
- Subtask-3 escalates: `escalation_events` table has an entry, `from_model` and `to_model` populated.
- Budget-constrained subtask: `status: failed`, `reason_code: budget_blocked_escalation`.

---

## T6 — Cold Start

**Definition:** On a fresh (empty) database, the similarity cache hit rate is 0%.

**How to run:**
```bash
rm -f db.sqlite
cd orchestrator
npx ts-node scripts/test-cold-start.ts
```

**Expected output:** After running the demo task once, cache hit rate reported as `0/5 (0%)`. No fabricated warm-cache numbers.

---

## T7 — Baseline

**Definition:** (a) The `baseline_runs` table contains entries for `always_strongest` and `random` baseline types with `measured: 1` from the offline eval. (b) The dashboard live view labels live run numbers as "estimated" and shows offline eval numbers labeled "measured offline."

**How to run:**
```bash
cd eval
npx ts-node harness.ts --runs 3
```
Then open dashboard and verify labels.

**Expected output:** Dashboard shows two clearly separated data sets: "Measured (offline, N=60)" and "Live estimate". Never mixed. No number presented without its source label.
