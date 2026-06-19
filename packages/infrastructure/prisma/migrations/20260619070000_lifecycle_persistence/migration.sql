CREATE TABLE "Estimate" (
    "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "projectName" TEXT NOT NULL,
    "customerName" TEXT NOT NULL, "items" JSONB NOT NULL,
    "subtotal" DECIMAL(18,4) NOT NULL, "tax" DECIMAL(18,4) NOT NULL,
    "total" DECIMAL(18,4) NOT NULL, "currency" TEXT NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL, "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "projectName" TEXT NOT NULL,
    "customerName" TEXT NOT NULL, "sections" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PocPlan" (
    "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "objectives" JSONB NOT NULL,
    "scope" TEXT NOT NULL, "timeline" JSONB NOT NULL, "successCriteria" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "PocPlan_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EmailDraft" (
    "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL, "body" TEXT NOT NULL, "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "EmailDraft_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CfoHandoff" (
    "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "items" JSONB NOT NULL,
    "totalAmount" DECIMAL(18,4) NOT NULL, "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CfoHandoff_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CustomerProduct" (
    "id" TEXT NOT NULL, "customerId" TEXT NOT NULL, "projectId" TEXT NOT NULL,
    "productName" TEXT NOT NULL, "version" TEXT NOT NULL,
    "installationDate" TIMESTAMP(3) NOT NULL, "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerProduct_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MaintenanceCase" (
    "id" TEXT NOT NULL, "customerId" TEXT NOT NULL, "productId" TEXT NOT NULL,
    "description" TEXT NOT NULL, "priority" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MaintenanceCase_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SolutionProposal" (
    "id" TEXT NOT NULL, "customerId" TEXT NOT NULL, "description" TEXT NOT NULL,
    "sourceEvidence" JSONB NOT NULL, "estimatedValue" DECIMAL(18,4), "currency" TEXT,
    "status" TEXT NOT NULL DEFAULT 'proposed', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "SolutionProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Estimate_projectId_status_idx" ON "Estimate"("projectId", "status");
CREATE INDEX "Proposal_projectId_status_idx" ON "Proposal"("projectId", "status");
CREATE INDEX "PocPlan_projectId_status_idx" ON "PocPlan"("projectId", "status");
CREATE INDEX "EmailDraft_projectId_status_idx" ON "EmailDraft"("projectId", "status");
CREATE INDEX "CfoHandoff_projectId_status_idx" ON "CfoHandoff"("projectId", "status");
CREATE INDEX "CustomerProduct_customerId_status_idx" ON "CustomerProduct"("customerId", "status");
CREATE UNIQUE INDEX "CustomerProduct_customerId_projectId_productName_version_key" ON "CustomerProduct"("customerId", "projectId", "productName", "version");
CREATE INDEX "MaintenanceCase_customerId_status_idx" ON "MaintenanceCase"("customerId", "status");
CREATE INDEX "MaintenanceCase_productId_status_idx" ON "MaintenanceCase"("productId", "status");
CREATE INDEX "SolutionProposal_customerId_status_idx" ON "SolutionProposal"("customerId", "status");

ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PocPlan" ADD CONSTRAINT "PocPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmailDraft" ADD CONSTRAINT "EmailDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CfoHandoff" ADD CONSTRAINT "CfoHandoff_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerProduct" ADD CONSTRAINT "CustomerProduct_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerProduct" ADD CONSTRAINT "CustomerProduct_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenanceCase" ADD CONSTRAINT "MaintenanceCase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenanceCase" ADD CONSTRAINT "MaintenanceCase_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CustomerProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SolutionProposal" ADD CONSTRAINT "SolutionProposal_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
