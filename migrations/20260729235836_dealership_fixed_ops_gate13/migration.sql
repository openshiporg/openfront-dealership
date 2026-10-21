-- AlterTable
ALTER TABLE "PartsInventory" ADD COLUMN     "binLocation" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "committedQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "onOrderQuantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ServiceAppointment" ADD COLUMN     "capacitySlot" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "transportationNeed" TEXT DEFAULT 'none',
ADD COLUMN     "vehicleVin" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "ServiceOrder" ADD COLUMN     "authorizationEvidence" JSONB DEFAULT '{}',
ADD COLUMN     "authorizationStatus" TEXT DEFAULT 'pending',
ADD COLUMN     "cause" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "concern" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "correction" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "declinedWork" JSONB DEFAULT '[]',
ADD COLUMN     "inspectionEvidence" JSONB DEFAULT '[]',
ADD COLUMN     "invoiceNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "payType" TEXT DEFAULT 'customer';

-- CreateTable
CREATE TABLE "ServiceLaborOperation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "serviceOrder" TEXT NOT NULL,
    "operationCode" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "technician" TEXT,
    "soldHours" DOUBLE PRECISION,
    "actualMinutes" INTEGER,
    "timePunches" JSONB DEFAULT '[]',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ServiceLaborOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartsMovement" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "part" TEXT NOT NULL,
    "serviceOrder" TEXT,
    "movementType" TEXT NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "onHandAfter" INTEGER,
    "committedAfter" INTEGER,
    "onOrderAfter" INTEGER,
    "reference" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "evidence" JSONB DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PartsMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartsPurchaseOrder" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "supplier" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "lines" JSONB DEFAULT '[]',
    "orderedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PartsPurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceLaborOperation_idempotencyKey_key" ON "ServiceLaborOperation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ServiceLaborOperation_rooftop_idx" ON "ServiceLaborOperation"("rooftop");

-- CreateIndex
CREATE INDEX "ServiceLaborOperation_serviceOrder_idx" ON "ServiceLaborOperation"("serviceOrder");

-- CreateIndex
CREATE INDEX "ServiceLaborOperation_technician_idx" ON "ServiceLaborOperation"("technician");

-- CreateIndex
CREATE UNIQUE INDEX "PartsMovement_idempotencyKey_key" ON "PartsMovement"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PartsMovement_rooftop_idx" ON "PartsMovement"("rooftop");

-- CreateIndex
CREATE INDEX "PartsMovement_part_idx" ON "PartsMovement"("part");

-- CreateIndex
CREATE INDEX "PartsMovement_serviceOrder_idx" ON "PartsMovement"("serviceOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PartsPurchaseOrder_idempotencyKey_key" ON "PartsPurchaseOrder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PartsPurchaseOrder_rooftop_idx" ON "PartsPurchaseOrder"("rooftop");
CREATE UNIQUE INDEX "PartsPurchaseOrder_rooftop_reference_key" ON "PartsPurchaseOrder"("rooftop", "reference");
DROP INDEX "PartsInventory_partNumber_key";
CREATE UNIQUE INDEX "PartsInventory_rooftop_partNumber_key" ON "PartsInventory"("rooftop", "partNumber");
ALTER TABLE "PartsInventory" ADD CONSTRAINT "PartsInventory_quantity_check" CHECK ("quantity" >= 0 AND "committedQuantity" >= 0 AND "onOrderQuantity" >= 0 AND "committedQuantity" <= "quantity");
ALTER TABLE "ServiceLaborOperation" ADD CONSTRAINT "ServiceLaborOperation_time_check" CHECK (("soldHours" IS NULL OR "soldHours" >= 0) AND ("actualMinutes" IS NULL OR "actualMinutes" >= 0));

-- AddForeignKey
ALTER TABLE "ServiceLaborOperation" ADD CONSTRAINT "ServiceLaborOperation_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLaborOperation" ADD CONSTRAINT "ServiceLaborOperation_serviceOrder_fkey" FOREIGN KEY ("serviceOrder") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLaborOperation" ADD CONSTRAINT "ServiceLaborOperation_technician_fkey" FOREIGN KEY ("technician") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartsMovement" ADD CONSTRAINT "PartsMovement_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartsMovement" ADD CONSTRAINT "PartsMovement_part_fkey" FOREIGN KEY ("part") REFERENCES "PartsInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartsMovement" ADD CONSTRAINT "PartsMovement_serviceOrder_fkey" FOREIGN KEY ("serviceOrder") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartsPurchaseOrder" ADD CONSTRAINT "PartsPurchaseOrder_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
