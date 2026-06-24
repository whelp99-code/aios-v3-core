CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "MailThread" (
    "id" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "participants" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ingested',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MailThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MailMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "recipients" JSONB NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyPreview" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "attachments" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MailMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "type" TEXT NOT NULL DEFAULT 'customer',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectCandidate" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "customerId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerId" TEXT,
    "candidateId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'candidate',
    "owner" TEXT,
    "dueDate" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskCard" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assignee" TEXT,
    "dueDate" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaskCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedBy" TEXT NOT NULL,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "reason" TEXT,
    "metadata" JSONB,
    "actionType" TEXT,
    "actionTarget" TEXT,
    "actionPayload" JSONB,
    "payloadHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalDecision" (
    "id" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalActionOutbox" (
    "id" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExternalActionOutbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MailThread_status_idx" ON "MailThread"("status");
CREATE INDEX "MailThread_createdAt_idx" ON "MailThread"("createdAt");
CREATE UNIQUE INDEX "MailThread_sourceSystem_externalId_key" ON "MailThread"("sourceSystem", "externalId");
CREATE INDEX "MailMessage_sentAt_idx" ON "MailMessage"("sentAt");
CREATE UNIQUE INDEX "MailMessage_threadId_externalId_key" ON "MailMessage"("threadId", "externalId");
CREATE INDEX "Organization_domain_idx" ON "Organization"("domain");
CREATE UNIQUE INDEX "Organization_domain_key" ON "Organization"("domain");
CREATE INDEX "Organization_type_idx" ON "Organization"("type");
CREATE INDEX "Contact_email_idx" ON "Contact"("email");
CREATE UNIQUE INDEX "Contact_organizationId_email_key" ON "Contact"("organizationId", "email");
CREATE INDEX "ProjectCandidate_status_idx" ON "ProjectCandidate"("status");
CREATE INDEX "ProjectCandidate_confidence_idx" ON "ProjectCandidate"("confidence");
CREATE UNIQUE INDEX "ProjectCandidate_threadId_key" ON "ProjectCandidate"("threadId");
CREATE UNIQUE INDEX "Project_candidateId_key" ON "Project"("candidateId");
CREATE INDEX "Project_status_idx" ON "Project"("status");
CREATE INDEX "Project_customerId_idx" ON "Project"("customerId");
CREATE INDEX "TaskCard_projectId_status_idx" ON "TaskCard"("projectId", "status");
CREATE INDEX "ApprovalRequest_status_idx" ON "ApprovalRequest"("status");
CREATE INDEX "ApprovalRequest_projectId_idx" ON "ApprovalRequest"("projectId");
CREATE UNIQUE INDEX "ApprovalDecision_approvalId_key" ON "ApprovalDecision"("approvalId");
CREATE UNIQUE INDEX "ExternalActionOutbox_approvalId_key" ON "ExternalActionOutbox"("approvalId");
CREATE INDEX "ExternalActionOutbox_status_createdAt_idx" ON "ExternalActionOutbox"("status", "createdAt");
CREATE INDEX "ExternalActionOutbox_projectId_idx" ON "ExternalActionOutbox"("projectId");
CREATE INDEX "AuditEvent_aggregateType_aggregateId_idx" ON "AuditEvent"("aggregateType", "aggregateId");
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MailThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectCandidate" ADD CONSTRAINT "ProjectCandidate_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MailThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "ProjectCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskCard" ADD CONSTRAINT "TaskCard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "ApprovalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalActionOutbox" ADD CONSTRAINT "ExternalActionOutbox_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "ApprovalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
