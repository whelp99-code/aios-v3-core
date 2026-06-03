import RapidMLXClient from './rapid-mlx-client';
export type TaskType = 'chat' | 'code' | 'reasoning' | 'embedding';
export type AgentRole = 'planner' | 'executor' | 'critic' | 'knowledge_updater' | 'self_corrector';
export interface ModelConfig {
    chat: string;
    code: string;
    reasoning: string;
    embedding: string;
}
export declare class ModelRouter {
    private client;
    private modelConfig;
    constructor(client: RapidMLXClient, config?: Partial<ModelConfig>);
    getModelForTask(taskType: TaskType): string;
    getModelForRole(role: AgentRole): string;
    routeAndChat(taskType: TaskType, messages: any[], options?: any): Promise<string>;
    routeAndChatWithTools(taskType: TaskType, messages: any[], tools: any[]): Promise<any>;
}
export default ModelRouter;
//# sourceMappingURL=model-router.d.ts.map