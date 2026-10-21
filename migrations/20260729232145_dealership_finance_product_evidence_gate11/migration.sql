-- CreateTable
CREATE TABLE "FinanceProductQuote" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "deal" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "retailPriceCents" INTEGER,
    "costCents" INTEGER,
    "evidenceReference" TEXT NOT NULL DEFAULT '',
    "requestSnapshot" JSONB DEFAULT '{}',
    "resultSnapshot" JSONB DEFAULT '{}',
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "FinanceProductQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceProductCancellation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "deal" TEXT NOT NULL,
    "menu" TEXT NOT NULL,
    "productCode" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "refundCents" INTEGER,
    "evidence" JSONB DEFAULT '{}',
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "FinanceProductCancellation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceProductQuote_idempotencyKey_key" ON "FinanceProductQuote"("idempotencyKey");

-- CreateIndex
CREATE INDEX "FinanceProductQuote_rooftop_idx" ON "FinanceProductQuote"("rooftop");

-- CreateIndex
CREATE INDEX "FinanceProductQuote_deal_idx" ON "FinanceProductQuote"("deal");

-- CreateIndex
CREATE INDEX "FinanceProductQuote_product_idx" ON "FinanceProductQuote"("product");
ALTER TABLE "FinanceProductQuote" ADD CONSTRAINT "FinanceProductQuote_money_check" CHECK (("retailPriceCents" IS NULL OR "retailPriceCents" >= 0) AND ("costCents" IS NULL OR "costCents" >= 0));

-- CreateIndex
CREATE UNIQUE INDEX "FinanceProductCancellation_idempotencyKey_key" ON "FinanceProductCancellation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "FinanceProductCancellation_rooftop_idx" ON "FinanceProductCancellation"("rooftop");

-- CreateIndex
CREATE INDEX "FinanceProductCancellation_deal_idx" ON "FinanceProductCancellation"("deal");

-- CreateIndex
CREATE INDEX "FinanceProductCancellation_menu_idx" ON "FinanceProductCancellation"("menu");
ALTER TABLE "FinanceProductCancellation" ADD CONSTRAINT "FinanceProductCancellation_refund_check" CHECK ("refundCents" IS NULL OR "refundCents" >= 0);

-- AddForeignKey
ALTER TABLE "FinanceProductQuote" ADD CONSTRAINT "FinanceProductQuote_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceProductQuote" ADD CONSTRAINT "FinanceProductQuote_deal_fkey" FOREIGN KEY ("deal") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceProductQuote" ADD CONSTRAINT "FinanceProductQuote_product_fkey" FOREIGN KEY ("product") REFERENCES "FinanceProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceProductCancellation" ADD CONSTRAINT "FinanceProductCancellation_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceProductCancellation" ADD CONSTRAINT "FinanceProductCancellation_deal_fkey" FOREIGN KEY ("deal") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceProductCancellation" ADD CONSTRAINT "FinanceProductCancellation_menu_fkey" FOREIGN KEY ("menu") REFERENCES "FinanceMenuVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
