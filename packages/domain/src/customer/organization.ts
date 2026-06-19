import { BaseEntity } from '../entities/index.js';

export type OrganizationType = 'customer' | 'partner' | 'vendor';

/**
 * Organization — a company or entity.
 */
export class Organization extends BaseEntity<string> {
  private _type: OrganizationType;

  constructor(
    id: string,
    public readonly name: string,
    public readonly domain: string | null,
    type: OrganizationType = 'customer',
    public readonly metadata: Record<string, unknown> = {}
  ) {
    super(id);
    this._type = type;
  }

  get type(): OrganizationType {
    return this._type;
  }

  promoteToPartner(): void {
    this._type = 'partner';
  }
}
