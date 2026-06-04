"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImprovementAnalyzer = void 0;
class ImprovementAnalyzer {
    analyze(experiences, currentPolicy, iteration) {
        const hfExperiences = experiences.filter((e) => e.metadata?.source === 'huggingface');
        const samples = hfExperiences.length ? hfExperiences : experiences;
        const total = samples.length || 1;
        const successes = samples.filter((e) => e.success).length;
        const successRate = successes / total;
        const avgReward = samples.reduce((s, e) => s + e.reward, 0) / total;
        const failurePatterns = {};
        for (const exp of samples.filter((e) => !e.success)) {
            const review = (exp.review ?? '').toLowerCase();
            if (review.includes('short') || review.includes('incomplete'))
                failurePatterns.incomplete = (failurePatterns.incomplete ?? 0) + 1;
            if (review.includes('mismatch') || review.includes('irrelevant'))
                failurePatterns.relevance = (failurePatterns.relevance ?? 0) + 1;
            if (review.includes('empty'))
                failurePatterns.empty = (failurePatterns.empty ?? 0) + 1;
            if (review.includes('low overlap'))
                failurePatterns.overlap = (failurePatterns.overlap ?? 0) + 1;
        }
        const improvements = [];
        if (successRate < currentPolicy.qualityThreshold) {
            improvements.push({
                id: `imp-quality-${iteration}`,
                type: 'quality',
                description: `Success rate ${(successRate * 100).toFixed(1)}% below threshold ${(currentPolicy.qualityThreshold * 100).toFixed(0)}%`,
                action: { qualityThreshold: Math.max(0.4, currentPolicy.qualityThreshold - 0.03) },
                priority: 1,
            });
        }
        if ((failurePatterns.incomplete ?? 0) > 2) {
            improvements.push({
                id: `imp-synthesis-incomplete-${iteration}`,
                type: 'synthesis',
                description: 'Add synthesis keywords for incomplete responses',
                action: { addSynthesisKeywords: ['incomplete', 'short', 'expand'] },
                priority: 2,
            });
        }
        if ((failurePatterns.relevance ?? 0) > 2) {
            improvements.push({
                id: `imp-routing-relevance-${iteration}`,
                type: 'routing',
                description: 'Prefer reasoning model for relevance failures',
                action: { routingBias: { planner: 'reasoning', preferredProvider: 'huggingface' } },
                priority: 2,
            });
        }
        if ((failurePatterns.overlap ?? 0) > 2) {
            improvements.push({
                id: `imp-batch-overlap-${iteration}`,
                type: 'batch',
                description: 'Reduce batch size for better per-sample quality',
                action: { batchSize: Math.max(5, currentPolicy.batchSize - 2) },
                priority: 3,
            });
        }
        if (successRate >= 0.75 && currentPolicy.batchSize < 20) {
            improvements.push({
                id: `imp-batch-scale-${iteration}`,
                type: 'batch',
                description: 'High success rate — increase batch size',
                action: { batchSize: Math.min(20, currentPolicy.batchSize + 2) },
                priority: 4,
            });
        }
        const weakCategories = Object.entries(currentPolicy.categoryScores)
            .filter(([, v]) => v.total >= 3 && v.success / v.total < 0.5)
            .map(([cat]) => cat);
        for (const cat of weakCategories.slice(0, 2)) {
            improvements.push({
                id: `imp-category-${cat}-${iteration}`,
                type: 'category',
                description: `Boost quality checks for weak category: ${cat}`,
                action: { categoryBoost: cat },
                priority: 2,
            });
        }
        improvements.sort((a, b) => a.priority - b.priority);
        return { successRate, avgReward, totalSamples: total, failurePatterns, improvements };
    }
}
exports.ImprovementAnalyzer = ImprovementAnalyzer;
//# sourceMappingURL=improvement-analyzer.js.map