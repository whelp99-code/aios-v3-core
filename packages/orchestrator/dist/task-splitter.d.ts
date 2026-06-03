export interface SubTask {
    id: string;
    description: string;
    priority: number;
    assignedTools: string[];
}
export declare class TaskSplitter {
    splitPlan(plan: string, taskInput: string): SubTask[];
    formatSubTasksForExecution(subTasks: SubTask[]): string;
    private inferTools;
}
//# sourceMappingURL=task-splitter.d.ts.map