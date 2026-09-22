#!/usr/bin/env node
/**
 * scripts/test-e2e-pipeline.js — Comprehensive End-to-End Test
 *
 * Tests:
 * 1. Model Registry includes Gemini models (gemini-1.5-flash, gemini-1.5-pro) and local models.
 * 2. Online Pipeline Execution: routes to Gemini/cloud/local models, executes, generates outputs.
 * 3. Subtask Outputs: all subtasks produce non-empty, domain-specific structured outputs.
 * 4. Task Deliverable: task.output is synthesized into a complete report.
 * 5. Invariant 2: PII tasks stay strictly local.
 * 6. Offline Pipeline Execution: when offline, cloud is eliminated, routes strictly to local models,
 *    produces complete offline outputs, and flags degraded_routing = true.
 */

const path = require('path');
const { pathToFileURL } = require('url');
const repoRoot = path.resolve(__dirname, '..');

async function runE2ETest() {
  console.log('================================================================');
  console.log('🧪 Starting End-to-End Pipeline & Output Generation Test');
  console.log('================================================================\n');

  // Dynamic import with pathToFileURL for Windows ESM support
  const runnerPath = path.join(repoRoot, 'orchestrator', 'src', 'pipeline', 'runner.ts');
  const { runTaskPipeline } = await import(pathToFileURL(runnerPath).href);

  const configPath = path.join(repoRoot, 'orchestrator', 'src', 'registry', 'config-loader.ts');
  const { loadConfig } = await import(pathToFileURL(configPath).href);

  const connPath = path.join(repoRoot, 'orchestrator', 'src', 'resilience', 'connectivity.ts');
  const { getConnectivityMonitor } = await import(pathToFileURL(connPath).href);

  const config = loadConfig();
  console.log('1. Checking Model Registry...');
  const geminiModels = config.models.filter(m => m.model_id.startsWith('gemini'));
  const localModels = config.models.filter(m => m.location === 'local');
  const cloudModels = config.models.filter(m => m.location === 'cloud');

  console.log(`   Found ${config.models.length} total models:`);
  console.log(`   - Local models (${localModels.length}): ${localModels.map(m => m.model_id).join(', ')}`);
  console.log(`   - Cloud models (${cloudModels.length}): ${cloudModels.map(m => m.model_id).join(', ')}`);
  console.log(`   - Gemini models (${geminiModels.length}): ${geminiModels.map(m => m.model_id).join(', ')}`);

  if (geminiModels.length < 2) {
    throw new Error('❌ Expected at least 2 Gemini models in registry!');
  }
  console.log('   ✅ Registry check passed.\n');

  // ── TEST 1: Online Execution with Output Generation ────────────────────────
  console.log('2. Running Online Pipeline (Contract Analysis)...');
  const monitor = getConnectivityMonitor();
  monitor.setMockOnline(true);

  const sampleContract = `# MASTER SERVICES AGREEMENT — ACME CLOUD & OMNI RETAIL
Effective Date: January 15, 2026 | Contract ID: MSA-2026-0891

## 1. PARTIES
- Provider: Acme Cloud Technologies Inc., Sarah J. Jenkins (sarah.jenkins@acmecloud.example.com)
- Customer: Omni Retail Solutions LLC, Marcus Vance (m.vance@omniretail.example.com)

## 2. OBLIGATIONS & SERVICE LEVELS
3.1 Uptime: 99.9% monthly. 3.2 Data Protection: AES-256 at rest, TLS 1.3 in transit.

## 3. INTELLECTUAL PROPERTY (RISK)
4.1 Customer irrevocably assigns to Provider all rights to derivative works.

## 4. INDEMNITY & LIABILITY (RISK)
5.1 Customer provides uncapped indemnity for all third-party claims.`;

  const onlineResult = await runTaskPipeline({
    rawInput: sampleContract,
    urgency: 'normal',
    dataSensitivity: 'pii',
  });

  console.log(`   Task ID: ${onlineResult.task.id}`);
  console.log(`   Subtasks Executed: ${onlineResult.subtasks.length}`);

  // Validate Subtask Outputs
  let allOutputsValid = true;
  for (let i = 0; i < onlineResult.subtasks.length; i++) {
    const st = onlineResult.subtasks[i];
    console.log(`   [Subtask ${i + 1}] ${st.description}`);
    console.log(`     - Model: ${st.routed_model} (${st.routed_location})`);
    console.log(`     - Output Length: ${st.output ? st.output.length : 0} chars`);
    console.log(`     - Output Preview: "${st.output ? st.output.substring(0, 70).replace(/\n/g, ' ') : ''}..."`);

    if (!st.output || st.output.length < 20) {
      allOutputsValid = false;
      console.error(`     ❌ Subtask ${i + 1} output is missing or too short!`);
    }

    // Check Invariant 2 for raw_pii subtasks
    if (st.pii_class === 'raw_pii') {
      if (st.routed_location !== 'local') {
        throw new Error(`❌ Invariant 2 Violation: raw_pii subtask routed to ${st.routed_location}!`);
      }
      console.log(`     ✅ Invariant 2 verified: raw_pii strictly routed to local model.`);
    }
  }

  if (!allOutputsValid) {
    throw new Error('❌ One or more subtasks failed to generate valid output.');
  }

  // Validate Task Deliverable
  if (!onlineResult.task.output || onlineResult.task.output.length < 100) {
    throw new Error('❌ Task deliverable (task.output) is missing or incomplete!');
  }
  console.log(`   ✅ Task Deliverable synthesized (${onlineResult.task.output.length} chars).`);
  console.log('   ✅ Online Pipeline execution passed.\n');

  // ── TEST 2: Offline Execution with Local Models & Output Generation ───────
  console.log('3. Running Offline Pipeline (Simulating Network Outage)...');
  monitor.setMockOnline(false);

  const offlineResult = await runTaskPipeline({
    rawInput: sampleContract,
    urgency: 'normal',
    dataSensitivity: 'internal',
  });

  console.log(`   Task ID: ${offlineResult.task.id}`);
  for (let i = 0; i < offlineResult.subtasks.length; i++) {
    const st = offlineResult.subtasks[i];
    console.log(`   [Offline Subtask ${i + 1}] ${st.description}`);
    console.log(`     - Model: ${st.routed_model} (${st.routed_location})`);
    console.log(`     - Degraded Routing: ${st.degraded_routing}`);
    console.log(`     - Needs Recon: ${st.needs_reconciliation}`);
    console.log(`     - Output Length: ${st.output ? st.output.length : 0} chars`);

    if (st.routed_location !== 'local') {
      throw new Error(`❌ Offline Violation: subtask routed to cloud model ${st.routed_model} while offline!`);
    }
    if (!st.degraded_routing) {
      throw new Error(`❌ Offline Violation: degraded_routing was not flagged on subtask!`);
    }
    if (!st.output || st.output.length < 20) {
      throw new Error(`❌ Offline Violation: subtask output missing or incomplete!`);
    }
  }

  if (!offlineResult.task.output || !offlineResult.task.output.includes('Offline Local Mode')) {
    throw new Error('❌ Offline deliverable does not document offline execution policy!');
  }
  console.log('   ✅ Offline Pipeline execution passed.\n');

  // Reset monitor
  monitor.setMockOnline(true);

  console.log('================================================================');
  console.log('🎉 ALL END-TO-END TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

runE2ETest().catch((err) => {
  console.error('\n❌ E2E TEST FAILED:', err);
  process.exit(1);
});
