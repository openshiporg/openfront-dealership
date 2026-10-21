-- CreateTable
CREATE TABLE "FinancingApplication" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "lead" TEXT,
    "vehicle" TEXT,
    "applicantName" TEXT NOT NULL DEFAULT '',
    "applicantEmail" TEXT NOT NULL DEFAULT '',
    "applicantPhone" TEXT NOT NULL DEFAULT '',
    "employmentStatus" TEXT NOT NULL DEFAULT '',
    "annualIncomeCents" INTEGER NOT NULL,
    "selfReportedCreditTier" TEXT NOT NULL DEFAULT '',
    "requestedAmountCents" INTEGER,
    "plannedMonthlyPaymentCents" INTEGER,
    "plannedDownPaymentCents" INTEGER,
    "tradeInValueCents" INTEGER,
    "aprBasisPoints" INTEGER,
    "loanTermMonths" INTEGER,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL,
    "immutableSnapshot" JSONB DEFAULT '{}',

    CONSTRAINT "FinancingApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LenderSubmission" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "application" TEXT,
    "providerKey" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "externalReference" TEXT,
    "requestSnapshot" JSONB DEFAULT '{}',
    "responseSummary" JSONB DEFAULT '{}',
    "errorCode" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "LenderSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LenderDecision" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "application" TEXT,
    "submission" TEXT,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "providerKey" TEXT NOT NULL DEFAULT '',
    "externalReference" TEXT,
    "decision" TEXT NOT NULL,
    "approvedAmountCents" INTEGER,
    "aprBasisPoints" INTEGER,
    "termMonths" INTEGER,
    "monthlyPaymentCents" INTEGER,
    "reasonCodes" JSONB DEFAULT '[]',
    "immutableSnapshot" JSONB DEFAULT '{}',
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT,

    CONSTRAINT "LenderDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinancingApplication_reference_key" ON "FinancingApplication"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "FinancingApplication_idempotencyKey_key" ON "FinancingApplication"("idempotencyKey");

-- CreateIndex
CREATE INDEX "FinancingApplication_lead_idx" ON "FinancingApplication"("lead");

-- CreateIndex
CREATE INDEX "FinancingApplication_vehicle_idx" ON "FinancingApplication"("vehicle");

-- CreateIndex
CREATE UNIQUE INDEX "LenderSubmission_idempotencyKey_key" ON "LenderSubmission"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LenderSubmission_application_idx" ON "LenderSubmission"("application");

-- CreateIndex
CREATE UNIQUE INDEX "LenderDecision_idempotencyKey_key" ON "LenderDecision"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LenderDecision_application_idx" ON "LenderDecision"("application");

-- CreateIndex
CREATE INDEX "LenderDecision_submission_idx" ON "LenderDecision"("submission");

-- CreateIndex
CREATE INDEX "LenderDecision_recordedBy_idx" ON "LenderDecision"("recordedBy");

-- AddForeignKey
ALTER TABLE "FinancingApplication" ADD CONSTRAINT "FinancingApplication_lead_fkey" FOREIGN KEY ("lead") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingApplication" ADD CONSTRAINT "FinancingApplication_vehicle_fkey" FOREIGN KEY ("vehicle") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LenderSubmission" ADD CONSTRAINT "LenderSubmission_application_fkey" FOREIGN KEY ("application") REFERENCES "FinancingApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LenderDecision" ADD CONSTRAINT "LenderDecision_application_fkey" FOREIGN KEY ("application") REFERENCES "FinancingApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LenderDecision" ADD CONSTRAINT "LenderDecision_submission_fkey" FOREIGN KEY ("submission") REFERENCES "LenderSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LenderDecision" ADD CONSTRAINT "LenderDecision_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
