#!/usr/bin/env node
/**
 * Probe Hugging Face datasets for AIOS training compatibility.
 * Writes dataset-catalog.json + dataset-registry.json
 */
const fs = require('fs');
const path = require('path');
const { HFDatasetLoader } = require('../packages/self-evolution/dist/hf-dataset-loader');
const {
  probeResultToRegistryEntry,
  inferTier,
} = require('../packages/self-evolution/dist/dataset-registry');

const CANDIDATES = [
  { id: 'databricks/databricks-dolly-15k', category: 'Human instruction', size: '~15K', tier: 'A' },
  { id: 'tatsu-lab/alpaca', category: 'Instruction tuning', size: '~52K', tier: 'B' },
  { id: 'Open-Orca/OpenOrca', config: 'default', category: 'Synthetic reasoning', size: '~4M', tier: 'C' },
  { id: 'HuggingFaceH4/no_robots', category: 'Human SFT', size: '~10K', tier: 'A' },
  { id: 'OpenAssistant/oasst1', category: 'Human dialogue', size: '~88K', tier: 'B' },
  { id: 'yahma/alpaca-cleaned', category: 'Instruction (cleaned)', size: '~52K', tier: 'B' },
  { id: 'teknium/OpenHermes-2.5', category: 'Synthetic chat', size: '~1M', tier: 'C' },
  { id: 'WizardLM/WizardLM_evol_instruct_V2_196k', category: 'Evolved instructions', size: '~196K', tier: 'B' },
  { id: 'mosaicml/instruct-v3', category: 'Instruction mix', size: 'large', tier: 'C' },
  { id: 'argilla/databricks-math-dolly', category: 'Math + dolly', size: 'small', tier: 'A' },
  { id: 'stanfordnlp/coqa', category: 'Conversational QA', size: '~127K', tier: 'B' },
  { id: 'squad', category: 'Reading QA', size: '~100K', tier: 'B' },
  { id: 'google/boolq', category: 'Boolean QA', size: '~9K', tier: 'A' },
  { id: 'allenai/sciq', category: 'Science QA', size: '~13K', tier: 'A' },
  { id: 'cais/mmlu', config: 'all', split: 'test', category: 'Multi-task benchmark', size: '~15K', tier: 'B' },
  { id: 'Anthropic/hh-rlhf', category: 'RLHF preferences', size: '~170K', tier: 'B' },
  { id: 'HuggingFaceTB/smoltalk', category: 'Small instruct', size: '~1M', tier: 'C' },
  { id: 'mlabonne/FineTome-100k', category: 'Fine-tuning mix', size: '~100K', tier: 'B' },
  { id: 'BAAI/Infinity-Instruct', category: 'Instruction', size: 'large', tier: 'C' },
  { id: 'nvidia/OpenMathInstruct-1', category: 'Math instruct', size: '~2M', tier: 'C' },
  { id: 'HuggingFaceH4/ultrachat_200k', category: 'Synthetic chat', size: '~200K', tier: 'B' },
  { id: 'Open-Orca/SlimOrca', category: 'Synthetic reasoning', size: '~518K', tier: 'C' },
  { id: 'meta-math/MetaMathQA', category: 'Math reasoning', size: '~395K', tier: 'B' },
  { id: 'gsm8k', config: 'main', category: 'Math word problems', size: '~8K', tier: 'A' },
  { id: 'lighteval/MATH', category: 'Math benchmark', size: '~12K', tier: 'A' },
  { id: 'sahil2801/CodeAlpaca-20k', category: 'Code instruction', size: '~20K', tier: 'A' },
  { id: 'iamtarun/CodeAlpaca-20k', category: 'Code instruction', size: '~20K', tier: 'A' },
  { id: 'glaiveai/glaive-code-assistant', category: 'Code assistant', size: '~136K', tier: 'B' },
  { id: 'bigcode/starcoderdata', config: 'python', category: 'Code', size: 'large', tier: 'C' },
  { id: 'BelleGroup/train_1M_CN', category: 'Instruction CN', size: '~1M', tier: 'C' },
  { id: 'JosephusCheung/GuanacoDataset', category: 'Instruction', size: '~534K', tier: 'C' },
  { id: 'timdettmers/openassistant-guanaco', category: 'Dialogue', size: '~9K', tier: 'A' },
  { id: 'OpenAssistant/oasst2', category: 'Human dialogue', size: '~14K', tier: 'A' },
  { id: 'databricks/databricks-mlflow-tracking', category: 'Other', size: 'small', tier: 'A' },
  { id: 'HuggingFaceFW/fineweb-edu', config: 'default', category: 'Web text', size: 'huge', tier: 'C' },
  { id: 'allenai/tulu-3-sft-mixture', category: 'Instruction mix', size: '~326K', tier: 'B' },
  { id: 'HuggingFaceTB/cosmopedia', config: 'auto-reasoning', category: 'Synthetic', size: '~2M', tier: 'C' },
  { id: 'argilla/ultrafeedback-binarized-preferences', category: 'Preference', size: '~60K', tier: 'B' },
  { id: 'Intel/orca_dpo_pairs', category: 'Preference DPO', size: '~12M', tier: 'C' },
  { id: 'HuggingFaceH4/zephyr-7b-beta', category: 'Chat', size: 'small', tier: 'A' },
  { id: 'TIGER-Lab/MATH-plus', category: 'Math', size: '~27K', tier: 'A' },
  { id: 'AI-MO/NuminaMath-CoT', category: 'Math CoT', size: '~860K', tier: 'C' },
  { id: 'microsoft/orca-math-word-problems-200k', category: 'Math', size: '~200K', tier: 'B' },
  { id: 'EleutherAI/pile', config: 'all', category: 'Pretrain', size: 'huge', tier: 'C' },
  { id: 'wikitext', config: 'wikitext-2-v1', category: 'Language modeling', size: '~36K', tier: 'A' },
  { id: 'imdb', category: 'Sentiment', size: '~25K', tier: 'A' },
  { id: 'glue', config: 'sst2', category: 'Classification', size: '~67K', tier: 'B' },
  { id: 'rotten_tomatoes', category: 'Sentiment', size: '~10K', tier: 'A' },
  { id: 'fancyzhx/ag_news', category: 'News', size: '~120K', tier: 'B' },
  { id: 'SetFit/rte', category: 'NLI', size: '~2K', tier: 'A' },
  { id: 'xlangai/AgentNet', category: 'Agent', size: 'medium', tier: 'B' },
  { id: 'laion/OIG', category: 'Instruction', size: 'large', tier: 'C' },
  { id: 'HuggingFaceTB/sft-gpt-oss-20b', category: 'SFT', size: 'medium', tier: 'B' },
  { id: 'nvidia/Llama-Nemotron-Post-Training-Dataset', category: 'Post-training', size: 'large', tier: 'C' },
  { id: 'allenai/WildChat', category: 'Chat', size: '~570K', tier: 'C' },
  { id: 'teknium/GPTeacher-General-Instruct', category: 'Instruction', size: '~20K', tier: 'A' },
  { id: 'yahma/alpaca-cleaned', category: 'Instruction', size: '~52K', tier: 'B' },
];

