import { ExperienceReplayBuffer } from './experience-buffer';
import {
  HFDatasetLoader,
  HFDatasetConfig,
  HFDatasetRow,
  HFDatasetEntry,
  toHFDatasetConfig,
  resolveDatasetList,
} from './hf-dataset-loader';
import { DatasetCursorStore } from './dataset-cursor-store';
import { ImprovementAnalyzer, AnalysisResult } from './improvement-analyzer';
import { ImprovementApplier } from './improvement-applier';
import { LearnedPolicyStore, LearnedPolicy } from './learned-policy-store';
import { HotPatchManager } from './hot-patch';

export interface TrainingSampleResult {
  rowIdx: number;
  instruction: string;
  success: boolean;
  reward: number;
  review: string;
  category?: string;
}

export interface TrainingIterationResult {
  iteration: number;
  dataset: string;
  offset: number;
  samplesProcessed: number;
  successRate: number;
  avgReward: number;
  analysis: AnalysisResult;
  improvementsApplied: string[];
  proposalIds: string[];
  policy: LearnedPolicy;
  retrainSamples: number;
}

export interface ContinuousLearningConfig {
  dataset?: string;
  /** Rotate through datasets each iteration (overrides single dataset) */
  datasets?: Array<string | HFDatasetEntry>;
  iterations?: number;
  dataDir?: string;
  policyFile?: string;
  /** Use persistent per-dataset offsets (default true when dataDir set) */
  useCursorStore?: boolean;
  onIteration?: (result: TrainingIterationResult) => void;
  ingestSample?: (sample: TrainingSampleResult, iteration: number, datasetId?: string) => Promise<void>;
}

export interface ContinuousLearningReport {
  iterations: TrainingIterationResult[];
  finalPolicy: LearnedPolicy;
  totalSamples: number;
  finalSuccessRate: number;
}

export class ContinuousLearningKernel {
  readonly loader: HFDatasetLoader;
  readonly policyStore: LearnedPolicyStore;
  readonly analyzer: ImprovementAnalyzer;
  readonly applier: ImprovementApplier;
  readonly experience: ExperienceReplayBuffer;
  readonly cursorStore: DatasetCursorStore | null;

  constructor(
    private hotPatch: HotPatchManager,
    experience: ExperienceReplayBuffer,
    dataDir?: string,
    policyFile = 'policy.json'
  ) {
    this.loader = new HFDatasetLoader();
    this.policyStore = new LearnedPolicyStore(dataDir, policyFile);
    this.analyzer = new ImprovementAnalyzer();
    this.applier = new ImprovementApplier(this.policyStore, hotPatch);
    this.experience = experience;
    this.cursorStore = dataDir ? new DatasetCursorStore(dataDir) : null;
  }

  evaluateSample(row: HFDatasetRow, policy: LearnedPolicy): TrainingSampleResult {
    const instruction = row.context
      ? `${row.instruction}\nContext: ${row.context}`
      : row.instruction;

    const instrWords = new Set(
      instruction.toLowerCase().split(/\W+/).filter((w) => w.length > 3)
    );
    const respWords = row.response.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const overlap =
      respWords.length > 0
        ? respWords.filter((w) => instrWords.has(w)).length / respWords.length
        : 0;

    const issues: string[] = [];
    if (!row.response || row.response.length < 20) issues.push('empty/short response');
    if (overlap < 0.05 && row.response.length > 30) issues.push('low overlap with instruction');
    if (instruction.length < 10) issues.push('instruction too short');

    const categoryPenalty =
      row.category && policy.categoryScores[row.category]
        ? policy.categoryScores[row.category].success / policy.categoryScores[row.category].total
        : 1;

    const baseScore = row.response.length >= 20 ? 0.6 : 0.2;
    const overlapScore = Math.min(0.35, overlap * 2);
    const score = baseScore + overlapScore + (categoryPenalty < 0.5 ? -0.1 : 0);

    const success = score >= policy.qualityThreshold && issues.length === 0;
    const reward = success ? 1 : score - policy.qualityThreshold;

    const review = success
      ? 'VERDICT: APPROVED — HF training sample meets quality threshold'
      : `VERDICT: NEEDS_CORRECTION — ${issues.join('; ') || 'below quality threshold'}`;

    return {
      rowIdx: row.rowIdx,
      instruction: instruction.slice(0, 500),
      success,
      reward,
      review,
      category: row.category,
    };
  }

