"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FREE_TIER_MODEL_ID = exports.FREE_TIER_CLOUD_PROVIDER = void 0;
exports.isSimpleCloudTask = isSimpleCloudTask;
exports.googleSimpleTasksEnabled = googleSimpleTasksEnabled;
/** Google AI Studio free tier — use only for low-complexity cloud calls */
exports.FREE_TIER_CLOUD_PROVIDER = 'google';
exports.FREE_TIER_MODEL_ID = 'gemini-2.0-flash';
const SIMPLE_ROLES = new Set(['critic', 'knowledge_updater']);
const SIMPLE_TASK_TYPES = new Set(['chat']);
/** Roles that always need stronger models (planner, executor, self_corrector). */
const COMPLEX_ROLES = new Set(['planner', 'executor', 'self_corrector']);
function isSimpleCloudTask(role, taskType) {
    if (COMPLEX_ROLES.has(role))
        return false;
    if (taskType === 'code' || taskType === 'reasoning')
        return false;
    return SIMPLE_ROLES.has(role) || SIMPLE_TASK_TYPES.has(taskType);
}
function googleSimpleTasksEnabled() {
    const flag = process.env.AIOS_GOOGLE_SIMPLE_TASKS;
    if (flag === '0' || flag === 'false')
        return false;
    return true;
}
//# sourceMappingURL=routing-policy.js.map