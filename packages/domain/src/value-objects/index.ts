/**
 * Domain Value Objects
 * Immutable objects defined by their attributes, not identity.
 */

export interface ValueObject<T> {
  equals(other: T): boolean;
}

/** Email address value object */
export class EmailAddress implements ValueObject<EmailAddress> {
  constructor(public readonly value: string) {
    if (!EmailAddress.isValid(value)) {
      throw new Error(`Invalid email address: ${value}`);
    }
  }

  static isValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  equals(other: EmailAddress): boolean {
    return this.value.toLowerCase() === other.value.toLowerCase();
  }
}

/** Money value object */
export class Money implements ValueObject<Money> {
  constructor(
    public readonly amount: number,
    public readonly currency: string = 'KRW'
  ) {
    if (amount < 0) {
      throw new Error('Money amount cannot be negative');
    }
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add different currencies');
    }
    return new Money(this.amount + other.amount, this.currency);
  }
}

/** External source identifier */
export class ExternalSourceId implements ValueObject<ExternalSourceId> {
  constructor(
    public readonly system: string,
    public readonly id: string
  ) {}

  equals(other: ExternalSourceId): boolean {
    return this.system === other.system && this.id === other.id;
  }
}
