import { BaseEntity } from '../entities/index.js';
import { EmailAddress } from '../value-objects/index.js';

/**
 * Contact — a person within an organization.
 */
export class Contact extends BaseEntity<string> {
  constructor(
    id: string,
    public readonly organizationId: string,
    public readonly name: string,
    public readonly email: EmailAddress,
    public readonly role: string | null = null,
    public readonly metadata: Record<string, unknown> = {}
  ) {
    super(id);
  }
}
