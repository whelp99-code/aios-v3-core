import { BaseEntity } from '../entities/index.js';
import type { EstimateLineItem } from '../estimate/index.js';

const SCALE = 10_000n;

function divideRounded(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

export class DecimalMoney {
  private constructor(
    private readonly units: bigint,
    public readonly currency: string
  ) {}

  static from(value: number | string, currency: string): DecimalMoney {
    if (!currency.trim()) throw new Error('Currency is required');
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      throw new Error(`Invalid money amount: ${value}`);
    }
    return new DecimalMoney(BigInt(Math.round(numeric * Number(SCALE))), currency.toUpperCase());
  }

  static zero(currency: string): DecimalMoney {
    return new DecimalMoney(0n, currency.toUpperCase());
  }

  add(other: DecimalMoney): DecimalMoney {
    if (this.currency !== other.currency) throw new Error('Cannot add different currencies');
    return new DecimalMoney(this.units + other.units, this.currency);
  }

  multiply(factor: number): DecimalMoney {
    if (!Number.isFinite(factor) || factor < 0) throw new Error(`Invalid factor: ${factor}`);
    const scaledFactor = BigInt(Math.round(factor * Number(SCALE)));
    return new DecimalMoney(divideRounded(this.units * scaledFactor, SCALE), this.currency);
  }

  percentage(rate: number): DecimalMoney {
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      throw new Error(`Invalid percentage: ${rate}`);
    }
    const scaledRate = BigInt(Math.round(rate * Number(SCALE)));
    return new DecimalMoney(
      divideRounded(this.units * scaledRate, 100n * SCALE),
      this.currency
    );
  }

  toDecimalString(): string {
    const whole = this.units / SCALE;
    const fraction = (this.units % SCALE).toString().padStart(4, '0');
    return `${whole}.${fraction}`;
  }

  toNumber(): number {
    return Number(this.units) / Number(SCALE);
  }
}

export type DraftStatus = 'draft' | 'approved' | 'sent';

export class EstimateDraft extends BaseEntity<string> {
  constructor(
    id: string,
    public readonly projectId: string,
    public readonly projectName: string,
    public readonly customerName: string,
    public readonly items: EstimateLineItem[],
    public readonly subtotal: DecimalMoney,
    public readonly tax: DecimalMoney,
    public readonly total: DecimalMoney,
    public readonly validUntil: Date,
    public readonly status: DraftStatus = 'draft'
  ) { super(id); }
}

export class ProposalDraft extends BaseEntity<string> {
  constructor(
    id: string,
    public readonly projectId: string,
    public readonly projectName: string,
    public readonly customerName: string,
    public readonly sections: Array<{ title: string; content: string }>,
    public readonly status: DraftStatus = 'draft'
  ) { super(id); }
}

export class PocPlanDraft extends BaseEntity<string> {
  constructor(
    id: string,
    public readonly projectId: string,
    public readonly objectives: string[],
    public readonly scope: string,
    public readonly timeline: Array<{ phase: string; duration: string }>,
    public readonly successCriteria: string[],
    public readonly status: DraftStatus = 'draft'
  ) { super(id); }
}

export class EmailDraft extends BaseEntity<string> {
  constructor(
    id: string,
    public readonly projectId: string,
    public readonly recipientEmail: string,
    public readonly subject: string,
    public readonly body: string,
    public readonly purpose: string,
    public readonly status: DraftStatus = 'draft'
  ) { super(id); }
}

export class CfoHandoffDraft extends BaseEntity<string> {
  constructor(
    id: string,
    public readonly projectId: string,
    public readonly items: Array<{ category: string; description: string; amount: number; currency: string }>,
    public readonly total: DecimalMoney,
    public readonly status: DraftStatus = 'draft'
  ) { super(id); }
}

export class CustomerProduct extends BaseEntity<string> {
  constructor(
    id: string,
    public readonly customerId: string,
    public readonly projectId: string,
    public readonly productName: string,
    public readonly version: string,
    public readonly installationDate: Date,
    public readonly status: 'active' | 'retired' = 'active'
  ) { super(id); }
}

export class MaintenanceCase extends BaseEntity<string> {
  constructor(
    id: string,
    public readonly customerId: string,
    public readonly productId: string,
    public readonly description: string,
    public readonly priority: 'low' | 'medium' | 'high' | 'critical',
    public readonly status: 'open' | 'in_progress' | 'resolved' = 'open'
  ) { super(id); }
}

export class SolutionProposal extends BaseEntity<string> {
  constructor(
    id: string,
    public readonly customerId: string,
    public readonly description: string,
    public readonly sourceEvidence: string[],
    public readonly estimatedValue: DecimalMoney | null,
    public readonly status: 'proposed' | 'accepted' | 'rejected' = 'proposed'
  ) { super(id); }
}
