import type { PrismaClient, Prisma } from '@prisma/client';
import type { CustomerRepository } from '@aios/application';
import { Organization, type OrganizationType } from '@aios/domain';

/** Safely convert an unknown value to Prisma-compatible JSON */
function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {}));
}

/**
 * Prisma-backed Customer (Organization) repository.
 * Maps domain Organization ↔ Prisma Organization model.
 */
export class PrismaCustomerRepository implements CustomerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(org: Organization): Promise<void> {
    const metadata = toJson(org.metadata);

    await this.prisma.organization.upsert({
      where: { id: org.id },
      create: {
        id: org.id,
        name: org.name,
        domain: org.domain,
        type: org.type,
        metadata,
      },
      update: {
        name: org.name,
        domain: org.domain,
        type: org.type,
        metadata,
      },
    });
  }

  async findById(id: string): Promise<Organization | null> {
    const row = await this.prisma.organization.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByDomain(domain: string): Promise<Organization | null> {
    const row = await this.prisma.organization.findFirst({ where: { domain } });
    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: {
    id: string;
    name: string;
    domain: string | null;
    type: string;
    metadata: unknown;
  }): Organization {
    const metadata =
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {};
    return new Organization(
      row.id,
      row.name,
      row.domain,
      row.type as OrganizationType,
      metadata
    );
  }
}
