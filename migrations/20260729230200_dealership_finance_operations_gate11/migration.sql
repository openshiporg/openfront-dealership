-- CreateTable
CREATE TABLE "FinanceProduct" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "retailPriceCents" INTEGER NOT NULL,
    "costCents" INTEGER NOT NULL,

    CONSTRAINT "FinanceProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceMenuVersion" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "deal" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "optionsSnapshot" JSONB DEFAULT '[]',
    "selectedProductCodes" JSONB DEFAULT '[]',
    "declinedProductCodes" JSONB DEFAULT '[]',
    "disclosureAcknowledgment" TEXT NOT NULL DEFAULT '',
    "presentedAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "FinanceMenuVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceComplianceCheck" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "deal" TEXT NOT NULL,
    "checkType" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "resultCode" TEXT NOT NULL DEFAULT '',
    "requestSnapshot" JSONB DEFAULT '{}',
    "resultSnapshot" JSONB DEFAULT '{}',
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "FinanceComplianceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceContractPackage" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "deal" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL DEFAULT '',
    "envelopeReference" TEXT NOT NULL DEFAULT '',
    "requiredDocuments" JSONB DEFAULT '[]',
    "documentChecklist" JSONB DEFAULT '[]',
    "immutableStatusEvidence" JSONB DEFAULT '{}',
    "sentAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "lastWebhookAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "FinanceContractPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceFundingCase" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "deal" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "checklist" JSONB DEFAULT '[]',
    "exceptions" JSONB DEFAULT '[]',
    "fundingReference" TEXT NOT NULL DEFAULT '',
    "fundedAt" TIMESTAMP(3),
    "immutableEvidence" JSONB DEFAULT '{}',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "FinanceFundingCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceProduct_rooftop_idx" ON "FinanceProduct"("rooftop");
CREATE UNIQUE INDEX "FinanceProduct_rooftop_code_key" ON "FinanceProduct"("rooftop", "code");
ALTER TABLE "FinanceProduct" ADD CONSTRAINT "FinanceProduct_money_check" CHECK ("retailPriceCents" >= 0 AND "costCents" >= 0);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceMenuVersion_idempotencyKey_key" ON "FinanceMenuVersion"("idempotencyKey");

-- CreateIndex
CREATE INDEX "FinanceMenuVersion_rooftop_idx" ON "FinanceMenuVersion"("rooftop");

-- CreateIndex
CREATE INDEX "FinanceMenuVersion_deal_idx" ON "FinanceMenuVersion"("deal");
CREATE UNIQUE INDEX "FinanceMenuVersion_deal_version_key" ON "FinanceMenuVersion"("deal", "version");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceComplianceCheck_idempotencyKey_key" ON "FinanceComplianceCheck"("idempotencyKey");

-- CreateIndex
CREATE INDEX "FinanceComplianceCheck_rooftop_idx" ON "FinanceComplianceCheck"("rooftop");

-- CreateIndex
CREATE INDEX "FinanceComplianceCheck_deal_idx" ON "FinanceComplianceCheck"("deal");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceContractPackage_idempotencyKey_key" ON "FinanceContractPackage"("idempotencyKey");

-- CreateIndex
CREATE INDEX "FinanceContractPackage_rooftop_idx" ON "FinanceContractPackage"("rooftop");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceContractPackage_deal_key" ON "FinanceContractPackage"("deal");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceFundingCase_idempotencyKey_key" ON "FinanceFundingCase"("idempotencyKey");

-- CreateIndex
CREATE INDEX "FinanceFundingCase_rooftop_idx" ON "FinanceFundingCase"("rooftop");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceFundingCase_deal_key" ON "FinanceFundingCase"("deal");

-- AddForeignKey
ALTER TABLE "FinanceProduct" ADD CONSTRAINT "FinanceProduct_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceMenuVersion" ADD CONSTRAINT "FinanceMenuVersion_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceMenuVersion" ADD CONSTRAINT "FinanceMenuVersion_deal_fkey" FOREIGN KEY ("deal") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceComplianceCheck" ADD CONSTRAINT "FinanceComplianceCheck_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceComplianceCheck" ADD CONSTRAINT "FinanceComplianceCheck_deal_fkey" FOREIGN KEY ("deal") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceContractPackage" ADD CONSTRAINT "FinanceContractPackage_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceContractPackage" ADD CONSTRAINT "FinanceContractPackage_deal_fkey" FOREIGN KEY ("deal") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceFundingCase" ADD CONSTRAINT "FinanceFundingCase_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceFundingCase" ADD CONSTRAINT "FinanceFundingCase_deal_fkey" FOREIGN KEY ("deal") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
