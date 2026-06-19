/**
 * SourceSystem — identifies where data came from.
 */
export type SourceSystemType = 'mail-intelligence' | 'aios-v1' | 'manual' | 'api';

export class SourceSystem {
  constructor(
    public readonly name: SourceSystemType,
    public readonly version?: string
  ) {}

  static readonly MAIL_INTELLIGENCE = new SourceSystem('mail-intelligence', '1.0.0');
  static readonly AIOS_V1 = new SourceSystem('aios-v1', '1.0.0');
  static readonly MANUAL = new SourceSystem('manual');

  equals(other: SourceSystem): boolean {
    return this.name === other.name;
  }

  toString(): string {
    return this.version ? `${this.name}@${this.version}` : this.name;
  }
}
