import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  MailAutomationPersistenceInput,
  MailAutomationPersistenceResult,
  MailAutomationRepository,
} from '@aios/application';

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {}));
}

export class PrismaMailAutomationRepository implements MailAutomationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async persistAnalysis(
    input: MailAutomationPersistenceInput
  ): Promise<MailAutomationPersistenceResult> {
    return this.prisma.$transaction(async (tx) => {
      const thread = await tx.mailThread.upsert({
        where: {
          sourceSystem_externalId: {
            sourceSystem: input.thread.source.system,
            externalId: input.thread.source.id,
          },
        },
        create: {
          id: input.thread.id,
          sourceSystem: input.thread.source.system,
          externalId: input.thread.source.id,
          subject: input.thread.subject,
          participants: toJson([...input.thread.participants]),
          status: input.thread.status,
          metadata: toJson(input.thread.metadata),
        },
        update: {
          subject: input.thread.subject,
          participants: toJson([...input.thread.participants]),
          status: input.thread.status,
          metadata: toJson(input.thread.metadata),
        },
      });

      for (const message of input.messages) {
        await tx.mailMessage.upsert({
          where: {
            threadId_externalId: { threadId: thread.id, externalId: message.externalId },
          },
          create: {
            id: message.id,
            threadId: thread.id,
            externalId: message.externalId,
            sender: message.sender,
            recipients: toJson(message.recipients),
            subject: message.subject,
            bodyPreview: message.bodyPreview,
            sentAt: message.sentAt,
            attachments: toJson(message.attachmentRefs),
            metadata: toJson(message.metadata),
          },
          update: {
            sender: message.sender,
            recipients: toJson(message.recipients),
            subject: message.subject,
            bodyPreview: message.bodyPreview,
            sentAt: message.sentAt,
            attachments: toJson(message.attachmentRefs),
            metadata: toJson(message.metadata),
          },
        });
      }

      let customerId: string | null = null;
      if (input.customer) {
        const customer = input.customer.domain
          ? await tx.organization.upsert({
              where: { domain: input.customer.domain },
              create: {
                id: input.customer.id,
                name: input.customer.name,
                domain: input.customer.domain,
                type: input.customer.type,
                metadata: toJson(input.customer.metadata),
              },
              update: {
                name: input.customer.name,
                type: input.customer.type,
                metadata: toJson(input.customer.metadata),
              },
            })
          : await tx.organization.create({
              data: {
                id: input.customer.id,
                name: input.customer.name,
                domain: null,
                type: input.customer.type,
                metadata: toJson(input.customer.metadata),
              },
            });
        customerId = customer.id;

        if (input.contact) {
          await tx.contact.upsert({
            where: {
              organizationId_email: {
                organizationId: customer.id,
                email: input.contact.email.value.toLowerCase(),
              },
            },
            create: {
              id: input.contact.id,
              organizationId: customer.id,
              name: input.contact.name,
              email: input.contact.email.value.toLowerCase(),
              role: input.contact.role,
              metadata: toJson(input.contact.metadata),
            },
            update: {
              name: input.contact.name,
              role: input.contact.role,
              metadata: toJson(input.contact.metadata),
            },
          });
        }
      }

      let candidateId: string | null = null;
      if (input.candidate) {
        const candidate = await tx.projectCandidate.upsert({
          where: { threadId: thread.id },
          create: {
            id: input.candidate.id,
            threadId: thread.id,
            customerId,
            confidence: input.candidate.confidence.value,
            status: input.candidate.status,
            metadata: toJson(input.candidate.metadata),
          },
          update: {
            customerId,
            confidence: input.candidate.confidence.value,
            metadata: toJson(input.candidate.metadata),
          },
        });
        candidateId = candidate.id;
      }

      await tx.auditEvent.create({
        data: {
          aggregateType: 'MailThread',
          aggregateId: thread.id,
          eventType: 'MailAnalysisPersisted',
          data: toJson({ customerId, candidateId, messageCount: input.messages.length }),
        },
      });

      return { threadId: thread.id, customerId, candidateId };
    });
  }
}
