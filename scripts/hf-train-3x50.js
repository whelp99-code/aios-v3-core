#!/usr/bin/env node
/**
 * Run 3 training campaigns × 50 iterations each:
 * 1. tatsu-lab/alpaca (medium instruct)
 * 2. Open-Orca/OpenOrca (reasoning)
 * 3. Multi-dataset rotation (alpaca → dolly → no_robots)
 */
const fs = require('fs');
const path = require('path');
const { AIOS } = require('../packages/core/dist/index');
const {
  EvolutionKernel,
  LearnedPolicyStore,
} = require('../packages/self-evolution/dist/index');

const ITERATIONS = parseInt(process.env.HF_TRAIN_ITERATIONS || '50', 10);
const DATA_DIR = path.resolve('data');
const LEARNED_DIR = path.join(DATA_DIR, 'learned');

const SKIP = process.env.SKIP_CAMPAIGNS?.split(',') ?? [];

const CAMPAIGNS = [
  {
    name: 'alpaca',
    policyFile: 'policy-alpaca.json',
    dataset: 'tatsu-lab/alpaca',
    datasets: null,
  },
  {
    name: 'openorca',
    policyFile: 'policy-openorca.json',
    dataset: 'Open-Orca/OpenOrca',
    datasets: null,
  },
  {
    name: 'rotation',
    policyFile: 'policy-rotation.json',
    dataset: null,
    datasets: [
      'tatsu-lab/alpaca',
      'databricks/databricks-dolly-15k',
      'HuggingFaceH4/no_robots',
    ],
  },
];

async function runCampaign(campaign, aios) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  CAMPAIGN: ${campaign.name.toUpperCase()} — ${ITERATIONS} iterations`);
  console.log('═'.repeat(60));

  const policyStore = new LearnedPolicyStore(LEARNED_DIR, campaign.policyFile);
  policyStore.reset();

  const kernel = new EvolutionKernel(LEARNED_DIR, campaign.policyFile);

  const ingestSample = async (sample, iteration) => {
    const ds =
      campaign.datasets?.[(iteration - 1) % (campaign.datasets?.length ?? 1)] ??
      campaign.dataset;
    await aios.knowledge.ingestion.ingest({
      type: 'dataset',
      data: {
        instruction: sample.instruction,
        response: sample.review,
        success: sample.success,
        reward: sample.reward,
        category: sample.category,
        iteration,
        dataset: ds,
        campaign: campaign.name,
        rowIdx: sample.rowIdx,
      },
    });
  };

  const report = await kernel.training.runFullLoop({
    dataset: campaign.dataset ?? undefined,
    datasets: campaign.datasets ?? undefined,
    iterations: ITERATIONS,
    dataDir: LEARNED_DIR,
    ingestSample,
  });

  return {
    campaign: campaign.name,
    policyFile: campaign.policyFile,
    iterations: report.iterations.length,
    totalSamples: report.totalSamples,
    finalSuccessRate: report.finalSuccessRate,
    policyVersion: report.finalPolicy.version,
    appliedImprovements: report.finalPolicy.appliedImprovements.length,
    lastBatch: report.finalPolicy.batchSize,
    summary: report.iterations.map((r) => ({
      iter: r.iteration,
      dataset: r.dataset,
      success: +(r.successRate * 100).toFixed(1),
      samples: r.samplesProcessed,
    })),
  };
}

async function main() {
  fs.mkdirSync(LEARNED_DIR, { recursive: true });
  const aios = new AIOS({
    dataDir: DATA_DIR,
    skillsDirectory: path.resolve('skills'),
  });

  const allResults = [];
  const startedAt = new Date().toISOString();

  function loadSkippedSummary(campaign) {
    const policyPath = path.join(LEARNED_DIR, campaign.policyFile);
    if (!fs.existsSync(policyPath)) return null;
    const p = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    if (p.iteration < ITERATIONS) return null;
    return {
      campaign: campaign.name,
      policyFile: campaign.policyFile,
      iterations: p.iteration,
      totalSamples: null,
      finalSuccessRate: p.successRate,
      policyVersion: p.version,
      appliedImprovements: (p.appliedImprovements || []).length,
      lastBatch: p.batchSize,
      summary: [],
      skipped: true,
    };
  }

  for (const campaign of CAMPAIGNS) {
    if (SKIP.includes(campaign.name)) {
      const cached = loadSkippedSummary(campaign);
      if (cached) {
        console.log(`⏭️  Skipping ${campaign.name} — using completed policy v${cached.policyVersion}`);
        allResults.push(cached);
      } else {
        console.log(`⏭️  Skipping ${campaign.name} (SKIP_CAMPAIGNS, no completed policy)`);
      }
      continue;
    }
    const result = await runCampaign(campaign, aios);
    allResults.push(result);
    console.log(`\n✅ ${campaign.name} done: ${result.totalSamples} samples, ${(result.finalSuccessRate * 100).toFixed(1)}% success\n`);
  }

  const reportPath = path.join(LEARNED_DIR, 'training-3x50-report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), campaigns: allResults }, null, 2)
  );

  console.log('\n' + '═'.repeat(60));
  console.log('  3×50 TRAINING COMPLETE');
  console.log('═'.repeat(60));
  console.log('| Campaign   | Samples | Success | Policy v |');
  console.log('|------------|---------|---------|----------|');
  for (const r of allResults) {
    console.log(
      `| ${r.campaign.padEnd(10)} | ${String(r.totalSamples).padStart(7)} | ${(r.finalSuccessRate * 100).toFixed(1).padStart(6)}% | v${r.policyVersion} |`
    );
  }
  console.log(`\n📁 Report: ${reportPath}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
