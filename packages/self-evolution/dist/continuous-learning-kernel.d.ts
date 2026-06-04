import { ExperienceReplayBuffer } from './experience-buffer';
import { HFDatasetLoader, HFDatasetConfig, HFDatasetRow } from './hf-dataset-loader';
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
    datasets?: string[];
    iterations?: number;
    dataDir?: string;
    policyFile?: string;
    onIteration?: (result: TrainingIterationResult) => void;
    ingestSample?: (sample: TrainingSampleResult, iteration: number) => Promise<void>;
}
export interface ContinuousLearningReport {
    iterations: TrainingIterationResult[];
    finalPolicy: LearnedPolicy;
    totalSamples: number;
    finalSuccessRate: number;
}
export declare class ContinuousLearningKernel {
    private hotPatch;
    readonly loader: HFDatasetLoader;
    readonly policyStore: LearnedPolicyStore;
    readonly analyzer: ImprovementAnalyzer;
    readonly applier: ImprovementApplier;
    readonly experience: ExperienceReplayBuffer;
    constructor(hotPatch: HotPatchManager, experience: ExperienceReplayBuffer, dataDir?: string, policyFile?: string);
    evaluateSample(row: HFDatasetRow, policy: LearnedPolicy): TrainingSampleResult;
    runIteration(iteration: number, cfg: HFDatasetConfig, ingestSample?: (sample: TrainingSampleResult, iteration: number) => Promise<void>): Promise<TrainingIterationResult>;
    runFullLoop(config?: ContinuousLearningConfig): Promise<ContinuousLearningReport>;
}
