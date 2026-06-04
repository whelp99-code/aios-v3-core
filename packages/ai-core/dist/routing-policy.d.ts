import { AgentRole, ModelProvider, TaskType } from './types';
/** Google AI Studio free tier — use only for low-complexity cloud calls */
export declare const FREE_TIER_CLOUD_PROVIDER: ModelProvider;
export declare const FREE_TIER_MODEL_ID = "gemini-2.0-flash";
export declare function isSimpleCloudTask(role: AgentRole, taskType: TaskType): boolean;
export declare function googleSimpleTasksEnabled(): boolean;
//# sourceMappingURL=routing-policy.d.ts.map