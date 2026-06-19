import LMStudioClient from './rapid-mlx-client';
import { DynamicRouter } from './dynamic-router';
import { AgentRole, TaskType } from './types';
export type { TaskType, AgentRole } from './types';
export interface ModelConfig {
    chat: string;
    code: string;
    reasoning: string;
    embedding: string;
}
/** Backward-compatible wrapper — delegates to DynamicRouter */
export declare class ModelRouter {
    private router;
    private modelConfig;
    constructor(client: LMStudioClient, config?: Partial<ModelConfig>, router?: DynamicRouter);
    getDynamicRouter(): DynamicRouter;
    getModelForTask(taskType: TaskType): string;
    getModelForRole(role: AgentRole): string;
    routeAndChat(taskType: TaskType, messages: unknown[], options?: Record<string, unknown>): Promise<string>;
    routeAndChatWithTools(taskType: TaskType, messages: unknown[], tools: unknown[]): Promise<unknown>;
    private taskToRole;
}
export default ModelRouter;
//# sourceMappingURL=model-router.d.ts.map