-- CreateTable
CREATE TABLE "AccountingMapping" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceCode" TEXT NOT NULL DEFAULT '',
    "debitAccount" TEXT NOT NULL DEFAULT '',
    "creditAccount" TEXT NOT NULL DEFAULT '',
    "providerKey" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "AccountingMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingBatch" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL DEFAULT '',
    "lines" JSONB DEFAULT '[]',
    "totalDebitCents" INTEGER NOT NULL,
    "totalCreditCents" INTEGER NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "externalReference" TEXT NOT NULL DEFAULT '',
    "lastErrorCode" TEXT NOT NULL DEFAULT '',
    "postedAt" TIMESTAMP(3),
    "reconciledAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "AccountingBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingProviderResponse" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "batch" TEXT,
    "providerKey" TEXT NOT NULL DEFAULT '',
    "requestFingerprint" TEXT NOT NULL DEFAULT '',
    "responseCode" TEXT NOT NULL DEFAULT '',
    "externalReference" TEXT NOT NULL DEFAULT '',
    "immutableResponse" JSONB DEFAULT '{}',
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "AccountingProviderResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountingMapping_rooftop_idx" ON "AccountingMapping"("rooftop");
CREATE UNIQUE INDEX "AccountingMapping_rooftop_source_provider_key" ON "AccountingMapping"("rooftop", "sourceType", "sourceCode", "providerKey");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingBatch_idempotencyKey_key" ON "AccountingBatch"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AccountingBatch_rooftop_idx" ON "AccountingBatch"("rooftop");
CREATE UNIQUE INDEX "AccountingBatch_active_source_key" ON "AccountingBatch"("rooftop", "sourceType", "sourceId") WHERE "status" <> 'failed';
ALTER TABLE "AccountingBatch" ADD CONSTRAINT "AccountingBatch_balanced_check" CHECK ("totalDebitCents" = "totalCreditCents" AND "totalDebitCents" > 0);

-- CreateIndex
CREATE UNIQUE INDEX "AccountingProviderResponse_idempotencyKey_key" ON "AccountingProviderResponse"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AccountingProviderResponse_rooftop_idx" ON "AccountingProviderResponse"("rooftop");

-- CreateIndex
CREATE INDEX "AccountingProviderResponse_batch_idx" ON "AccountingProviderResponse"("batch");

-- AddForeignKey
ALTER TABLE "AccountingMapping" ADD CONSTRAINT "AccountingMapping_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingBatch" ADD CONSTRAINT "AccountingBatch_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingProviderResponse" ADD CONSTRAINT "AccountingProviderResponse_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingProviderResponse" ALTER COLUMN "batch" SET NOT NULL;
ALTER TABLE "AccountingProviderResponse" ADD CONSTRAINT "AccountingProviderResponse_batch_fkey" FOREIGN KEY ("batch") REFERENCES "AccountingBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
