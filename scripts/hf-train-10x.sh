#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ITERATIONS="${HF_TRAIN_ITERATIONS:-10}"
DATASET="${HF_TRAIN_DATASET:-databricks/databricks-dolly-15k}"

echo "══════════════════════════════════════════"
echo "  HF Dataset Training Loop (${ITERATIONS} iterations)"
echo "  Dataset: ${DATASET}"
echo "══════════════════════════════════════════"

pnpm build:packages > /tmp/hf-train-build.log 2>&1

node -e "
const path = require('path');
const { AIOS } = require('./packages/core/dist/index');

(async () => {
  const aios = new AIOS({
    dataDir: path.resolve('data'),
    skillsDirectory: path.resolve('skills'),
  });

  const report = await aios.runTraining({
    dataset: process.env.HF_TRAIN_DATASET || '${DATASET}',
    iterations: parseInt(process.env.HF_TRAIN_ITERATIONS || '${ITERATIONS}', 10),
  });

  console.log(JSON.stringify({
    iterations: report.iterations.length,
    totalSamples: report.totalSamples,
    finalSuccessRate: report.finalSuccessRate,
    policyVersion: report.finalPolicy.version,
    appliedImprovements: report.finalPolicy.appliedImprovements.length,
  }, null, 2));

  if (report.iterations.length < 1) process.exit(1);
})();
"

echo ""
echo "✅ HF training loop complete"
