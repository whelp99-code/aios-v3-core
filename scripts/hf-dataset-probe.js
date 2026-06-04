#!/usr/bin/env node
/**
 * Probe Hugging Face datasets for AIOS training compatibility.
 * Uses datasets-server.huggingface.co (same as HFDatasetLoader).
 */
const { HFDatasetLoader } = require('../packages/self-evolution/dist/hf-dataset-loader');

const CANDIDATES = [
  { id: 'databricks/databricks-dolly-15k', category: 'Human instruction', size: '~15K' },
  { id: 'tatsu-lab/alpaca', category: 'Instruction tuning', size: '~52K' },
  { id: 'Open-Orca/OpenOrca', config: 'default', category: 'Synthetic reasoning', size: '~4M' },
  { id: 'HuggingFaceH4/no_robots', category: 'Human SFT', size: '~10K' },
  { id: 'OpenAssistant/oasst1', category: 'Human dialogue', size: '~88K' },
  { id: 'yahma/alpaca-cleaned', category: 'Instruction (cleaned)', size: '~52K' },
  { id: 'teknium/OpenHermes-2.5', category: 'Synthetic chat', size: '~1M' },
  { id: 'WizardLM/WizardLM_evol_instruct_V2_196k', category: 'Evolved instructions', size: '~196K' },
  { id: 'mosaicml/instruct-v3', category: 'Instruction mix', size: 'large' },
  { id: 'argilla/databricks-math-dolly', category: 'Math + dolly', size: 'small' },
  { id: 'stanfordnlp/coqa', category: 'Conversational QA', size: '~127K' },
  { id: 'squad', category: 'Reading QA', size: '~100K' },
  { id: 'google/boolq', category: 'Boolean QA', size: '~9K' },
  { id: 'allenai/sciq', category: 'Science QA', size: '~13K' },
  { id: 'cais/mmlu', config: 'all', category: 'Multi-task benchmark', size: '~15K' },
  { id: 'Anthropic/hh-rlhf', category: 'RLHF preferences', size: '~170K' },
  { id: 'HuggingFaceTB/smoltalk', category: 'Small instruct', size: '~1M' },
  { id: 'mlabonne/FineTome-100k', category: 'Fine-tuning mix', size: '~100K' },
  { id: 'BAAI/Infinity-Instruct', category: 'Instruction', size: 'large' },
  { id: 'nvidia/OpenMathInstruct-1', category: 'Math instruct', size: '~2M' },
];

async function probeDataset(loader, candidate) {
  const result = {
    id: candidate.id,
    category: candidate.category,
    expectedSize: candidate.size,
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
    const split = info.splits.includes('train') ? 'train' : info.splits[0] ?? 'train';

    const rows = await loader.fetchRows(
      { dataset: candidate.id, config, split },
      0,
      3
    );

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
  } catch (e) {
    result.status = 'error';
    result.error = e.message?.slice(0, 120) ?? String(e);
    result.latencyMs = Date.now() - start;
  }

  return result;
}

async function main() {
  const loader = new HFDatasetLoader();
  console.log('🔍 Hugging Face Dataset Probe for AIOS Training\n');
  console.log(`Checking ${CANDIDATES.length} datasets...\n`);

  const results = [];
  for (const c of CANDIDATES) {
    process.stdout.write(`  ${c.id} ... `);
    const r = await probeDataset(loader, c);
    results.push(r);
    const icon =
      r.status === 'compatible' ? '✅' : r.status === 'schema_mismatch' ? '⚠️' : '❌';
    console.log(`${icon} ${r.status}${r.totalRows ? ` (${r.totalRows} rows)` : ''}`);
    await new Promise((res) => setTimeout(res, 200));
  }

  const compatible = results.filter((r) => r.status === 'compatible');
  const errors = results.filter((r) => r.status === 'error');
  const mismatch = results.filter((r) => r.status === 'schema_mismatch');

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`  Compatible: ${compatible.length} | Mismatch: ${mismatch.length} | Error: ${errors.length}`);
  console.log('══════════════════════════════════════════════════════════\n');

  console.log('## ✅ AIOS 학습 호환 (instruction/response 추출 가능)\n');
  console.log('| Dataset | Rows | Category | Fields |');
  console.log('|---------|------|----------|--------|');
  for (const r of compatible.sort((a, b) => (b.totalRows ?? 0) - (a.totalRows ?? 0))) {
    const fields = r.sampleFields.slice(0, 6).join(', ');
    console.log(
      `| \`${r.id}\` | ${r.totalRows?.toLocaleString() ?? '?'} | ${r.category} | ${fields} |`
    );
  }

  if (mismatch.length) {
    console.log('\n## ⚠️ 스키마 불일치 (커스텀 매핑 필요)\n');
    for (const r of mismatch) {
      console.log(`- **${r.id}**: fields=[${r.sampleFields.join(', ')}]`);
    }
  }

  if (errors.length) {
    console.log('\n## ❌ 접근 불가 / 오류\n');
    for (const r of errors) {
      console.log(`- **${r.id}**: ${r.error}`);
    }
  }

  console.log('\n## 📌 추천 (현재 파이프라인 기준)\n');
  const top = compatible
    .filter((r) => r.totalRows && r.totalRows >= 1000)
    .slice(0, 8);
  for (const r of top) {
    console.log(`1. **${r.id}** — ${r.totalRows?.toLocaleString()} rows, ${r.category}`);
    if (r.samplePreview) {
      console.log(`   - Q: ${r.samplePreview.instruction}...`);
      console.log(`   - A: ${r.samplePreview.response}...`);
    }
  }

  const outPath = require('path').resolve('data/learned/dataset-catalog.json');
  require('fs').mkdirSync(require('path').dirname(outPath), { recursive: true });
  require('fs').writeFileSync(outPath, JSON.stringify({ probedAt: new Date().toISOString(), results }, null, 2));
  console.log(`\n📁 Full report: ${outPath}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
