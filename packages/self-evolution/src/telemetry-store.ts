import fs from 'fs';
import path from 'path';
import { ExperienceEntry } from './experience-buffer';

export interface TelemetryRecord extends ExperienceEntry {
  source: 'workflow' | 'operational_training' | 'huggingface';
  iteration?: number;
  category?: string;
  latencyMs?: number;
  provider?: string;
  consensusVerdict?: 'APPROVED' | 'NEEDS_CORRECTION' | 'NEEDS_APPROVAL' | 'FAILED';
}

export class TelemetryStore {
  private filePath: string;

  constructor(dataDir?: string, fileName = 'experiences.jsonl') {
    const dir = dataDir ?? path.resolve(process.cwd(), 'data/telemetry');
    fs.mkdirSync(dir, { recursive: true });
    this.filePath = path.join(dir, fileName);
  }

  append(record: Omit<TelemetryRecord, 'id' | 'timestamp'>): TelemetryRecord {
    const full: TelemetryRecord = {
      ...record,
      id: `tel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };
    fs.appendFileSync(this.filePath, `${JSON.stringify(full)}\n`, 'utf8');
    return full;
  }

  loadRecent(limit = 500): TelemetryRecord[] {
    if (!fs.existsSync(this.filePath)) return [];
    const lines = fs.readFileSync(this.filePath, 'utf8').trim().split('\n').filter(Boolean);
    return lines
      .slice(-limit)
      .map((line) => JSON.parse(line) as TelemetryRecord)
      .reverse();
  }

  count(): number {
    if (!fs.existsSync(this.filePath)) return 0;
    return fs.readFileSync(this.filePath, 'utf8').trim().split('\n').filter(Boolean).length;
  }

  getPath(): string {
    return this.filePath;
  }
}