async function probeDataset(loader, candidate) {
  const result = {
    id: candidate.id,
    category: candidate.category,
    expectedSize: candidate.size,
    tier: candidate.tier ?? inferTier(null),
    status: 'unknown',
    configs: [],
    splits: [],
    totalRows: null,
    splitSizes: {},
    sampleFields: [],
    compatible: false,
    samplePreview: null,
    error: null,
    latencyMs: 0,
  };

  const start = Date.now();
  try {
    const info = await loader.getDatasetInfo(candidate.id);
    result.configs = info.configs;
    result.splits = info.splits;
    result.splitSizes = info.splitSizes;

    const config = candidate.config ?? info.configs[0] ?? 'default';
    const split =
      candidate.split ??
      (info.splits.includes('train') ? 'train' : info.splits[0] ?? 'train');

    const rows = await loader.fetchRows({ dataset: candidate.id, config, split }, 0, 3);

    result.totalRows = rows.total ?? info.splitSizes?.[split] ?? null;
    result.latencyMs = Date.now() - start;

    if (rows.rows.length === 0) {
      result.status = 'empty';
      return result;
    }

    const raw = rows.rows[0].raw;
    result.sampleFields = Object.keys(raw);

    const hasInstruction =
      rows.rows[0].instruction.length > 5 || rows.rows[0].response.length > 5;
    result.compatible = hasInstruction;
    result.samplePreview = {
      instruction: rows.rows[0].instruction.slice(0, 120),
      response: rows.rows[0].response.slice(0, 120),
      category: rows.rows[0].category,
    };
    result.status = result.compatible ? 'compatible' : 'schema_mismatch';
    result.tier = candidate.tier ?? inferTier(result.totalRows);
  } catch (e) {
    result.status = 'error';
    result.error = e.message?.slice(0, 120) ?? String(e);
    result.latencyMs = Date.now() - start;
  }

  return result;
}

async function main() {
  const loader = new HFDatasetLoader();
  const unique = [];
  const seen = new Set();
  for (const c of CANDIDATES) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      unique.push(c);
    }
  }

  console.log('🔍 Hugging Face Dataset Probe for AIOS Training\n');
  console.log(`Checking ${unique.length} datasets...\n`);

  const results = [];
  for (const c of unique) {
    process.stdout.write(`  ${c.id} ... `);
    const r = await probeDataset(loader, c);
    results.push(r);
    const icon =
      r.status === 'compatible' ? '✅' : r.status === 'schema_mismatch' ? '⚠️' : '❌';
    console.log(`${icon} ${r.status}${r.totalRows ? ` (${r.totalRows} rows)` : ''}`);
    await new Promise((res) => setTimeout(res, 500));
  }

  const compatible = results.filter((r) => r.status === 'compatible');
  const errors = results.filter((r) => r.status === 'error');
  const mismatch = results.filter((r) => r.status === 'schema_mismatch');

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(
    `  Compatible: ${compatible.length} | Mismatch: ${mismatch.length} | Error: ${errors.length}`
  );
  console.log('══════════════════════════════════════════════════════════\n');

  const learnedDir = path.resolve('data/learned');
  fs.mkdirSync(learnedDir, { recursive: true });

  const catalogPath = path.join(learnedDir, 'dataset-catalog.json');
  fs.writeFileSync(
    catalogPath,
    JSON.stringify({ probedAt: new Date().toISOString(), results }, null, 2)
  );

  const registryEntries = results.map((r) => {
    const cand = unique.find((c) => c.id === r.id);
    return probeResultToRegistryEntry(r, cand);
  });

  const registry = {
    builtAt: new Date().toISOString(),
    probedCount: results.length,
    compatibleCount: compatible.length,
    tiers: {
      A: registryEntries.filter((e) => e.tier === 'A' && e.compatible).map((e) => e.id),
      B: registryEntries.filter((e) => e.tier === 'B' && e.compatible).map((e) => e.id),
      C: registryEntries.filter((e) => e.tier === 'C' && e.compatible).map((e) => e.id),
    },
    entries: registryEntries,
  };

  const registryPath = path.join(learnedDir, 'dataset-registry.json');
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

  console.log(`📁 Catalog: ${catalogPath}`);
  console.log(`📁 Registry: ${registryPath} (${compatible.length} compatible)\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
