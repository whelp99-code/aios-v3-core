import { ExperienceReplayBuffer } from './experience-buffer';
import { LearnedPolicy, LearnedPolicyStore } from './learned-policy-store';
import { HotPatchManager } from './hot-patch';
import { TelemetryStore } from './telemetry-store';
import { PolicyRuntimeBridge } from './policy-runtime-bridge';
export interface OperationalTask {
    id: string;
    taskInput: string;
    category: 'code' | 'reasoning' | 'chat' | 'integration';
    difficulty: number;
}
export declare const GOLDEN_TASKS: OperationalTask[];
export interface OperationalLearningReport {
    iterations: number;
    telemetryRecords: number;
    finalOperationalSuccessRate: number;
    goldenSetSuccessRate: number;
    policy: LearnedPolicy;
    bridge: ReturnType<PolicyRuntimeBridge['apply']>;
    checkpoints: Array<{
        iteration: number;
        goldenSuccessRate: number;
        policyVersion: number;
    }>;
}
export declare class OperationalLearningKernel {
    private policyStore;
    private experience;
    readonly telemetry: TelemetryStore;
    readonly bridge: PolicyRuntimeBridge;
    private analyzer;
    private applier;
    constructor(policyStore: LearnedPolicyStore, experience: ExperienceReplayBuffer, hotPatch: HotPatchManager, dataDir?: string);
    /** Deterministic simulation: policy quality affects P(success) on operational tasks. */
    simulateTaskOutcome(task: OperationalTask, policy: LearnedPolicy, options?: {
        benchmark?: boolean;
    }): {
        success: boolean;
        review: string;
        reward: number;
        operationalSuccess: boolean;
    };
    evaluateGoldenSet(policy?: LearnedPolicy): number;
    runLoop(iterations: number): Promise<OperationalLearningReport>;
    private deterministicRoll;
}
