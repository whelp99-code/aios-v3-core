import { TelemetryRecord } from './telemetry-store';

export type OperationalVerdict = 'APPROVED' | 'NEEDS_CORRECTION' | 'NEEDS_APPROVAL' | 'FAILED';

export interface OperationalEvalInput {
  taskInput: string;
  review: string | null;
  success: boolean;
  consensusVerdict?: OperationalVerdict;
  metadata?: Record<string, unknown>;
}

/**
 * Product success = workflow completed with approval-quality review (not HF heuristic overlap).
 */
export function evaluateOperationalSuccess(input: OperationalEvalInput): {
  operationalSuccess: boolean;
  verdict: OperationalVerdict;
  reward: number;
} {
  const review = (input.review ?? '').toLowerCase();
  let verdict: OperationalVerdict = input.consensusVerdict ?? 'FAILED';

  if (!input.consensusVerdict) {
    if (input.success && (review.includes('approved') || review.includes('verdict: approved'))) {
      verdict = 'APPROVED';
    } else if (review.includes('needs_approval')) {
      verdict = 'NEEDS_APPROVAL';
    } else if (review.includes('needs_correction') || review.includes('correction')) {
      verdict = 'NEEDS_CORRECTION';
    } else if (input.success) {
      verdict = 'APPROVED';
    } else {
      verdict = 'FAILED';
    }
  }

  const operationalSuccess = verdict === 'APPROVED';
  const reward = operationalSuccess ? 1 : verdict === 'NEEDS_APPROVAL' ? 0.25 : -0.5;

  return { operationalSuccess, verdict, reward };
}

export function operationalSuccessRate(records: TelemetryRecord[]): number {
  if (!records.length) return 0;
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
