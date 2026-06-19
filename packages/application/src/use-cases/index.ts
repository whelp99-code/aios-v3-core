/**
 * Use Cases
 * Business logic orchestration.
 */

export interface UseCase<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>;
}

/** Ingest a mail thread from source system */
export interface IngestMailThreadInput {
  sourceSystem: string;
  externalId: string;
  raw: unknown;
}

export interface IngestMailThreadOutput {
  threadId: string;
  idempotent: boolean;
}

export interface IngestMailThread extends UseCase<IngestMailThreadInput, IngestMailThreadOutput> {}

/** Analyze a mail thread */
export interface AnalyzeMailThreadInput {
  threadId: string;
}

export interface AnalyzeMailThreadOutput {
  customers: unknown[];
  requests: unknown[];
  deadlines: unknown[];
  confidence: number;
}

export interface AnalyzeMailThread extends UseCase<AnalyzeMailThreadInput, AnalyzeMailThreadOutput> {}

/** Upsert customer from mail analysis */
export interface UpsertCustomerFromMailInput {
  domain: string;
  name: string;
  contacts: unknown[];
}

export interface UpsertCustomerFromMailOutput {
  customerId: string;
  idempotent: boolean;
}

export interface UpsertCustomerFromMail extends UseCase<UpsertCustomerFromMailInput, UpsertCustomerFromMailOutput> {}

/** Propose project from mail */
export interface ProposeProjectFromMailInput {
  threadId: string;
  customerId: string;
  confidence: number;
}

export interface ProposeProjectFromMailOutput {
  candidateId: string;
}

export interface ProposeProjectFromMail extends UseCase<ProposeProjectFromMailInput, ProposeProjectFromMailOutput> {}
