export interface ExperienceEntry {
    id: string;
    taskInput: string;
    plan: string | null;
    executionResult: string | null;
    review: string | null;
    success: boolean;
    reward: number;
    timestamp: string;
    metadata?: Record<string, unknown>;
}
export declare class ExperienceReplayBuffer {
    private buffer;
    private maxSize;
    constructor(maxSize?: number);
    add(entry: Omit<ExperienceEntry, 'id' | 'timestamp'>): ExperienceEntry;
    sample(count: number): ExperienceEntry[];
    getRecent(count: number): ExperienceEntry[];
    getSuccessRate(): number;
    size(): number;
}
