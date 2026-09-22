/**
 * Orchestrator Entry Point.
 */

import { getDb, seedModels } from './db/schema.js';
import { loadConfig } from './registry/config-loader.js';
import { createServer } from './api/server.js';

function start() {
  const config = loadConfig();
  const db = getDb();

  // Seed models registry table
  seedModels(db, config.models as any);

  const app = createServer();
  const port = process.env['ORCHESTRATOR_PORT'] ? parseInt(process.env['ORCHESTRATOR_PORT'], 10) : 3001;

  app.listen(port, () => {
    console.log(`🚀 Orchestrator API running on http://localhost:${port}`);
    console.log(`   Local Grid Zone: ${config.localZone} (${config.mockGridIntensityGco2PerKwh} gCO2/kWh default mock)`);
    console.log(`   Models loaded: ${config.models.map(m => m.model_id).join(', ')}`);
  });
}

start();