  async runIteration(
    iteration: number,
    cfg: HFDatasetConfig,
    ingestSample?: (sample: TrainingSampleResult, iteration: number, datasetId?: string) => Promise<void>,
    useCursor = true
  ): Promise<TrainingIterationResult> {
    const policy = this.policyStore.get();
    const offset =
      useCursor && this.cursorStore
        ? this.cursorStore.advance(
            cfg.dataset,
            policy.batchSize,
            cfg.config,
            cfg.split
          )
        : (iteration - 1) * policy.batchSize;

    const batch = await this.loader.fetchRows(cfg, offset, policy.batchSize);
    const sampleResults: TrainingSampleResult[] = [];

    for (const row of batch.rows) {
      const result = this.evaluateSample(row, policy);
      sampleResults.push(result);

      this.experience.add({
        taskInput: result.instruction,
        plan: `HF dataset training iter-${iteration}`,
        executionResult: row.response.slice(0, 1000),
        review: result.review,
        success: result.success,
        reward: result.reward,
        metadata: {
          source: 'huggingface',
          iteration,
          dataset: cfg.dataset,
          rowIdx: row.rowIdx,
          category: row.category,
        },
      });

      if (row.category) {
        const scores = { ...policy.categoryScores };
        const cat = scores[row.category] ?? { success: 0, total: 0 };
        cat.total += 1;
        if (result.success) cat.success += 1;
        scores[row.category] = cat;
        this.policyStore.update({ categoryScores: scores });
      }

      await ingestSample?.(result, iteration, cfg.dataset);
    }

    const analysis = this.analyzer.analyze(
      this.experience.getRecent(policy.batchSize * 2),
      this.policyStore.get(),
      iteration
    );

    const { applied, policy: updatedPolicy, proposalIds } = this.applier.apply(
      analysis.improvements,
      iteration
    );

    this.policyStore.update({
      successRate: analysis.successRate,
      avgReward: analysis.avgReward,
      iteration,
    });

    const retrainPolicy = this.policyStore.get();
    let retrainSamples = 0;
    const failed = sampleResults.filter((s) => !s.success);
    for (const sample of failed.slice(0, Math.min(5, failed.length))) {
      const row = batch.rows.find((r) => r.rowIdx === sample.rowIdx);
      if (!row) continue;
      const reEval = this.evaluateSample(row, retrainPolicy);
      retrainSamples += 1;
      this.experience.add({
        taskInput: `[retrain] ${sample.instruction}`,
        plan: `Re-train iter-${iteration}`,
        executionResult: row.response.slice(0, 1000),
        review: reEval.review,
        success: reEval.success,
        reward: reEval.reward,
        metadata: { source: 'huggingface', iteration, retrain: true },
      });
    }

    return {
      iteration,
      dataset: cfg.dataset,
      offset,
      samplesProcessed: sampleResults.length,
      successRate: analysis.successRate,
      avgReward: analysis.avgReward,
      analysis,
      improvementsApplied: applied,
      proposalIds,
      policy: this.policyStore.get(),
      retrainSamples,
    };
  }

  async runFullLoop(config: ContinuousLearningConfig = {}): Promise<ContinuousLearningReport> {
    const entries = resolveDatasetList(config.datasets, config.dataset);
    const iterations = config.iterations ?? 10;
    const useCursor = config.useCursorStore !== false && !!this.cursorStore;

    const results: TrainingIterationResult[] = [];
    let totalSamples = 0;

    const modeLabel =
      entries.length > 1
        ? `rotation [${entries.map((e) => e.id).join(' → ')}]`
        : entries[0].id;
    console.log(`\n🤗 HF Continuous Learning — ${iterations} iterations on ${modeLabel}\n`);

    for (let i = 1; i <= iterations; i++) {
      const entry = entries[(i - 1) % entries.length];
      const hfConfig = toHFDatasetConfig(entry);
      console.log(
        `━━━ Iteration ${i}/${iterations} [${hfConfig.dataset}] config=${hfConfig.config} split=${hfConfig.split} ━━━`
      );
      const result = await this.runIteration(i, hfConfig, config.ingestSample, useCursor);
      results.push(result);
      totalSamples += result.samplesProcessed + result.retrainSamples;

      console.log(
        `  Samples: ${result.samplesProcessed} | Success: ${(result.successRate * 100).toFixed(1)}% | ` +
          `Reward: ${result.avgReward.toFixed(3)} | Retrain: ${result.retrainSamples}`
      );
      if (result.improvementsApplied.length) {
        console.log(`  Improvements: ${result.improvementsApplied.join('; ')}`);
      }
      console.log(
        `  Policy v${result.policy.version} — threshold=${result.policy.qualityThreshold.toFixed(2)} batch=${result.policy.batchSize}`
      );

      config.onIteration?.(result);

      if (i < iterations) {
        const delayMs = parseInt(process.env.HF_ITER_DELAY_MS || '1500', 10);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    const finalPolicy = this.policyStore.get();
    const finalSuccessRate = results.length
      ? results[results.length - 1].successRate
      : 0;

    console.log(`\n✅ Training complete — ${totalSamples} samples, final success ${(finalSuccessRate * 100).toFixed(1)}%\n`);

    return { iterations: results, finalPolicy, totalSamples, finalSuccessRate };
  }
}
