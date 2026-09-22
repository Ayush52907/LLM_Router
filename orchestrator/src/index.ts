import * as dotenv from 'dotenv';
import * as path from 'path';

// Load root .env first, then local .env if present
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();
import { getDb, seedModels } from './db/schema.js';
import { loadConfig } from './registry/config-loader.js';
import { createServer } from './api/server.js';
import { getConnectivityMonitor } from './resilience/connectivity.js';
import { runReconciliationPass } from './resilience/reconciliation.js';
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

function start() {
  const config = loadConfig();
  const db = getDb();

  // Seed models registry table
  seedModels(db, config.models as any);

  // Start real-time network connectivity monitor (PRD Offline Resilience)
  const monitor = getConnectivityMonitor();
  monitor.start(5000);
  monitor.onStatusChange(async (isOnline, wasOnline) => {
    if (!wasOnline && isOnline) {
      console.log('⚡ [Auto-Reconcile] Internet connectivity restored! Running automatic reconciliation pass...');
      try {
        const summary = await runReconciliationPass();
        console.log(`⚡ [Auto-Reconcile] Complete: ${summary.summaryMessage}`);
      } catch (err: any) {
        console.error('❌ [Auto-Reconcile] Error in reconciliation pass:', err.message);
      }
    }
  });

  const app = createServer();
  const port = process.env['ORCHESTRATOR_PORT'] ? parseInt(process.env['ORCHESTRATOR_PORT'], 10) : 3001;

  app.listen(port, () => {
    console.log(`🚀 Orchestrator API running on http://localhost:${port}`);
    console.log(`   Local Grid Zone: ${config.localZone} (${config.mockGridIntensityGco2PerKwh} gCO2/kWh default mock)`);
    console.log(`   Models loaded: ${config.models.map(m => m.model_id).join(', ')}`);
    console.log(`   Connectivity monitor: probing ${monitor.probeUrl} every 5s`);
  });
}

start();
