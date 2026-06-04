#!/usr/bin/env node
/**
 * CLOL: 1000 operational learning iterations + before/after comparison report.
 */
const fs = require('fs');
const path = require('path');
const {
  EvolutionKernel,
  operationalSuccessRate,
} = require('../packages/self-evolution/dist/index');

const DATA_DIR = path.resolve('data');
const LEARNED_DIR = path.join(DATA_DIR, 'learned');
const BASELINE_PATH = path.join(LEARNED_DIR, 'learning-baseline.json');
const COMPARISON_PATH = path.join(LEARNED_DIR, 'learning-comparison.json');
const ITERATIONS = parseInt(process.env.CLOL_ITERATIONS || '1000', 10);

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.log('No baseline found — running capture first...');
    require('./learning-baseline-capture.js');
  }
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
}

function pct(n) {
  return `${(n * 100).toFixed(1)}%`;
}

function delta(a, b) {
  const d = b - a;
  return `${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}pp`;
}

async function main() {
  const baseline = loadBaseline();
  const startedAt = new Date().toISOString();

  const kernel = new EvolutionKernel(LEARNED_DIR, 'policy-operational.json');
  const goldenBefore =
    baseline.operational?.goldenSetSuccessRate ?? kernel.operational.evaluateGoldenSet();

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`  CLOL Operational Learning — ${ITERATIONS} iterations`);
  console.log('══════════════════════════════════════════════════════════\n');

  const report = await kernel.operational.runLoop(ITERATIONS);
  const bridge = kernel.policyBridge.apply(report.policy);
  const recentTelemetry = kernel.telemetry.loadRecent(500);
  const opRateAfter = operationalSuccessRate(recentTelemetry);

  const bestCheckpoint = report.checkpoints.reduce(
    (best, c) => (c.goldenSuccessRate > best.goldenSuccessRate ? c : best),
    { iteration: 0, goldenSuccessRate: goldenBefore, policyVersion: 0 }
  );

  const comparison = {
    startedAt,
    finishedAt: new Date().toISOString(),
    iterations: ITERATIONS,
    before: {
      goldenSetSuccessRate: goldenBefore,
      policyVersion: baseline.operational?.policyVersion ?? 0,
      qualityThreshold: baseline.operational?.qualityThreshold ?? 0.55,
      experienceBufferSuccessRate: baseline.operational?.experienceBufferSuccessRate ?? 0,
      runtimeBridge: baseline.runtimeBridge,
      legacyHfTraining: baseline.legacyHfTraining,
    },
    after: {
      goldenSetSuccessRate: report.goldenSetSuccessRate,
      finalOperationalWindowRate: report.finalOperationalSuccessRate,
      telemetryOperationalRate: opRateAfter,
      policyVersion: report.policy.version,
      qualityThreshold: report.policy.qualityThreshold,
      categoryScores: report.policy.categoryScores,
      experienceBufferSuccessRate: kernel.experience.getSuccessRate(),
      telemetryCount: kernel.telemetry.count(),
      runtimeBridge: bridge,
      routingBias: report.policy.routingBias,
    },
    delta: {
      goldenSet: delta(goldenBefore, report.goldenSetSuccessRate),
      policyVersion: `v${baseline.operational?.policyVersion ?? 0} → v${report.policy.version}`,
      qualityThreshold: `${baseline.operational?.qualityThreshold ?? 0.55} → ${report.policy.qualityThreshold}`,
    },
    checkpoints: report.checkpoints,
    bestCheckpoint,
    summaryTable: [
      {
        metric: 'Golden set operational success (final)',
        before: pct(goldenBefore),
        after: pct(report.goldenSetSuccessRate),
        change: delta(goldenBefore, report.goldenSetSuccessRate),
      },
      {
        metric: 'Golden set best @ checkpoint',
        before: pct(goldenBefore),
        after: pct(bestCheckpoint.goldenSuccessRate),
        change: delta(goldenBefore, bestCheckpoint.goldenSuccessRate),
      },
      {
        metric: 'Recent telemetry operational success',
        before: 'N/A',
        after: pct(opRateAfter),
        change: '—',
      },
      {
        metric: 'Policy version',
        before: `v${baseline.operational?.policyVersion ?? 0}`,
        after: `v${report.policy.version}`,
        change: `+${report.policy.version - (baseline.operational?.policyVersion ?? 0)}`,
      },
      {
        metric: 'Max critic engines (bridge)',
        before: String(baseline.runtimeBridge?.maxCriticEngines ?? 4),
        after: String(bridge.maxCriticEngines),
        change: '—',
      },
    ],
    legacyVsCcolNote:
      'Legacy HF 3×50 success rates measure dataset heuristic overlap. CLOL golden set measures simulated operational APPROVED verdict under policy-aware routing.',
  };

  if (baseline.legacyHfTraining?.campaigns) {
    comparison.hfLegacyReference = baseline.legacyHfTraining.campaigns.map((c) => ({
      campaign: c.name,
      hfHeuristicSuccess: pct(c.finalSuccessRate),
      vsCcolGoldenAfter: pct(report.goldenSetSuccessRate),
    }));
  }

  fs.writeFileSync(COMPARISON_PATH, JSON.stringify(comparison, null, 2));
  fs.writeFileSync(
    path.join(LEARNED_DIR, 'policy-operational.json'),
    JSON.stringify(report.policy, null, 2)
  );

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  BEFORE vs AFTER');
  console.log('══════════════════════════════════════════════════════════');
  console.log('| Metric                          | Before  | After   | Δ       |');
  console.log('|---------------------------------|---------|---------|---------|');
  for (const row of comparison.summaryTable) {
    console.log(
      `| ${row.metric.padEnd(31)} | ${String(row.before).padStart(7)} | ${String(row.after).padStart(7)} | ${String(row.change).padStart(7)} |`
    );
  }
  console.log(`\n📁 Comparison: ${COMPARISON_PATH}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
