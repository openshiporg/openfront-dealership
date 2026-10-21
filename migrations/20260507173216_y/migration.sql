/*
  Warnings:

  - You are about to drop the column `canCreateTodos` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `canManageAllTodos` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the `Todo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TodoImage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_Todo_todoImages` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[employeeId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Todo" DROP CONSTRAINT "Todo_assignedTo_fkey";

-- DropForeignKey
ALTER TABLE "_Todo_todoImages" DROP CONSTRAINT "_Todo_todoImages_A_fkey";

-- DropForeignKey
ALTER TABLE "_Todo_todoImages" DROP CONSTRAINT "_Todo_todoImages_B_fkey";

-- AlterTable
ALTER TABLE "Role" DROP COLUMN "canCreateTodos",
DROP COLUMN "canManageAllTodos",
ADD COLUMN     "canApproveDeals" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageDeals" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageFinancing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageInventory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageLeads" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageService" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageTradeIns" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canViewAllLeads" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canViewInventory" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canViewReports" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "commissionRate" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "employeeId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "isFinanceManager" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSalesperson" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isServiceAdvisor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone" TEXT NOT NULL DEFAULT '';

-- DropTable
DROP TABLE "Todo";

-- DropTable
DROP TABLE "TodoImage";

-- DropTable
DROP TABLE "_Todo_todoImages";

-- CreateTable
CREATE TABLE "Make" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "logo_id" TEXT,
    "logo_filesize" INTEGER,
    "logo_width" INTEGER,
    "logo_height" INTEGER,
    "logo_extension" TEXT,

    CONSTRAINT "Make_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Model" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "make" TEXT,
    "bodyStyle" TEXT,
    "baseYear" INTEGER,

    CONSTRAINT "Model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "vin" TEXT NOT NULL DEFAULT '',
    "stockNumber" TEXT NOT NULL DEFAULT '',
    "year" INTEGER NOT NULL,
    "make" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "trim" TEXT NOT NULL DEFAULT '',
    "exteriorColor" TEXT NOT NULL DEFAULT '',
    "interiorColor" TEXT NOT NULL DEFAULT '',
    "mileage" INTEGER,
    "purchasePrice" DOUBLE PRECISION,
    "listPrice" DOUBLE PRECISION,
    "price" DOUBLE PRECISION,
    "condition" TEXT,
    "status" TEXT DEFAULT 'available',
    "description" TEXT NOT NULL DEFAULT '',
    "features" JSONB DEFAULT '[]',
    "metadata" JSONB DEFAULT '{}',
    "history" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleImage" (
    "id" TEXT NOT NULL,
    "vehicle" TEXT,
    "image_id" TEXT,
    "image_filesize" INTEGER,
    "image_width" INTEGER,
    "image_height" INTEGER,
    "image_extension" TEXT,
    "caption" TEXT NOT NULL DEFAULT '',
    "category" TEXT DEFAULT 'exterior',
    "sortOrder" INTEGER DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "VehicleImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleConditionReport" (
    "id" TEXT NOT NULL,
    "vehicle" TEXT,
    "reportDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspector" TEXT NOT NULL DEFAULT '',
    "overallCondition" TEXT,
    "mechanicalRating" TEXT,
    "bodyRating" TEXT,
    "interiorRating" TEXT,
    "issues" JSONB DEFAULT '[]',
    "estimatedRepairs" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "VehicleConditionReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleHistory" (
    "id" TEXT NOT NULL,
    "acquisitionDate" TIMESTAMP(3),
    "acquisitionSource" TEXT NOT NULL DEFAULT '',
    "previousOwners" INTEGER,
    "hasAccidents" BOOLEAN NOT NULL DEFAULT false,
    "accidentDetails" TEXT NOT NULL DEFAULT '',
    "serviceRecords" TEXT NOT NULL DEFAULT '',
    "titleStatus" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "VehicleHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "vehicle" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousPrice" DOUBLE PRECISION,
    "newPrice" DOUBLE PRECISION NOT NULL,
    "changeReason" TEXT NOT NULL DEFAULT '',
    "changedBy" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "source" TEXT,
    "interestedVehicle" TEXT,
    "budgetRange" TEXT,
    "tradeInVehicle" TEXT NOT NULL DEFAULT '',
    "timeframe" TEXT,
    "status" TEXT DEFAULT 'new',
    "assignedSalesperson" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "lastContact" TIMESTAMP(3),

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerInteraction" (
    "id" TEXT NOT NULL,
    "lead" TEXT,
    "interactionType" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "outcome" TEXT,
    "followUpDate" TIMESTAMP(3),
    "followUpCompleted" TIMESTAMP(3),
    "performedBy" TEXT,

    CONSTRAINT "CustomerInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "assignedTo" TEXT,
    "lead" TEXT,
    "priority" TEXT DEFAULT 'medium',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestDrive" (
    "id" TEXT NOT NULL,
    "lead" TEXT,
    "vehicle" TEXT,
    "salesperson" TEXT,
    "scheduledTime" TIMESTAMP(3) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "driverLicenseVerified" BOOLEAN NOT NULL DEFAULT false,
    "feedback" TEXT NOT NULL DEFAULT '',
    "interestedLevel" TEXT,

    CONSTRAINT "TestDrive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "lead" TEXT,
    "vehicle" TEXT,
    "salesperson" TEXT,
    "vehiclePrice" DOUBLE PRECISION,
    "tradeInValue" DOUBLE PRECISION,
    "tradeInVehicle" TEXT,
    "tradeInDetails" JSONB DEFAULT '{}',
    "downPayment" DOUBLE PRECISION,
    "financingAmount" DOUBLE PRECISION,
    "monthlyPayment" DOUBLE PRECISION,
    "loanTerm" INTEGER,
    "apr" DOUBLE PRECISION,
    "status" TEXT DEFAULT 'pencil',
    "taxAmount" DOUBLE PRECISION,
    "fees" JSONB DEFAULT '[]',
    "saleDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealApproval" (
    "id" TEXT NOT NULL,
    "deal" TEXT,
    "approver" TEXT,
    "decision" TEXT DEFAULT 'pending',
    "notes" TEXT NOT NULL DEFAULT '',
    "approvalDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeIn" (
    "id" TEXT NOT NULL,
    "vin" TEXT NOT NULL DEFAULT '',
    "year" TEXT NOT NULL DEFAULT '',
    "make" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "trim" TEXT NOT NULL DEFAULT '',
    "mileage" INTEGER,
    "condition" TEXT,
    "exteriorCondition" TEXT NOT NULL DEFAULT '',
    "interiorCondition" TEXT NOT NULL DEFAULT '',
    "mechanicalIssues" TEXT NOT NULL DEFAULT '',
    "kbbValue" DOUBLE PRECISION,
    "offerAmount" DOUBLE PRECISION,
    "mainPhoto_id" TEXT,
    "mainPhoto_filesize" INTEGER,
    "mainPhoto_width" INTEGER,
    "mainPhoto_height" INTEGER,
    "mainPhoto_extension" TEXT,
    "appraisedBy" TEXT,

    CONSTRAINT "TradeIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAppointment" (
    "id" TEXT NOT NULL,
    "customer" TEXT,
    "customerVehicleDescription" TEXT NOT NULL DEFAULT '',
    "appointmentDate" TIMESTAMP(3) NOT NULL,
    "serviceType" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "estimatedDuration" INTEGER,
    "assignedTech" TEXT,
    "status" TEXT DEFAULT 'scheduled',
    "mileageIn" INTEGER,
    "advisorNotes" TEXT NOT NULL DEFAULT '',
    "serviceOrder" TEXT,

    CONSTRAINT "ServiceAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOrder" (
    "id" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL DEFAULT '',
    "workPerformed" TEXT NOT NULL DEFAULT '',
    "recommendations" TEXT NOT NULL DEFAULT '',
    "laborTotal" DOUBLE PRECISION,
    "partsTotal" DOUBLE PRECISION,
    "tax" DOUBLE PRECISION,
    "grandTotal" DOUBLE PRECISION,
    "status" TEXT DEFAULT 'estimate',
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ServiceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairOrderLineItem" (
    "id" TEXT NOT NULL,
    "serviceOrder" TEXT,
    "itemType" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "partNumber" TEXT NOT NULL DEFAULT '',
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION,

    CONSTRAINT "RepairOrderLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePackage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "price" DOUBLE PRECISION NOT NULL,
    "estimatedDuration" INTEGER,
    "includedServices" JSONB DEFAULT '[]',

    CONSTRAINT "ServicePackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartsInventory" (
    "id" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minimumQuantity" INTEGER,
    "cost" DOUBLE PRECISION,
    "price" DOUBLE PRECISION NOT NULL,
    "supplier" TEXT NOT NULL DEFAULT '',
    "supplierPartNumber" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PartsInventory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Make_name_key" ON "Make"("name");

-- CreateIndex
CREATE INDEX "Model_make_idx" ON "Model"("make");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vin_key" ON "Vehicle"("vin");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_stockNumber_key" ON "Vehicle"("stockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_history_key" ON "Vehicle"("history");

-- CreateIndex
CREATE INDEX "VehicleImage_vehicle_idx" ON "VehicleImage"("vehicle");

-- CreateIndex
CREATE INDEX "VehicleConditionReport_vehicle_idx" ON "VehicleConditionReport"("vehicle");

-- CreateIndex
CREATE INDEX "PriceHistory_vehicle_idx" ON "PriceHistory"("vehicle");

-- CreateIndex
CREATE INDEX "PriceHistory_changedBy_idx" ON "PriceHistory"("changedBy");

-- CreateIndex
CREATE INDEX "Lead_interestedVehicle_idx" ON "Lead"("interestedVehicle");

-- CreateIndex
CREATE INDEX "Lead_assignedSalesperson_idx" ON "Lead"("assignedSalesperson");

-- CreateIndex
CREATE INDEX "CustomerInteraction_lead_idx" ON "CustomerInteraction"("lead");

-- CreateIndex
CREATE INDEX "CustomerInteraction_performedBy_idx" ON "CustomerInteraction"("performedBy");

-- CreateIndex
CREATE INDEX "Task_assignedTo_idx" ON "Task"("assignedTo");

-- CreateIndex
CREATE INDEX "Task_lead_idx" ON "Task"("lead");

-- CreateIndex
CREATE INDEX "TestDrive_lead_idx" ON "TestDrive"("lead");

-- CreateIndex
CREATE INDEX "TestDrive_vehicle_idx" ON "TestDrive"("vehicle");

-- CreateIndex
CREATE INDEX "TestDrive_salesperson_idx" ON "TestDrive"("salesperson");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_tradeInVehicle_key" ON "Deal"("tradeInVehicle");

-- CreateIndex
CREATE INDEX "Deal_lead_idx" ON "Deal"("lead");

-- CreateIndex
CREATE INDEX "Deal_vehicle_idx" ON "Deal"("vehicle");

-- CreateIndex
CREATE INDEX "Deal_salesperson_idx" ON "Deal"("salesperson");

-- CreateIndex
CREATE INDEX "DealApproval_deal_idx" ON "DealApproval"("deal");

-- CreateIndex
CREATE INDEX "DealApproval_approver_idx" ON "DealApproval"("approver");

-- CreateIndex
CREATE INDEX "TradeIn_appraisedBy_idx" ON "TradeIn"("appraisedBy");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAppointment_serviceOrder_key" ON "ServiceAppointment"("serviceOrder");

-- CreateIndex
CREATE INDEX "ServiceAppointment_customer_idx" ON "ServiceAppointment"("customer");

-- CreateIndex
CREATE INDEX "ServiceAppointment_assignedTech_idx" ON "ServiceAppointment"("assignedTech");

-- CreateIndex
CREATE INDEX "RepairOrderLineItem_serviceOrder_idx" ON "RepairOrderLineItem"("serviceOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PartsInventory_partNumber_key" ON "PartsInventory"("partNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- AddForeignKey
ALTER TABLE "Model" ADD CONSTRAINT "Model_make_fkey" FOREIGN KEY ("make") REFERENCES "Make"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_history_fkey" FOREIGN KEY ("history") REFERENCES "VehicleHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleImage" ADD CONSTRAINT "VehicleImage_vehicle_fkey" FOREIGN KEY ("vehicle") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleConditionReport" ADD CONSTRAINT "VehicleConditionReport_vehicle_fkey" FOREIGN KEY ("vehicle") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_vehicle_fkey" FOREIGN KEY ("vehicle") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_interestedVehicle_fkey" FOREIGN KEY ("interestedVehicle") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedSalesperson_fkey" FOREIGN KEY ("assignedSalesperson") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInteraction" ADD CONSTRAINT "CustomerInteraction_lead_fkey" FOREIGN KEY ("lead") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInteraction" ADD CONSTRAINT "CustomerInteraction_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_lead_fkey" FOREIGN KEY ("lead") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestDrive" ADD CONSTRAINT "TestDrive_lead_fkey" FOREIGN KEY ("lead") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestDrive" ADD CONSTRAINT "TestDrive_vehicle_fkey" FOREIGN KEY ("vehicle") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestDrive" ADD CONSTRAINT "TestDrive_salesperson_fkey" FOREIGN KEY ("salesperson") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_lead_fkey" FOREIGN KEY ("lead") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_vehicle_fkey" FOREIGN KEY ("vehicle") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_salesperson_fkey" FOREIGN KEY ("salesperson") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_tradeInVehicle_fkey" FOREIGN KEY ("tradeInVehicle") REFERENCES "TradeIn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealApproval" ADD CONSTRAINT "DealApproval_deal_fkey" FOREIGN KEY ("deal") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealApproval" ADD CONSTRAINT "DealApproval_approver_fkey" FOREIGN KEY ("approver") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeIn" ADD CONSTRAINT "TradeIn_appraisedBy_fkey" FOREIGN KEY ("appraisedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAppointment" ADD CONSTRAINT "ServiceAppointment_customer_fkey" FOREIGN KEY ("customer") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAppointment" ADD CONSTRAINT "ServiceAppointment_assignedTech_fkey" FOREIGN KEY ("assignedTech") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAppointment" ADD CONSTRAINT "ServiceAppointment_serviceOrder_fkey" FOREIGN KEY ("serviceOrder") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairOrderLineItem" ADD CONSTRAINT "RepairOrderLineItem_serviceOrder_fkey" FOREIGN KEY ("serviceOrder") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
