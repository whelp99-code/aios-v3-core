/**
 * Domain Entities
 * Core business objects with identity and lifecycle.
 */

export interface Entity<TId> {
  id: TId;
  equals(other: Entity<TId>): boolean;
}

export abstract class BaseEntity<TId> implements Entity<TId> {
  constructor(public readonly id: TId) {}

  equals(other: Entity<TId>): boolean {
    return this.id === other.id;
  }
}
