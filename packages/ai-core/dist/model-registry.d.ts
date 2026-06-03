import { AgentRole, ModelEntry, ModelProvider, TaskType } from './types';
export declare class ModelRegistry {
    private models;
    constructor(extraModels?: ModelEntry[]);
    getAll(): ModelEntry[];
    get(modelId: string, provider: ModelProvider): ModelEntry | undefined;
    getByProvider(provider: ModelProvider): ModelEntry[];
    getForTask(taskType: TaskType, provider?: ModelProvider): ModelEntry[];
    getForRole(role: AgentRole, provider?: ModelProvider): ModelEntry | undefined;
    register(model: ModelEntry): void;
}
//# sourceMappingURL=model-registry.d.ts.map