import { ExperienceEntry } from './experience-buffer';
export interface TelemetryRecord extends ExperienceEntry {
    source: 'workflow' | 'operational_training' | 'huggingface';
    iteration?: number;
    category?: string;
    latencyMs?: number;
    provider?: string;
    consensusVerdict?: 'APPROVED' | 'NEEDS_CORRECTION' | 'NEEDS_APPROVAL' | 'FAILED';
}
export declare class TelemetryStore {
    private filePath;
    constructor(dataDir?: string, fileName?: string);
    append(record: Omit<TelemetryRecord, 'id' | 'timestamp'>): TelemetryRecord;
    loadRecent(limit?: number): TelemetryRecord[];
    count(): number;
    getPath(): string;
}
