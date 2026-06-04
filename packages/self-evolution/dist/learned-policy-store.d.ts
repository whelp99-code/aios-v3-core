export interface LearnedRoutingBias {
    planner?: string;
    executor?: string;
    critic?: string;
    preferredProvider?: 'openai' | 'anthropic' | 'huggingface' | 'local';
}
export interface LearnedPolicy {
    version: number;
    iteration: number;
    successRate: number;
    avgReward: number;
    qualityThreshold: number;
    batchSize: number;
    synthesisKeywords: string[];
    routingBias: LearnedRoutingBias;
    categoryScores: Record<string, {
        success: number;
        total: number;
    }>;
    appliedImprovements: string[];
    updatedAt: string;
}
export declare class LearnedPolicyStore {
    private filePath;
    private policy;
    constructor(dataDir?: string, policyFile?: string);
    get(): LearnedPolicy;
    update(partial: Partial<LearnedPolicy>): LearnedPolicy;
    reset(): LearnedPolicy;
    private load;
    private save;
}
