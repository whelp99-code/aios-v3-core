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

export class ExperienceReplayBuffer {
  private buffer: ExperienceEntry[] = [];
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  add(entry: Omit<ExperienceEntry, 'id' | 'timestamp'>): ExperienceEntry {
    const full: ExperienceEntry = {
      ...entry,
      id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.buffer.unshift(full);
    if (this.buffer.length > this.maxSize) {
      this.buffer = this.buffer.slice(0, this.maxSize);
    }
    return full;
  }

  sample(count: number): ExperienceEntry[] {
    const shuffled = [...this.buffer].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  getRecent(count: number): ExperienceEntry[] {
    return this.buffer.slice(0, count);
  }

  getSuccessRate(): number {
    if (this.buffer.length === 0) return 0;
    return this.buffer.filter((e) => e.success).length / this.buffer.length;
  }

  size(): number {
    return this.buffer.length;
  }
}
