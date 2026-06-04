#!/usr/bin/env node
/**
 * Full multi-dataset pipeline: probe → HF tiers → CLOL → comparison report.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LEARNED_DIR = path.resolve('data/learned');
const SKIP_PROBE = process.env.SKIP_PROBE === '1';
const SKIP_HF = process.env.SKIP_HF === '1';
const SKIP_CLOL = process.env.SKIP_CLOL === '1';
const QUICK = process.env.TRAIN_MULTI_QUICK === '1';
const CLOL_ITERS = parseInt(process.env.CLOL_ITERATIONS || (QUICK ? '50' : '500'), 10);

function run(cmd, env = {}) {
  console.log(`\n▶ ${cmd}\n`);
  execSync(cmd, {
    stdio: 'inherit',
    cwd: path.resolve('.'),
    env: { ...process.env, ...env },
  });
}

async function mergeComparison() {
  const comparisonPath = path.join(LEARNED_DIR, 'learning-comparison.json');
  const multiPath = path.join(LEARNED_DIR, 'training-multi-report.json');
  const baselinePath = path.join(LEARNED_DIR, 'learning-baseline.json');
  const legacy3x50 = path.join(LEARNED_DIR, 'training-3x50-report.json');

  let comparison = {};
  if (fs.existsSync(comparisonPath)) {
    comparison = JSON.parse(fs.readFileSync(comparisonPath, 'utf8'));
  }

  const multi = fs.existsSync(multiPath)
    ? JSON.parse(fs.readFileSync(multiPath, 'utf8'))
    : null;
  const baseline = fs.existsSync(baselinePath)
    ? JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
    : null;
  const legacy = fs.existsSync(legacy3x50)
    ? JSON.parse(fs.readFileSync(legacy3x50, 'utf8'))
    : null;

  const { EvolutionKernel, operationalSuccessRate } = require('../packages/self-evolution/dist/index');

  let postMultiOperational = null;
  if (fs.existsSync(path.join(LEARNED_DIR, 'policy-multi.json'))) {
    const k = new EvolutionKernel(LEARNED_DIR, 'policy-multi.json');
    postMultiOperational = {
      goldenSetSuccessRate: k.operational.evaluateGoldenSet(),
      policyVersion: k.policyStore.get().version,
      telemetryOperationalRate: operationalSuccessRate(k.telemetry.loadRecent(300)),
    };
  }

  const merged = {
    ...comparison,
    updatedAt: new Date().toISOString(),
    pipeline: 'multi-dataset',
    baseline,
    hfMultiTraining: multi,
    hfLegacy3x50: legacy?.campaigns ?? null,
    postMultiOperational,
    multiDatasetBreakdown: multi?.campaigns?.flatMap((c) =>
      (c.perDataset ?? []).map((d) => ({
        campaign: c.campaign,
        dataset: d.dataset,
        samples: d.samples,
        avgHeuristicSuccess: d.avgHeuristicSuccess,
      }))
    ),
    notes: {
      heuristic:
        'HF heuristic = evaluateSample overlap/length; per-dataset avg from training-multi-report',
      operational: 'CLOL operational = APPROVED verdict on golden set + telemetry window',
    },
  };

  fs.writeFileSync(comparisonPath, JSON.stringify(merged, null, 2));
  console.log(`\n📁 Merged comparison: ${comparisonPath}\n`);
}

async function main() {
  console.log('══════════════════════════════════════════════════════════');
  console.log('  AIOS Multi-Dataset Training Pipeline');
  console.log(`  QUICK=${QUICK} CLOL_ITERS=${CLOL_ITERS}`);
  console.log('══════════════════════════════════════════════════════════');

  run('pnpm build:packages');

  if (!SKIP_PROBE) {
    run('node scripts/hf-dataset-probe.js');
  }

  if (!SKIP_HF) {
    run('node scripts/learning-baseline-capture.js');
    run('node scripts/hf-train-multi.js', {
      TRAIN_MULTI_QUICK: QUICK ? '1' : '',
      HF_ITER_DELAY_MS: QUICK ? '800' : process.env.HF_ITER_DELAY_MS || '1500',
    });
  }

  if (SKIP_CLOL) {
    await mergeComparison();
    return;
  }

  const { EvolutionKernel } = require('../packages/self-evolution/dist/index');
  const policyFile = fs.existsSync(path.join(LEARNED_DIR, 'policy-multi.json'))
    ? 'policy-multi.json'
    : 'policy-operational.json';

  console.log(`\n▶ CLOL ${CLOL_ITERS} iterations (policy: ${policyFile})\n`);
  const kernel = new EvolutionKernel(LEARNED_DIR, policyFile);
  const goldenBefore = kernel.operational.evaluateGoldenSet();
  const report = await kernel.operational.runLoop(CLOL_ITERS);
  const afterPath = path.join(LEARNED_DIR, 'policy-post-multi-clol.json');
  fs.writeFileSync(afterPath, JSON.stringify(report.policy, null, 2));

  const clolSummary = {
    policyFile,
    iterations: CLOL_ITERS,
    goldenBefore,
    goldenAfter: report.goldenSetSuccessRate,
    telemetryRate: report.finalOperationalSuccessRate,
    policyVersion: report.policy.version,
  };
  fs.writeFileSync(
    path.join(LEARNED_DIR, 'clol-post-multi.json'),
    JSON.stringify(clolSummary, null, 2)
  );

  console.log(
    `\n✅ CLOL: golden ${(goldenBefore * 100).toFixed(1)}% → ${(report.goldenSetSuccessRate * 100).toFixed(1)}%\n`
  );

  await mergeComparison();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
