/**
 * ConfidenceScore — a bounded confidence value [0, 1].
 */
export class ConfidenceScore {
  constructor(public readonly value: number) {
    if (value < 0 || value > 1) {
      throw new Error(`Confidence must be between 0 and 1, got ${value}`);
    }
  }

  static fromPercent(percent: number): ConfidenceScore {
    return new ConfidenceScore(Math.min(1, Math.max(0, percent / 100)));
  }

  isHigh(): boolean {
    return this.value >= 0.8;
  }

  isMedium(): boolean {
    return this.value >= 0.5 && this.value < 0.8;
  }

  isLow(): boolean {
    return this.value < 0.5;
  }

  toString(): string {
    return `${Math.round(this.value * 100)}%`;
  }
}
