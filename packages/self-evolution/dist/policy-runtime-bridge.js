"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyRuntimeBridge = void 0;
/**
 * Maps learned policy JSON fields to runtime engine / synthesis behavior.
 */
class PolicyRuntimeBridge {
    apply(policy, current) {
        const pref = policy.routingBias.preferredProvider;
        const preferredCloudProvider = pref === 'openai' || pref === 'anthropic' || pref === 'huggingface'
            ? pref
            : current?.preferredCloudProvider;
        const prefs = {
            mode: current?.mode ?? 'auto',
            preferredCloudProvider,
            roleOverrides: { ...current?.roleOverrides },
        };
        const roleMap = [
            ['planner', 'planner'],
            ['executor', 'executor'],
            ['critic', 'critic'],
        ];
        for (const [biasKey, role] of roleMap) {
            const hint = policy.routingBias[biasKey];
            if (hint === 'reasoning' || hint === 'huggingface') {
                prefs.roleOverrides[role] = { provider: 'huggingface' };
            }
            else if (hint === 'local' || hint === 'code') {
                prefs.roleOverrides[role] = { provider: 'local' };
            }
            else if (hint === 'openai') {
                prefs.roleOverrides[role] = { provider: 'openai' };
            }
            else if (hint === 'anthropic') {
                prefs.roleOverrides[role] = { provider: 'anthropic' };
            }
        }
        const maxCriticEngines = policy.successRate >= 0.8 ? 2 : policy.successRate >= 0.65 ? 3 : 4;
        return {
            enginePreferences: prefs,
            synthesisKeywords: policy.synthesisKeywords,
            maxCriticEngines,
        };
    }
}
exports.PolicyRuntimeBridge = PolicyRuntimeBridge;
//# sourceMappingURL=policy-runtime-bridge.js.map