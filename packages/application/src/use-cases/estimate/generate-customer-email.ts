
import type { UseCase } from '../index.js';

export interface GenerateCustomerEmailInput {
  projectId: string;
  projectName: string;
  customerName: string;
  recipientEmail: string;
  purpose: 'estimate' | 'proposal' | 'poc' | 'follow_up';
  customMessage?: string;
}

export interface GenerateCustomerEmailOutput {
  draftId: string;
  subject: string;
  body: string;
  status: 'draft';
  approvalRequired: true;
}

/**
 * GenerateCustomerEmail
 * Creates a customer email draft.
 * Always returns status='draft' and approvalRequired=true.
 * NEVER sends the email directly.
 */
export class GenerateCustomerEmail implements UseCase<GenerateCustomerEmailInput, GenerateCustomerEmailOutput> {
  async execute(input: GenerateCustomerEmailInput): Promise<GenerateCustomerEmailOutput> {
    const purposeText: Record<string, string> = {
      estimate: '견적서 전달',
      proposal: '제안서 전달',
      poc: 'POC 계획 공유',
      follow_up: '후속 조치',
    };

    return {
      draftId: globalThis.crypto.randomUUID(),
      subject: `[${input.projectName}] ${purposeText[input.purpose]}`,
      body: `${input.customerName}님께,

안녕하세요.

${input.projectName} 관련 ${purposeText[input.purpose]}드립니다.

${input.customMessage ?? '검토 후 회신 부탁드립니다.'}

감사합니다.`,
      status: 'draft',
      approvalRequired: true,
    };
  }
}
