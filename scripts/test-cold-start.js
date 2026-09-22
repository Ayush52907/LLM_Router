#!/usr/bin/env node
/**
 * scripts/test-cold-start.js — Acceptance Test T6 (Cold Start Cache Hit Rate)
 *
 * Implements PRD Addendum I:
 * On a fresh cache / database, the similarity cache hit rate is 0%.
 * No fabricated warm-cache numbers.
 */

const { SimilarityCache } = require('../orchestrator/dist/cache/similarity-cache.js');

function runColdStartTest() {
  console.log('Running Acceptance Test T6: Cold Start Cache Verification...');

  const cache = new SimilarityCache();

  // Fresh cache: perform 5 lookups
  const sampleQueryEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
  for (let i = 0; i < 5; i++) {
    const match = cache.lookup(sampleQueryEmbedding, 2000);
    if (match !== null) {
      console.error('❌ T6 FAIL: Fresh cache returned a match on cold start!');
      process.exit(1);
    }
  }

  const { hits, misses, rate } = cache.getHitRate();
  console.log(`Cache stats on fresh startup: Hits=${hits}, Misses=${misses}, HitRate=${(rate * 100).toFixed(1)}%`);

  if (hits === 0 && misses === 5 && rate === 0) {
    console.log('✅ T6 PASS: Cold start cache hit rate is exactly 0% (0/5 hits). Honest cold start verified.');
    process.exit(0);
  } else {
    console.error(`❌ T6 FAIL: Expected 0% hit rate, got ${(rate * 100).toFixed(1)}%`);
    process.exit(1);
  }
}

runColdStartTest();
