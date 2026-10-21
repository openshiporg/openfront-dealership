-- CreateTable
CREATE TABLE "InventoryAcquisition" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'appraised',
    "acquisitionSource" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL DEFAULT '',
    "vin" TEXT NOT NULL DEFAULT '',
    "year" INTEGER NOT NULL,
    "make" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "odometer" INTEGER,
    "appraisalCents" INTEGER NOT NULL,
    "purchaseCents" INTEGER,
    "reconEstimateCents" INTEGER,
    "vehicle" TEXT,
    "immutablePurchaseSnapshot" JSONB,
    "purchasedAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "frontlineAt" TIMESTAMP(3),
    "requestedBy" TEXT,
    "lastTransitionedBy" TEXT,

    CONSTRAINT "InventoryAcquisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAcquisitionEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "acquisition" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL DEFAULT '',
    "toStatus" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "evidence" JSONB DEFAULT '{}',
    "actor" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryAcquisitionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAcquisition_reference_key" ON "InventoryAcquisition"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAcquisition_idempotencyKey_key" ON "InventoryAcquisition"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAcquisition_vehicle_key" ON "InventoryAcquisition"("vehicle");

-- CreateIndex
CREATE INDEX "InventoryAcquisition_rooftop_idx" ON "InventoryAcquisition"("rooftop");

-- CreateIndex
CREATE INDEX "InventoryAcquisition_requestedBy_idx" ON "InventoryAcquisition"("requestedBy");

-- CreateIndex
CREATE INDEX "InventoryAcquisition_lastTransitionedBy_idx" ON "InventoryAcquisition"("lastTransitionedBy");

-- CreateIndex
CREATE INDEX "InventoryAcquisitionEvent_rooftop_idx" ON "InventoryAcquisitionEvent"("rooftop");

-- CreateIndex
CREATE INDEX "InventoryAcquisitionEvent_acquisition_idx" ON "InventoryAcquisitionEvent"("acquisition");

-- CreateIndex
CREATE INDEX "InventoryAcquisitionEvent_actor_idx" ON "InventoryAcquisitionEvent"("actor");

-- AddForeignKey
ALTER TABLE "InventoryAcquisition" ADD CONSTRAINT "InventoryAcquisition_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAcquisition" ADD CONSTRAINT "InventoryAcquisition_vehicle_fkey" FOREIGN KEY ("vehicle") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAcquisition" ADD CONSTRAINT "InventoryAcquisition_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAcquisition" ADD CONSTRAINT "InventoryAcquisition_lastTransitionedBy_fkey" FOREIGN KEY ("lastTransitionedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAcquisitionEvent" ADD CONSTRAINT "InventoryAcquisitionEvent_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAcquisitionEvent" ADD CONSTRAINT "InventoryAcquisitionEvent_acquisition_fkey" FOREIGN KEY ("acquisition") REFERENCES "InventoryAcquisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAcquisitionEvent" ADD CONSTRAINT "InventoryAcquisitionEvent_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
