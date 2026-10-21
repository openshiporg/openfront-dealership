-- CreateTable
CREATE TABLE "DeliveryCase" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "deal" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "appointmentAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "checklist" JSONB DEFAULT '[]',
    "customerAcknowledgment" TEXT NOT NULL DEFAULT '',
    "acknowledgedAt" TIMESTAMP(3),
    "deliverySnapshot" JSONB DEFAULT '{}',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "DeliveryCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeOweItem" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "deliveryCase" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "promisedAt" TIMESTAMP(3) NOT NULL,
    "owner" TEXT NOT NULL,
    "estimatedCostCents" INTEGER,
    "fulfillmentEvidence" TEXT NOT NULL DEFAULT '',
    "customerAcknowledgment" TEXT NOT NULL DEFAULT '',
    "fulfilledAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "WeOweItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryCase_idempotencyKey_key" ON "DeliveryCase"("idempotencyKey");

-- CreateIndex
CREATE INDEX "DeliveryCase_rooftop_idx" ON "DeliveryCase"("rooftop");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryCase_deal_key" ON "DeliveryCase"("deal");

-- CreateIndex
CREATE UNIQUE INDEX "WeOweItem_idempotencyKey_key" ON "WeOweItem"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WeOweItem_rooftop_idx" ON "WeOweItem"("rooftop");

-- CreateIndex
CREATE INDEX "WeOweItem_deliveryCase_idx" ON "WeOweItem"("deliveryCase");

-- CreateIndex
CREATE INDEX "WeOweItem_owner_idx" ON "WeOweItem"("owner");
ALTER TABLE "WeOweItem" ADD CONSTRAINT "WeOweItem_cost_check" CHECK ("estimatedCostCents" IS NULL OR "estimatedCostCents" >= 0);

-- AddForeignKey
ALTER TABLE "DeliveryCase" ADD CONSTRAINT "DeliveryCase_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryCase" ADD CONSTRAINT "DeliveryCase_deal_fkey" FOREIGN KEY ("deal") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeOweItem" ADD CONSTRAINT "WeOweItem_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeOweItem" ADD CONSTRAINT "WeOweItem_deliveryCase_fkey" FOREIGN KEY ("deliveryCase") REFERENCES "DeliveryCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeOweItem" ADD CONSTRAINT "WeOweItem_owner_fkey" FOREIGN KEY ("owner") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
