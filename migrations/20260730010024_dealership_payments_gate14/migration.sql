-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "deal" TEXT,
    "serviceOrder" TEXT,
    "sourceType" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "providerKey" TEXT NOT NULL DEFAULT '',
    "providerTransactionId" TEXT NOT NULL DEFAULT '',
    "providerSessionId" TEXT NOT NULL DEFAULT '',
    "checkoutUrl" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "capturedCents" INTEGER NOT NULL DEFAULT 0,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "failureCode" TEXT NOT NULL DEFAULT '',
    "reconciliationReference" TEXT NOT NULL DEFAULT '',
    "reconciledAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRefund" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "transaction" TEXT,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "providerRefundId" TEXT NOT NULL DEFAULT '',
    "failureCode" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProviderEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "transaction" TEXT,
    "refund" TEXT,
    "providerKey" TEXT NOT NULL DEFAULT '',
    "providerEventId" TEXT NOT NULL DEFAULT '',
    "eventType" TEXT NOT NULL DEFAULT '',
    "payloadDigest" TEXT NOT NULL DEFAULT '',
    "signatureTimestamp" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentProviderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_providerTransactionId_key" ON "PaymentTransaction"("providerTransactionId") WHERE "providerTransactionId" <> '';

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_providerSessionId_key" ON "PaymentTransaction"("providerSessionId") WHERE "providerSessionId" <> '';

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_idempotencyKey_key" ON "PaymentTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentTransaction_rooftop_idx" ON "PaymentTransaction"("rooftop");

-- CreateIndex
CREATE INDEX "PaymentTransaction_deal_idx" ON "PaymentTransaction"("deal");

-- CreateIndex
CREATE INDEX "PaymentTransaction_serviceOrder_idx" ON "PaymentTransaction"("serviceOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRefund_providerRefundId_key" ON "PaymentRefund"("providerRefundId") WHERE "providerRefundId" <> '';

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRefund_idempotencyKey_key" ON "PaymentRefund"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentRefund_rooftop_idx" ON "PaymentRefund"("rooftop");

-- CreateIndex
CREATE INDEX "PaymentRefund_transaction_idx" ON "PaymentRefund"("transaction");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProviderEvent_providerEventId_key" ON "PaymentProviderEvent"("providerEventId");

-- CreateIndex
CREATE INDEX "PaymentProviderEvent_rooftop_idx" ON "PaymentProviderEvent"("rooftop");

-- CreateIndex
CREATE INDEX "PaymentProviderEvent_transaction_idx" ON "PaymentProviderEvent"("transaction");

-- CreateIndex
CREATE INDEX "PaymentProviderEvent_refund_idx" ON "PaymentProviderEvent"("refund");

ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_source_check" CHECK (("sourceType" = 'deal' AND "deal" IS NOT NULL AND "serviceOrder" IS NULL) OR ("sourceType" = 'service' AND "serviceOrder" IS NOT NULL AND "deal" IS NULL));
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_amounts_check" CHECK ("amountCents" > 0 AND "capturedCents" >= 0 AND "refundedCents" >= 0 AND "refundedCents" <= "capturedCents" AND "capturedCents" <= "amountCents" AND "version" > 0);
ALTER TABLE "PaymentRefund" ALTER COLUMN "transaction" SET NOT NULL;
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_amount_check" CHECK ("amountCents" > 0);
ALTER TABLE "PaymentProviderEvent" ALTER COLUMN "transaction" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_deal_fkey" FOREIGN KEY ("deal") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_serviceOrder_fkey" FOREIGN KEY ("serviceOrder") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_transaction_fkey" FOREIGN KEY ("transaction") REFERENCES "PaymentTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProviderEvent" ADD CONSTRAINT "PaymentProviderEvent_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProviderEvent" ADD CONSTRAINT "PaymentProviderEvent_transaction_fkey" FOREIGN KEY ("transaction") REFERENCES "PaymentTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProviderEvent" ADD CONSTRAINT "PaymentProviderEvent_refund_fkey" FOREIGN KEY ("refund") REFERENCES "PaymentRefund"("id") ON DELETE SET NULL ON UPDATE CASCADE;
