/*
  Warnings:

  - A unique constraint covering the columns `[stock]` on the table `InventoryAcquisition` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "InventoryAcquisition" ADD COLUMN     "stock" TEXT;

-- CreateTable
CREATE TABLE "InventoryStock" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "vehicle" TEXT NOT NULL,
    "stockNumber" TEXT NOT NULL DEFAULT '',
    "stockKey" TEXT NOT NULL DEFAULT '',
    "locationCode" TEXT NOT NULL DEFAULT '',
    "locationLabel" TEXT NOT NULL DEFAULT '',
    "stockedAt" TIMESTAMP(3) NOT NULL,
    "frontlineAt" TIMESTAMP(3),
    "purchaseCostCents" INTEGER,
    "reconCostCents" INTEGER DEFAULT 0,
    "otherCostCents" INTEGER DEFAULT 0,
    "totalCostCents" INTEGER DEFAULT 0,
    "reconStatus" TEXT DEFAULT 'not-started',
    "merchandisingStatus" TEXT DEFAULT 'draft',
    "feedStatus" TEXT DEFAULT 'not-published',

    CONSTRAINT "InventoryStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStockEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "stock" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "eventType" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "amountCents" INTEGER,
    "evidence" JSONB DEFAULT '{}',
    "actor" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryStockEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReconWorkItem" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "stock" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "status" TEXT DEFAULT 'open',
    "estimatedCostCents" INTEGER,
    "actualCostCents" INTEGER,
    "vendorName" TEXT NOT NULL DEFAULT '',
    "assignedTo" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryReconWorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMerchandisingVersion" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "stock" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "versionKey" TEXT NOT NULL DEFAULT '',
    "status" TEXT DEFAULT 'submitted',
    "snapshot" JSONB DEFAULT '{}',
    "submittedBy" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "InventoryMerchandisingVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryFeedRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "runKey" TEXT NOT NULL DEFAULT '',
    "channelKey" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "attemptedCount" INTEGER NOT NULL,
    "succeededCount" INTEGER NOT NULL,
    "failedCount" INTEGER NOT NULL,
    "requestSnapshot" JSONB DEFAULT '{}',
    "responseSummary" JSONB DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT,

    CONSTRAINT "InventoryFeedRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryFeedError" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "run" TEXT NOT NULL,
    "stock" TEXT,
    "errorCode" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "rowReference" TEXT NOT NULL DEFAULT '',
    "evidence" JSONB DEFAULT '{}',

    CONSTRAINT "InventoryFeedError_pkey" PRIMARY KEY ("id")
);

-- Backfill a canonical stock aggregate for every retained vehicle before indexes/FKs.
UPDATE "Vehicle"
SET "stockNumber" = 'UNASSIGNED-' || UPPER(SUBSTRING("id" FROM 1 FOR 12))
WHERE BTRIM(COALESCE("stockNumber", '')) = '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Vehicle"
    GROUP BY "rooftop", UPPER(BTRIM("stockNumber"))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate stock numbers exist within a rooftop; resolve them before applying Gate 8';
  END IF;
END $$;

INSERT INTO "InventoryStock" (
  "id", "createdAt", "updatedAt", "rooftop", "vehicle", "stockNumber", "stockKey",
  "locationCode", "locationLabel", "stockedAt", "frontlineAt", "purchaseCostCents",
  "reconCostCents", "otherCostCents", "totalCostCents", "reconStatus", "merchandisingStatus", "feedStatus"
)
SELECT
  'stock-' || MD5(v."id"), v."createdAt", v."updatedAt", v."rooftop", v."id",
  UPPER(BTRIM(v."stockNumber")), v."rooftop" || ':' || UPPER(BTRIM(v."stockNumber")),
  'MAIN', 'Main lot', v."createdAt", CASE WHEN v."status" = 'available' THEN v."createdAt" ELSE NULL END,
  COALESCE(v."purchasePriceCents", 0), 0, 0, COALESCE(v."purchasePriceCents", 0),
  'not-started', 'draft', 'not-published'
FROM "Vehicle" v;

UPDATE "InventoryAcquisition" acquisition
SET "stock" = stock."id"
FROM "InventoryStock" stock
WHERE acquisition."vehicle" = stock."vehicle" AND acquisition."stock" IS NULL;

INSERT INTO "InventoryStockEvent" (
  "id", "createdAt", "updatedAt", "rooftop", "stock", "eventKey", "eventType", "reason", "evidence", "occurredAt"
)
SELECT
  'stock-event-' || MD5(stock."id"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, stock."rooftop", stock."id",
  'inventory-stock-baseline:' || stock."id", 'established', 'Retained-data Gate 8 stock baseline',
  jsonb_build_object('vehicleId', stock."vehicle", 'stockNumber', stock."stockNumber", 'locationCode', stock."locationCode"),
  CURRENT_TIMESTAMP
FROM "InventoryStock" stock;

-- CreateIndex
CREATE UNIQUE INDEX "InventoryStock_vehicle_key" ON "InventoryStock"("vehicle");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryStock_stockKey_key" ON "InventoryStock"("stockKey");

-- CreateIndex
CREATE INDEX "InventoryStock_rooftop_idx" ON "InventoryStock"("rooftop");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryStockEvent_eventKey_key" ON "InventoryStockEvent"("eventKey");

-- CreateIndex
CREATE INDEX "InventoryStockEvent_rooftop_idx" ON "InventoryStockEvent"("rooftop");

-- CreateIndex
CREATE INDEX "InventoryStockEvent_stock_idx" ON "InventoryStockEvent"("stock");

-- CreateIndex
CREATE INDEX "InventoryStockEvent_eventType_idx" ON "InventoryStockEvent"("eventType");

-- CreateIndex
CREATE INDEX "InventoryStockEvent_actor_idx" ON "InventoryStockEvent"("actor");

-- CreateIndex
CREATE INDEX "InventoryStockEvent_occurredAt_idx" ON "InventoryStockEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "InventoryReconWorkItem_rooftop_idx" ON "InventoryReconWorkItem"("rooftop");

-- CreateIndex
CREATE INDEX "InventoryReconWorkItem_stock_idx" ON "InventoryReconWorkItem"("stock");

-- CreateIndex
CREATE INDEX "InventoryReconWorkItem_assignedTo_idx" ON "InventoryReconWorkItem"("assignedTo");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMerchandisingVersion_versionKey_key" ON "InventoryMerchandisingVersion"("versionKey");

-- CreateIndex
CREATE INDEX "InventoryMerchandisingVersion_rooftop_idx" ON "InventoryMerchandisingVersion"("rooftop");

-- CreateIndex
CREATE INDEX "InventoryMerchandisingVersion_stock_idx" ON "InventoryMerchandisingVersion"("stock");

-- CreateIndex
CREATE INDEX "InventoryMerchandisingVersion_submittedBy_idx" ON "InventoryMerchandisingVersion"("submittedBy");

-- CreateIndex
CREATE INDEX "InventoryMerchandisingVersion_decidedBy_idx" ON "InventoryMerchandisingVersion"("decidedBy");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryFeedRun_runKey_key" ON "InventoryFeedRun"("runKey");

-- CreateIndex
CREATE INDEX "InventoryFeedRun_rooftop_idx" ON "InventoryFeedRun"("rooftop");

-- CreateIndex
CREATE INDEX "InventoryFeedRun_channelKey_idx" ON "InventoryFeedRun"("channelKey");

-- CreateIndex
CREATE INDEX "InventoryFeedRun_recordedBy_idx" ON "InventoryFeedRun"("recordedBy");

-- CreateIndex
CREATE INDEX "InventoryFeedError_rooftop_idx" ON "InventoryFeedError"("rooftop");

-- CreateIndex
CREATE INDEX "InventoryFeedError_run_idx" ON "InventoryFeedError"("run");

-- CreateIndex
CREATE INDEX "InventoryFeedError_stock_idx" ON "InventoryFeedError"("stock");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAcquisition_stock_key" ON "InventoryAcquisition"("stock");

-- AddForeignKey
ALTER TABLE "InventoryAcquisition" ADD CONSTRAINT "InventoryAcquisition_stock_fkey" FOREIGN KEY ("stock") REFERENCES "InventoryStock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_vehicle_fkey" FOREIGN KEY ("vehicle") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStockEvent" ADD CONSTRAINT "InventoryStockEvent_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStockEvent" ADD CONSTRAINT "InventoryStockEvent_stock_fkey" FOREIGN KEY ("stock") REFERENCES "InventoryStock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStockEvent" ADD CONSTRAINT "InventoryStockEvent_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReconWorkItem" ADD CONSTRAINT "InventoryReconWorkItem_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReconWorkItem" ADD CONSTRAINT "InventoryReconWorkItem_stock_fkey" FOREIGN KEY ("stock") REFERENCES "InventoryStock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReconWorkItem" ADD CONSTRAINT "InventoryReconWorkItem_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMerchandisingVersion" ADD CONSTRAINT "InventoryMerchandisingVersion_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMerchandisingVersion" ADD CONSTRAINT "InventoryMerchandisingVersion_stock_fkey" FOREIGN KEY ("stock") REFERENCES "InventoryStock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMerchandisingVersion" ADD CONSTRAINT "InventoryMerchandisingVersion_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMerchandisingVersion" ADD CONSTRAINT "InventoryMerchandisingVersion_decidedBy_fkey" FOREIGN KEY ("decidedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryFeedRun" ADD CONSTRAINT "InventoryFeedRun_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryFeedRun" ADD CONSTRAINT "InventoryFeedRun_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryFeedError" ADD CONSTRAINT "InventoryFeedError_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryFeedError" ADD CONSTRAINT "InventoryFeedError_run_fkey" FOREIGN KEY ("run") REFERENCES "InventoryFeedRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryFeedError" ADD CONSTRAINT "InventoryFeedError_stock_fkey" FOREIGN KEY ("stock") REFERENCES "InventoryStock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
