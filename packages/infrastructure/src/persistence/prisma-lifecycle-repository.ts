import type { Prisma, PrismaClient } from '@prisma/client';
import type { LifecycleRepository } from '@aios/application';
import {
  CustomerProduct,
  type CfoHandoffDraft,
  type EmailDraft,
  type EstimateDraft,
  type MaintenanceCase,
  type PocPlanDraft,
  type ProposalDraft,
  type SolutionProposal,
  type TaskCard,
} from '@aios/domain';

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {}));
}

export class PrismaLifecycleRepository implements LifecycleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async saveTasks(tasks: TaskCard[]): Promise<void> {
    await this.prisma.$transaction(tasks.map((task) => this.prisma.taskCard.upsert({
      where: { id: task.id },
      create: {
        id: task.id,
        projectId: task.projectId,
        title: task.title,
        description: task.description,
        status: task.status,
        assignee: task.assignee,
        dueDate: task.dueDate,
        metadata: toJson(task.metadata),
      },
      update: {
        title: task.title,
        description: task.description,
        status: task.status,
        assignee: task.assignee,
        dueDate: task.dueDate,
        metadata: toJson(task.metadata),
      },
    })));
  }

  async saveEstimate(estimate: EstimateDraft): Promise<void> {
    await this.prisma.estimate.upsert({
      where: { id: estimate.id },
      create: {
        id: estimate.id,
        projectId: estimate.projectId,
        projectName: estimate.projectName,
        customerName: estimate.customerName,
        items: toJson(estimate.items),
        subtotal: estimate.subtotal.toDecimalString(),
        tax: estimate.tax.toDecimalString(),
        total: estimate.total.toDecimalString(),
        currency: estimate.total.currency,
        validUntil: estimate.validUntil,
        status: estimate.status,
      },
      update: {
        items: toJson(estimate.items),
        subtotal: estimate.subtotal.toDecimalString(),
        tax: estimate.tax.toDecimalString(),
        total: estimate.total.toDecimalString(),
        validUntil: estimate.validUntil,
        status: estimate.status,
      },
    });
  }

  async saveProposal(proposal: ProposalDraft): Promise<void> {
    await this.prisma.proposal.upsert({
      where: { id: proposal.id },
      create: {
        id: proposal.id,
        projectId: proposal.projectId,
        projectName: proposal.projectName,
        customerName: proposal.customerName,
        sections: toJson(proposal.sections),
        status: proposal.status,
      },
      update: { sections: toJson(proposal.sections), status: proposal.status },
    });
  }

  async savePocPlan(plan: PocPlanDraft): Promise<void> {
    await this.prisma.pocPlan.upsert({
      where: { id: plan.id },
      create: {
        id: plan.id,
        projectId: plan.projectId,
        objectives: toJson(plan.objectives),
        scope: plan.scope,
        timeline: toJson(plan.timeline),
        successCriteria: toJson(plan.successCriteria),
        status: plan.status,
      },
      update: {
        objectives: toJson(plan.objectives),
        scope: plan.scope,
        timeline: toJson(plan.timeline),
        successCriteria: toJson(plan.successCriteria),
        status: plan.status,
      },
    });
  }

  async saveEmailDraft(draft: EmailDraft): Promise<void> {
    await this.prisma.emailDraft.upsert({
      where: { id: draft.id },
      create: {
        id: draft.id,
        projectId: draft.projectId,
        recipientEmail: draft.recipientEmail,
        subject: draft.subject,
        body: draft.body,
        purpose: draft.purpose,
        status: draft.status,
      },
      update: { subject: draft.subject, body: draft.body, status: draft.status },
    });
  }

  async saveCfoHandoff(handoff: CfoHandoffDraft): Promise<void> {
    await this.prisma.cfoHandoff.upsert({
      where: { id: handoff.id },
      create: {
        id: handoff.id,
        projectId: handoff.projectId,
        items: toJson(handoff.items),
        totalAmount: handoff.total.toDecimalString(),
        currency: handoff.total.currency,
        status: handoff.status,
      },
      update: {
        items: toJson(handoff.items),
        totalAmount: handoff.total.toDecimalString(),
        status: handoff.status,
      },
    });
  }

  async saveCustomerProduct(product: CustomerProduct): Promise<CustomerProduct> {
    const row = await this.prisma.customerProduct.upsert({
      where: {
        customerId_projectId_productName_version: {
          customerId: product.customerId,
          projectId: product.projectId,
          productName: product.productName,
          version: product.version,
        },
      },
      create: {
        id: product.id,
        customerId: product.customerId,
        projectId: product.projectId,
        productName: product.productName,
        version: product.version,
        installationDate: product.installationDate,
        status: product.status,
      },
      update: { version: product.version, status: product.status },
    });
    return new CustomerProduct(
      row.id, row.customerId, row.projectId, row.productName,
      row.version, row.installationDate, row.status as 'active' | 'retired'
    );
  }

  async findCustomerProduct(id: string): Promise<CustomerProduct | null> {
    const row = await this.prisma.customerProduct.findUnique({ where: { id } });
    return row ? new CustomerProduct(
      row.id, row.customerId, row.projectId, row.productName,
      row.version, row.installationDate, row.status as 'active' | 'retired'
    ) : null;
  }

  async saveMaintenanceCase(maintenanceCase: MaintenanceCase): Promise<void> {
    await this.prisma.maintenanceCase.upsert({
      where: { id: maintenanceCase.id },
      create: {
        id: maintenanceCase.id,
        customerId: maintenanceCase.customerId,
        productId: maintenanceCase.productId,
        description: maintenanceCase.description,
        priority: maintenanceCase.priority,
        status: maintenanceCase.status,
      },
      update: {
        description: maintenanceCase.description,
        priority: maintenanceCase.priority,
        status: maintenanceCase.status,
      },
    });
  }

  async saveSolutionProposal(proposal: SolutionProposal): Promise<void> {
    await this.prisma.solutionProposal.upsert({
      where: { id: proposal.id },
      create: {
        id: proposal.id,
        customerId: proposal.customerId,
        description: proposal.description,
        sourceEvidence: toJson(proposal.sourceEvidence),
        estimatedValue: proposal.estimatedValue?.toDecimalString(),
        currency: proposal.estimatedValue?.currency,
        status: proposal.status,
      },
      update: {
        description: proposal.description,
        sourceEvidence: toJson(proposal.sourceEvidence),
        estimatedValue: proposal.estimatedValue?.toDecimalString(),
        currency: proposal.estimatedValue?.currency,
        status: proposal.status,
      },
    });
  }
}
