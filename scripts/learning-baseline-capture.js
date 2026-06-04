#!/usr/bin/env node
/**
 * Capture pre-CLOL baseline for before/after comparison.
 */
const fs = require('fs');
const path = require('path');
const {
  EvolutionKernel,
  operationalSuccessRate,
} = require('../packages/self-evolution/dist/index');

const DATA_DIR = path.resolve('data');
const LEARNED_DIR = path.join(DATA_DIR, 'learned');
const OUT = path.join(LEARNED_DIR, 'learning-baseline.json');

function loadLegacyHf() {
  const reportPath = path.join(LEARNED_DIR, 'training-3x50-report.json');
  if (!fs.existsSync(reportPath)) return null;
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  return {
    source: 'hf-3x50-heuristic',
    campaigns: (report.campaigns || []).map((c) => ({
      name: c.campaign,
      iterations: c.iterations,
      totalSamples: c.totalSamples,
      finalSuccessRate: c.finalSuccessRate,
      policyVersion: c.policyVersion,
      note: 'HF heuristic success (reference overlap), not operational CLOL',
    })),
  };
}

function main() {
  const kernel = new EvolutionKernel(LEARNED_DIR, 'policy-operational.json');
  kernel.policyStore.reset();

  const goldenBefore = kernel.operational.evaluateGoldenSet();
  const policy = kernel.policyStore.get();
  const bridge = kernel.policyBridge.apply(policy);

  const baseline = {
    capturedAt: new Date().toISOString(),
    mode: 'pre-clol-1000',
    operational: {
      goldenSetSuccessRate: goldenBefore,
      goldenTaskCount: 10,
      policyVersion: policy.version,
      qualityThreshold: policy.qualityThreshold,
      experienceBufferSuccessRate: kernel.experience.getSuccessRate(),
      telemetryCount: kernel.telemetry.count(),
    },
    runtimeBridge: bridge,
    policySnapshot: policy,
    legacyHfTraining: loadLegacyHf(),
  };

  fs.mkdirSync(LEARNED_DIR, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(baseline, null, 2));
  fs.writeFileSync(
    path.join(LEARNED_DIR, 'policy-operational-baseline.json'),
    JSON.stringify(policy, null, 2)
  );

  console.log('📸 Baseline captured');
  console.log(`   Golden set (operational): ${(goldenBefore * 100).toFixed(1)}%`);
  console.log(`   Output: ${OUT}`);
}

main();
