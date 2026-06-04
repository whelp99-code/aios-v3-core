import fs from 'fs';
import path from 'path';

export interface LearnedRoutingBias {
  planner?: string;
  executor?: string;
  critic?: string;
  preferredProvider?: 'openai' | 'anthropic' | 'huggingface' | 'local';
}

export interface LearnedPolicy {
  version: number;
  iteration: number;
  successRate: number;
  avgReward: number;
  qualityThreshold: number;
  batchSize: number;
  synthesisKeywords: string[];
  routingBias: LearnedRoutingBias;
  categoryScores: Record<string, { success: number; total: number }>;
  appliedImprovements: string[];
  updatedAt: string;
}

const DEFAULT_POLICY: LearnedPolicy = {
  version: 0,
  iteration: 0,
  successRate: 0,
  avgReward: 0,
  qualityThreshold: 0.55,
  batchSize: 15,
  synthesisKeywords: ['missing', 'incomplete', 'error', 'bug'],
  routingBias: { preferredProvider: 'huggingface' },
  categoryScores: {},
  appliedImprovements: [],
  updatedAt: new Date().toISOString(),
};

export class LearnedPolicyStore {
  private filePath: string;
  private policy: LearnedPolicy;

  constructor(dataDir?: string, policyFile = 'policy.json') {
    const dir = dataDir ?? path.resolve(process.cwd(), 'data/learned');
    fs.mkdirSync(dir, { recursive: true });
    this.filePath = path.join(dir, policyFile);
    this.policy = this.load();
  }

  get(): LearnedPolicy {
    return { ...this.policy };
  }

  update(partial: Partial<LearnedPolicy>): LearnedPolicy {
    this.policy = {
      ...this.policy,
      ...partial,
      version: this.policy.version + 1,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.get();
  }

  reset(): LearnedPolicy {
    this.policy = { ...DEFAULT_POLICY, updatedAt: new Date().toISOString() };
    this.save();
    return this.get();
  }

  private load(): LearnedPolicy {
    try {
      if (fs.existsSync(this.filePath)) {
        return { ...DEFAULT_POLICY, ...JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) };
      }
    } catch {
      /* use default */
    }
    return { ...DEFAULT_POLICY };
  }

  private save(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.policy, null, 2));
  }
}
