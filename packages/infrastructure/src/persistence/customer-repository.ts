import type { CustomerRepository } from '@aios/application';

export class CustomerRepositoryImpl implements CustomerRepository {
  constructor(private prisma: { organization: unknown }) {}

  async save(_customer: unknown): Promise<void> {
    throw new Error('Not implemented — run db:generate first');
  }

  async findById(_id: string): Promise<unknown | null> {
    throw new Error('Not implemented — run db:generate first');
  }

  async findByDomain(_domain: string): Promise<unknown | null> {
    throw new Error('Not implemented — run db:generate first');
  }
}
