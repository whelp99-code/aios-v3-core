import { AgentRole, ModelProvider, TaskType } from './types';

/** Google AI Studio free tier — use only for low-complexity cloud calls */
export const FREE_TIER_CLOUD_PROVIDER: ModelProvider = 'google';
export const FREE_TIER_MODEL_ID = 'gemini-2.0-flash';

const SIMPLE_ROLES: ReadonlySet<AgentRole> = new Set(['critic', 'knowledge_updater']);
const SIMPLE_TASK_TYPES: ReadonlySet<TaskType> = new Set(['chat']);

/** Roles that always need stronger models (planner, executor, self_corrector). */
const COMPLEX_ROLES: ReadonlySet<AgentRole> = new Set(['planner', 'executor', 'self_corrector']);

export function isSimpleCloudTask(role: AgentRole, taskType: TaskType): boolean {
  if (COMPLEX_ROLES.has(role)) return false;
  if (taskType === 'code' || taskType === 'reasoning') return false;
  return SIMPLE_ROLES.has(role) || SIMPLE_TASK_TYPES.has(taskType);
}

export function googleSimpleTasksEnabled(): boolean {
  const flag = process.env.AIOS_GOOGLE_SIMPLE_TASKS;
  if (flag === '0' || flag === 'false') return false;
  return true;
}
