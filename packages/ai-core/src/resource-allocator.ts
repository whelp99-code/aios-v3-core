import { EngineMode, ModelProvider, ProviderHealth, ResourceSnapshot } from './types';
import { ILLMProvider } from './providers/base-provider';

export interface ResourceAllocatorConfig {
  localLoadThreshold?: number;
  highLatencyMs?: number;
}

export class ResourceAllocator {
  private localLoadThreshold: number;
  private highLatencyMs: number;
  private simulatedLoad = 0;

  constructor(config: ResourceAllocatorConfig = {}) {
    this.localLoadThreshold = config.localLoadThreshold ?? 0.75;
    this.highLatencyMs = config.highLatencyMs ?? 2000;
  }

  /** Simulate or read external GPU load signal (0-1) */
  setLocalLoad(load: number): void {
    this.simulatedLoad = Math.max(0, Math.min(1, load));
  }

  getLocalLoad(): number {
    const envLoad = process.env.LM_STUDIO_LOAD ?? process.env.RAPID_MLX_LOAD;
    if (envLoad) {
      const parsed = parseFloat(envLoad);
      if (!Number.isNaN(parsed)) return Math.max(0, Math.min(1, parsed));
    }
    return this.simulatedLoad;
  }

  async assess(
    localProvider: ILLMProvider,
    cloudProviders: ILLMProvider[]
  ): Promise<ResourceSnapshot> {
    const localHealth = await localProvider.healthCheck();
    const localLoad = this.getLocalLoad();
    const cloudAvailable = cloudProviders.some((p) => p.isConfigured());

    const localOverloaded =
      !localHealth.healthy ||
      localLoad >= this.localLoadThreshold ||
      (localHealth.latencyMs ?? 0) >= this.highLatencyMs;

    let recommendedMode: EngineMode = 'auto';
    if (localOverloaded && cloudAvailable) {
      recommendedMode = 'cloud';
    } else if (localHealth.healthy) {
      recommendedMode = 'local';
    } else if (cloudAvailable) {
      recommendedMode = 'cloud';
    } else {
      recommendedMode = 'auto';
    }

    return {
      localLoad,
      localHealthy: localHealth.healthy,
      recommendedMode,
      cloudAvailable,
    };
  }

  resolveMode(requestedMode: EngineMode, snapshot: ResourceSnapshot): EngineMode {
    if (requestedMode === 'local') return 'local';
    if (requestedMode === 'cloud') {
      return snapshot.cloudAvailable ? 'cloud' : 'local';
    }
    return snapshot.recommendedMode!;
  }

  pickCloudProvider(
    providers: ILLMProvider[],
    preferred?: ModelProvider
  ): ILLMProvider | undefined {
    const configured = providers.filter((p) => p.isConfigured() && p.provider !== 'local');
    if (!configured.length) return undefined;

    if (preferred) {
      const match = configured.find((p) => p.provider === preferred);
      if (match) return match;
    }

    return configured[0];
  }
}
