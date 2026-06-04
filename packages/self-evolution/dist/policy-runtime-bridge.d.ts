import { LearnedPolicy } from './learned-policy-store';
export type BridgeProvider = 'openai' | 'anthropic' | 'huggingface' | 'local';
export type BridgeAgentRole = 'planner' | 'executor' | 'critic' | 'knowledge_updater' | 'self_corrector';
export interface PolicyBridgeEnginePrefs {
    mode?: 'auto' | 'local' | 'cloud';
    preferredCloudProvider?: 'openai' | 'anthropic' | 'huggingface';
    roleOverrides?: Partial<Record<BridgeAgentRole, {
        provider?: BridgeProvider;
    }>>;
}
export interface PolicyBridgeResult {
    enginePreferences: PolicyBridgeEnginePrefs;
    synthesisKeywords: string[];
    maxCriticEngines: number;
}
/**
 * Maps learned policy JSON fields to runtime engine / synthesis behavior.
 */
export declare class PolicyRuntimeBridge {
    apply(policy: LearnedPolicy, current?: PolicyBridgeEnginePrefs): PolicyBridgeResult;
}
