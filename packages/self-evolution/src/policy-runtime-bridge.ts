import { LearnedPolicy } from './learned-policy-store';

export type BridgeProvider = 'openai' | 'anthropic' | 'huggingface' | 'local';
export type BridgeAgentRole =
  | 'planner'
  | 'executor'
  | 'critic'
  | 'knowledge_updater'
  | 'self_corrector';

export interface PolicyBridgeEnginePrefs {
  mode?: 'auto' | 'local' | 'cloud';
  preferredCloudProvider?: 'openai' | 'anthropic' | 'huggingface';
  roleOverrides?: Partial<Record<BridgeAgentRole, { provider?: BridgeProvider }>>;
}

export interface PolicyBridgeResult {
  enginePreferences: PolicyBridgeEnginePrefs;
  synthesisKeywords: string[];
  maxCriticEngines: number;
}

/**
 * Maps learned policy JSON fields to runtime engine / synthesis behavior.
 */
export class PolicyRuntimeBridge {
  apply(policy: LearnedPolicy, current?: PolicyBridgeEnginePrefs): PolicyBridgeResult {
    const pref = policy.routingBias.preferredProvider;
    const preferredCloudProvider: PolicyBridgeEnginePrefs['preferredCloudProvider'] =
      pref === 'openai' || pref === 'anthropic' || pref === 'huggingface'
        ? pref
        : current?.preferredCloudProvider;

    const prefs: PolicyBridgeEnginePrefs = {
      mode: current?.mode ?? 'auto',
      preferredCloudProvider,
      roleOverrides: { ...current?.roleOverrides },
    };

    const roleMap: Array<[keyof LearnedPolicy['routingBias'], BridgeAgentRole]> =
      [
        ['planner', 'planner'],
        ['executor', 'executor'],
        ['critic', 'critic'],
      ];

    for (const [biasKey, role] of roleMap) {
      const hint = policy.routingBias[biasKey];
      if (hint === 'reasoning' || hint === 'huggingface') {
        prefs.roleOverrides![role] = { provider: 'huggingface' };
      } else if (hint === 'local' || hint === 'code') {
        prefs.roleOverrides![role] = { provider: 'local' };
      } else if (hint === 'openai') {
        prefs.roleOverrides![role] = { provider: 'openai' };
      } else if (hint === 'anthropic') {
        prefs.roleOverrides![role] = { provider: 'anthropic' };
      }
    }

    const maxCriticEngines =
      policy.successRate >= 0.8 ? 2 : policy.successRate >= 0.65 ? 3 : 4;

    return {
      enginePreferences: prefs,
      synthesisKeywords: policy.synthesisKeywords,
      maxCriticEngines,
    };
  }
}
