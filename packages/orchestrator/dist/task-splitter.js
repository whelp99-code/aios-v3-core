"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskSplitter = void 0;
class TaskSplitter {
    splitPlan(plan, taskInput) {
        const lines = plan.split('\n').filter((line) => line.trim());
        const subTasks = [];
        let taskIndex = 0;
        for (const line of lines) {
            const numberedMatch = line.match(/^\s*(\d+)[.)]\s*(.+)/);
            const bulletMatch = line.match(/^\s*[-*]\s*(.+)/);
            const description = numberedMatch?.[2] ?? bulletMatch?.[1];
            if (description) {
                taskIndex++;
                subTasks.push({
                    id: `subtask-${taskIndex}`,
                    description: description.trim(),
                    priority: taskIndex,
                    assignedTools: this.inferTools(description),
                });
            }
        }
        if (subTasks.length === 0) {
            subTasks.push({
                id: 'subtask-1',
                description: taskInput,
                priority: 1,
                assignedTools: [],
            });
        }
        return subTasks;
    }
    formatSubTasksForExecution(subTasks) {
        return subTasks
            .map((t) => `${t.priority}. [${t.id}] ${t.description} (tools: ${t.assignedTools.join(', ') || 'none'})`)
            .join('\n');
    }
    inferTools(description) {
        const tools = [];
        const lower = description.toLowerCase();
        if (lower.includes('deploy') || lower.includes('code') || lower.includes('project')) {
            tools.push('vibe_create_project', 'vibe_run_code');
        }
        if (lower.includes('automat') || lower.includes('workflow') || lower.includes('task')) {
            tools.push('automation_create_workflow', 'automation_run_task');
        }
        if (lower.includes('revenue') || lower.includes('metric') || lower.includes('report')) {
            tools.push('revenue_track_metrics', 'revenue_generate_report');
        }
        return tools;
    }
}
exports.TaskSplitter = TaskSplitter;
