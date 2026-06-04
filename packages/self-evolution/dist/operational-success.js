"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateOperationalSuccess = evaluateOperationalSuccess;
exports.operationalSuccessRate = operationalSuccessRate;
/**
 * Product success = workflow completed with approval-quality review (not HF heuristic overlap).
 */
function evaluateOperationalSuccess(input) {
    const review = (input.review ?? '').toLowerCase();
    let verdict = input.consensusVerdict ?? 'FAILED';
    if (!input.consensusVerdict) {
        if (input.success && (review.includes('approved') || review.includes('verdict: approved'))) {
            verdict = 'APPROVED';
        }
        else if (review.includes('needs_approval')) {
            verdict = 'NEEDS_APPROVAL';
        }
        else if (review.includes('needs_correction') || review.includes('correction')) {
            verdict = 'NEEDS_CORRECTION';
        }
        else if (input.success) {
            verdict = 'APPROVED';
        }
        else {
            verdict = 'FAILED';
        }
    }
    const operationalSuccess = verdict === 'APPROVED';
    const reward = operationalSuccess ? 1 : verdict === 'NEEDS_APPROVAL' ? 0.25 : -0.5;
    return { operationalSuccess, verdict, reward };
}
function operationalSuccessRate(records) {
    if (!records.length)
        return 0;
    const ok = records.filter((r) => {
        const { operationalSuccess } = evaluateOperationalSuccess({
            taskInput: r.taskInput,
            review: r.review,
            success: r.success,
            consensusVerdict: r.consensusVerdict,
        });
        return operationalSuccess;
    }).length;
    return ok / records.length;
}
//# sourceMappingURL=operational-success.js.map