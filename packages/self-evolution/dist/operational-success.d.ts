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
export declare function evaluateOperationalSuccess(input: OperationalEvalInput): {
    operationalSuccess: boolean;
    verdict: OperationalVerdict;
    reward: number;
};
export declare function operationalSuccessRate(records: TelemetryRecord[]): number;
