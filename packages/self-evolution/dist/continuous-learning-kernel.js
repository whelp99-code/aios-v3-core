"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContinuousLearningKernel = void 0;
const hf_dataset_loader_1 = require("./hf-dataset-loader");
const improvement_analyzer_1 = require("./improvement-analyzer");
const improvement_applier_1 = require("./improvement-applier");
const learned_policy_store_1 = require("./learned-policy-store");
class ContinuousLearningKernel {
    constructor(hotPatch, experience, dataDir) {
        this.hotPatch = hotPatch;
        this.loader = new hf_dataset_loader_1.HFDatasetLoader();
        this.policyStore = new learned_policy_store_1.LearnedPolicyStore(dataDir);
        this.analyzer = new improvement_analyzer_1.ImprovementAnalyzer();
        this.applier = new improvement_applier_1.ImprovementApplier(this.policyStore, hotPatch);
        this.experience = experience;
    }
    evaluateSample(row, policy) {
        const instruction = row.context
            ? `${row.instruction}\nContext: ${row.context}`
            : row.instruction;
        const instrWords = new Set(instruction.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
        const respWords = row.response.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
        const overlap = respWords.length > 0
            ? respWords.filter((w) => instrWords.has(w)).length / respWords.length
            : 0;
        const issues = [];
        if (!row.response || row.response.length < 20)
            issues.push('empty/short response');
        if (overlap < 0.05 && row.response.length > 30)
            issues.push('low overlap with instruction');
        if (instruction.length < 10)
            issues.push('instruction too short');
        const categoryPenalty = row.category && policy.categoryScores[row.category]
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
    async runIteration(iteration, cfg, ingestSample) {
        const policy = this.policyStore.get();
        const offset = (iteration - 1) * policy.batchSize;
        const batch = await this.loader.fetchRows(cfg, offset, policy.batchSize);
        const sampleResults = [];
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
                if (result.success)
                    cat.success += 1;
                scores[row.category] = cat;
                this.policyStore.update({ categoryScores: scores });
            }
            await ingestSample?.(result, iteration);
        }
        const analysis = this.analyzer.analyze(this.experience.getRecent(policy.batchSize * 2), this.policyStore.get(), iteration);
        const { applied, policy: updatedPolicy, proposalIds } = this.applier.apply(analysis.improvements, iteration);
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
            if (!row)
                continue;
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
    async runFullLoop(config = {}) {
        const dataset = config.dataset ?? 'databricks/databricks-dolly-15k';
        const iterations = config.iterations ?? 10;
        const hfConfig = { dataset, config: 'default', split: 'train' };
        const results = [];
        let totalSamples = 0;
        console.log(`\n🤗 HF Continuous Learning — ${iterations} iterations on ${dataset}\n`);
        for (let i = 1; i <= iterations; i++) {
            console.log(`━━━ Iteration ${i}/${iterations} ━━━`);
            const result = await this.runIteration(i, hfConfig, config.ingestSample);
            results.push(result);
            totalSamples += result.samplesProcessed + result.retrainSamples;
            console.log(`  Samples: ${result.samplesProcessed} | Success: ${(result.successRate * 100).toFixed(1)}% | ` +
                `Reward: ${result.avgReward.toFixed(3)} | Retrain: ${result.retrainSamples}`);
            if (result.improvementsApplied.length) {
                console.log(`  Improvements: ${result.improvementsApplied.join('; ')}`);
            }
            console.log(`  Policy v${result.policy.version} — threshold=${result.policy.qualityThreshold.toFixed(2)} batch=${result.policy.batchSize}`);
            config.onIteration?.(result);
        }
        const finalPolicy = this.policyStore.get();
        const finalSuccessRate = results.length
            ? results[results.length - 1].successRate
            : 0;
        console.log(`\n✅ Training complete — ${totalSamples} samples, final success ${(finalSuccessRate * 100).toFixed(1)}%\n`);
        return { iterations: results, finalPolicy, totalSamples, finalSuccessRate };
    }
}
exports.ContinuousLearningKernel = ContinuousLearningKernel;
//# sourceMappingURL=continuous-learning-kernel.js.map