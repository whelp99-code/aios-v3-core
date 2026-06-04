"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceAllocator = void 0;
class ResourceAllocator {
    constructor(config = {}) {
        this.simulatedLoad = 0;
        this.localLoadThreshold = config.localLoadThreshold ?? 0.75;
        this.highLatencyMs = config.highLatencyMs ?? 2000;
    }
    /** Simulate or read external GPU load signal (0-1) */
    setLocalLoad(load) {
        this.simulatedLoad = Math.max(0, Math.min(1, load));
    }
    getLocalLoad() {
        const envLoad = process.env.RAPID_MLX_LOAD;
        if (envLoad) {
            const parsed = parseFloat(envLoad);
            if (!Number.isNaN(parsed))
                return Math.max(0, Math.min(1, parsed));
        }
        return this.simulatedLoad;
    }
    async assess(localProvider, cloudProviders) {
        const localHealth = await localProvider.healthCheck();
        const localLoad = this.getLocalLoad();
        const cloudAvailable = cloudProviders.some((p) => p.isConfigured());
        const localOverloaded = !localHealth.healthy ||
            localLoad >= this.localLoadThreshold ||
            (localHealth.latencyMs ?? 0) >= this.highLatencyMs;
        let recommendedMode = 'auto';
        if (localOverloaded && cloudAvailable) {
            recommendedMode = 'cloud';
        }
        else if (localHealth.healthy) {
            recommendedMode = 'local';
        }
        else if (cloudAvailable) {
            recommendedMode = 'cloud';
        }
        else {
            recommendedMode = 'auto';
        }
        return {
            localLoad,
            localHealthy: localHealth.healthy,
            recommendedMode,
            cloudAvailable,
        };
    }
    resolveMode(requestedMode, snapshot) {
        if (requestedMode === 'local')
            return 'local';
        if (requestedMode === 'cloud') {
            return snapshot.cloudAvailable ? 'cloud' : 'local';
        }
        return snapshot.recommendedMode;
    }
    pickCloudProvider(providers, preferred, options) {
        const configured = providers.filter((p) => p.isConfigured() && p.provider !== 'local');
        if (!configured.length)
            return undefined;
        const exclude = new Set(options?.exclude ?? []);
        const baseOrder = ['mimo', 'openai', 'anthropic', 'huggingface'];
        const order = preferred
            ? [preferred, ...baseOrder.filter((id) => id !== preferred)]
            : baseOrder;
        for (const id of order) {
            if (exclude.has(id))
                continue;
            const match = configured.find((p) => p.provider === id);
            if (match)
                return match;
        }
        return configured.find((p) => !exclude.has(p.provider));
    }
}
exports.ResourceAllocator = ResourceAllocator;
//# sourceMappingURL=resource-allocator.js.map