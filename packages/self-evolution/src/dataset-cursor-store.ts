import fs from 'fs';
import path from 'path';

export interface DatasetCursor {
  offset: number;
  lastRowIdx?: number;
  updatedAt: string;
}

export class DatasetCursorStore {
  private filePath: string;
  private cursors: Record<string, DatasetCursor>;

  constructor(dataDir?: string, fileName = 'dataset-cursors.json') {
    const dir = dataDir ?? path.resolve(process.cwd(), 'data/learned');
    fs.mkdirSync(dir, { recursive: true });
    this.filePath = path.join(dir, fileName);
    this.cursors = this.load();
  }

  private key(datasetId: string, config = 'default', split = 'train'): string {
    return `${datasetId}::${config}::${split}`;
  }

  getOffset(datasetId: string, config?: string, split?: string): number {
    const k = this.key(datasetId, config, split);
    return this.cursors[k]?.offset ?? 0;
  }

  advance(datasetId: string, batchSize: number, config?: string, split?: string): number {
    const k = this.key(datasetId, config, split);
    const current = this.cursors[k]?.offset ?? 0;
    const next = current + batchSize;
    this.cursors[k] = { offset: next, updatedAt: new Date().toISOString() };
    this.save();
    return current;
  }

  reset(datasetId?: string): void {
    if (datasetId) {
      for (const k of Object.keys(this.cursors)) {
        if (k.startsWith(`${datasetId}::`)) delete this.cursors[k];
      }
    } else {
      this.cursors = {};
    }
    this.save();
  }

  getAll(): Record<string, DatasetCursor> {
    return { ...this.cursors };
  }

  private load(): Record<string, DatasetCursor> {
    try {
      if (fs.existsSync(this.filePath)) {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as Record<string, DatasetCursor>;
      }
    } catch {
      /* empty */
    }
    return {};
  }

  private save(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.cursors, null, 2));
  }
}
