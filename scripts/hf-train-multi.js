#!/usr/bin/env node
/**
 * Multi-dataset HF training: Tier A / B / C + unified rotation.
 * See data/learned/dataset-registry.json
 */
const fs = require('fs');
const path = require('path');
const { AIOS } = require('../packages/core/dist/index');
const { EvolutionKernel, LearnedPolicyStore } = require('../packages/self-evolution/dist/index');
const {
  TIER_A_DATASETS,
  TIER_B_DATASETS,
  TIER_C_DATASETS,
  ROTATION_DATASETS,
} = require('../packages/self-evolution/dist/dataset-registry');

const QUICK = process.env.TRAIN_MULTI_QUICK === '1';
const SKIP = process.env.SKIP_CAMPAIGNS?.split(',').map((s) => s.trim()) ?? [];
const DATA_DIR = path.resolve('data');
const LEARNED_DIR = path.join(DATA_DIR, 'learned');

function toEntries(registry) {
  return registry.map((e) => ({
    id: e.id,
    config: e.config,
    split: e.split,
    domain: e.domain,
  }));
}

const CAMPAIGNS = [
  {
    name: 'tier-a',
    policyFile: 'policy-tier-a.json',
    datasets: toEntries(TIER_A_DATASETS),
    iterations: QUICK ? 8 : 30,
    delayMs: 800,
  },
  {
    name: 'tier-b',
    policyFile: 'policy-tier-b.json',
    datasets: toEntries(TIER_B_DATASETS),
    iterations: QUICK ? 12 : 50,
    delayMs: 1200,
  },
  {
    name: 'tier-c',
    policyFile: 'policy-tier-c.json',
    datasets: toEntries(TIER_C_DATASETS),
    iterations: QUICK ? 10 : 30,
    delayMs: parseInt(process.env.HF_ITER_DELAY_MS || '2500', 10),
  },
  {
    name: 'rotation',
    policyFile: 'policy-multi.json',
    datasets: toEntries(ROTATION_DATASETS),
    iterations: QUICK ? 15 : parseInt(process.env.HF_ROTATION_ITERATIONS || '200', 10),
    delayMs: parseInt(process.env.HF_ITER_DELAY_MS || '1500', 10),
  },
];

async function runCampaign(campaign, aios) {
  console.log('\n' + '═'.repeat(60));
  console.log(
    `  CAMPAIGN: ${campaign.name.toUpperCase()} — ${campaign.iterations} iterations, ${campaign.datasets.length} datasets`
  );
  console.log('═'.repeat(60));

  const prevDelay = process.env.HF_ITER_DELAY_MS;
  process.env.HF_ITER_DELAY_MS = String(campaign.delayMs);

  const policyStore = new LearnedPolicyStore(LEARNED_DIR, campaign.policyFile);
  policyStore.reset();
  if (campaign.name === 'rotation') {
    const cursorPath = path.join(LEARNED_DIR, 'dataset-cursors.json');
    if (fs.existsSync(cursorPath)) fs.unlinkSync(cursorPath);
  }

  const kernel = new EvolutionKernel(LEARNED_DIR, campaign.policyFile);

  const ingestSample = async (sample, iteration, datasetId) => {
    const entry = campaign.datasets[(iteration - 1) % campaign.datasets.length];
    await aios.knowledge.ingestion.ingest({
      type: 'dataset',
      data: {
        instruction: sample.instruction,
        response: sample.review,
        success: sample.success,
        reward: sample.reward,
        category: sample.category,
        iteration,
        dataset: datasetId ?? entry?.id,
        domain: entry?.domain,
        campaign: campaign.name,
        hfRowIdx: sample.rowIdx,
      },
    });
  };

  const report = await kernel.training.runFullLoop({
    datasets: campaign.datasets,
    iterations: campaign.iterations,
    dataDir: LEARNED_DIR,
    useCursorStore: true,
    ingestSample,
  });

  if (prevDelay !== undefined) process.env.HF_ITER_DELAY_MS = prevDelay;
  else delete process.env.HF_ITER_DELAY_MS;

  const byDataset = {};
  for (const r of report.iterations) {
    if (!byDataset[r.dataset]) byDataset[r.dataset] = { samples: 0, successSum: 0, count: 0 };
    byDataset[r.dataset].samples += r.samplesProcessed;
    byDataset[r.dataset].successSum += r.successRate;
    byDataset[r.dataset].count += 1;
  }

  return {
    campaign: campaign.name,
    policyFile: campaign.policyFile,
    datasetCount: campaign.datasets.length,
    iterations: report.iterations.length,
    totalSamples: report.totalSamples,
    finalSuccessRate: report.finalSuccessRate,
    policyVersion: report.finalPolicy.version,
    qualityThreshold: report.finalPolicy.qualityThreshold,
    categoryScores: report.finalPolicy.categoryScores,
    perDataset: Object.entries(byDataset).map(([id, v]) => ({
      dataset: id,
      iterations: v.count,
      samples: v.samples,
      avgHeuristicSuccess: v.count ? v.successSum / v.count : 0,
    })),
    summary: report.iterations.map((r) => ({
      iter: r.iteration,
      dataset: r.dataset,
      success: +(r.successRate * 100).toFixed(1),
      samples: r.samplesProcessed,
      offset: r.offset,
    })),
  };
}

async function main() {
  fs.mkdirSync(LEARNED_DIR, { recursive: true });
  const aios = new AIOS({
    dataDir: DATA_DIR,
    skillsDirectory: path.resolve('skills'),
  });

  const startedAt = new Date().toISOString();
  const allResults = [];

  for (const campaign of CAMPAIGNS) {
    if (SKIP.includes(campaign.name)) {
      console.log(`⏭️  Skipping ${campaign.name}`);
      continue;
    }
    try {
      const result = await runCampaign(campaign, aios);
      allResults.push(result);
      console.log(
        `\n✅ ${campaign.name}: ${result.totalSamples} samples, ${(result.finalSuccessRate * 100).toFixed(1)}% heuristic success\n`
      );
    } catch (e) {
      console.error(`\n❌ ${campaign.name} failed:`, e.message);
      allResults.push({ campaign: campaign.name, error: e.message });
    }
  }

  const reportPath = path.join(LEARNED_DIR, 'training-multi-report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        startedAt,
        finishedAt: new Date().toISOString(),
        quickMode: QUICK,
        campaigns: allResults,
      },
      null,
      2
    )
  );

  console.log('\n' + '═'.repeat(60));
  console.log('  MULTI-DATASET TRAINING COMPLETE');
  console.log('═'.repeat(60));
  console.log('| Campaign | Datasets | Samples | Heuristic | Policy |');
  console.log('|----------|----------|---------|-----------|--------|');
  for (const r of allResults) {
    if (r.error) {
      console.log(`| ${r.campaign.padEnd(8)} | ERROR    | —       | —         | —      |`);
    } else {
      console.log(
        `| ${r.campaign.padEnd(8)} | ${String(r.datasetCount).padStart(8)} | ${String(r.totalSamples).padStart(7)} | ${(r.finalSuccessRate * 100).toFixed(1).padStart(8)}% | v${r.policyVersion} |`
      );
    }
  }
  console.log(`\n📁 Report: ${reportPath}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
