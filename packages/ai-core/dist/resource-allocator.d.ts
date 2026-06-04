import { EngineMode, ModelProvider, ResourceSnapshot } from './types';
import { ILLMProvider } from './providers/base-provider';
export interface ResourceAllocatorConfig {
    localLoadThreshold?: number;
    highLatencyMs?: number;
}
export declare class ResourceAllocator {
    private localLoadThreshold;
    private highLatencyMs;
    private simulatedLoad;
    constructor(config?: ResourceAllocatorConfig);
    /** Simulate or read external GPU load signal (0-1) */
    setLocalLoad(load: number): void;
    getLocalLoad(): number;
    assess(localProvider: ILLMProvider, cloudProviders: ILLMProvider[]): Promise<ResourceSnapshot>;
    resolveMode(requestedMode: EngineMode, snapshot: ResourceSnapshot): EngineMode;
    pickCloudProvider(providers: ILLMProvider[], preferred?: ModelProvider, options?: {
        exclude?: ModelProvider[];
    }): ILLMProvider | undefined;
}
//# sourceMappingURL=resource-allocator.d.ts.map