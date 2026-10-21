-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "contactPreferenceUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "emailSuppressed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "household" TEXT,
ADD COLUMN     "phoneSuppressed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preferredChannel" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "smsSuppressed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suppressionReason" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "suppressionSource" TEXT NOT NULL DEFAULT '',
ADD CONSTRAINT "Customer_preferredChannel_check" CHECK ("preferredChannel" IN ('email', 'sms', 'phone', 'none')); 

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "cadenceDueAt" TIMESTAMP(3),
ADD COLUMN     "cadenceKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "cadenceStatus" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "cadenceStep" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "campaignKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "lostReasonCode" TEXT,
ADD CONSTRAINT "Lead_cadenceStatus_check" CHECK ("cadenceStatus" IN ('none', 'active', 'paused', 'completed', 'suppressed')),
ADD CONSTRAINT "Lead_lostReasonCode_check" CHECK ("lostReasonCode" IS NULL OR "lostReasonCode" IN ('purchased-elsewhere', 'price', 'financing', 'vehicle-unavailable', 'no-response', 'timing', 'other')); 

-- CreateTable
CREATE TABLE "CustomerContactPreferenceEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "preferenceSnapshot" JSONB DEFAULT '{}',

    CONSTRAINT "CustomerContactPreferenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerHousehold" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "householdKey" TEXT NOT NULL DEFAULT '',
    "displayName" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "CustomerHousehold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesVisit" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "lead" TEXT,
    "customer" TEXT,
    "vehicle" TEXT,
    "assignedSalesperson" TEXT NOT NULL,
    "manager" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "managerTurnAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "outcome" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "SalesVisit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SalesVisit_kind_check" CHECK ("kind" IN ('appointment', 'showroom')),
    CONSTRAINT "SalesVisit_status_check" CHECK ("status" IN ('scheduled', 'arrived', 'manager-turn', 'completed', 'cancelled', 'no-show'))
);

-- CreateIndex
CREATE INDEX "CustomerContactPreferenceEvent_rooftop_idx" ON "CustomerContactPreferenceEvent"("rooftop");

-- CreateIndex
CREATE INDEX "CustomerContactPreferenceEvent_customer_idx" ON "CustomerContactPreferenceEvent"("customer");

-- CreateIndex
CREATE INDEX "CustomerContactPreferenceEvent_actor_idx" ON "CustomerContactPreferenceEvent"("actor");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerHousehold_householdKey_key" ON "CustomerHousehold"("householdKey");

-- CreateIndex
CREATE INDEX "CustomerHousehold_rooftop_idx" ON "CustomerHousehold"("rooftop");

-- CreateIndex
CREATE INDEX "SalesVisit_rooftop_idx" ON "SalesVisit"("rooftop");

-- CreateIndex
CREATE INDEX "SalesVisit_lead_idx" ON "SalesVisit"("lead");

-- CreateIndex
CREATE INDEX "SalesVisit_customer_idx" ON "SalesVisit"("customer");

-- CreateIndex
CREATE INDEX "SalesVisit_vehicle_idx" ON "SalesVisit"("vehicle");

-- CreateIndex
CREATE INDEX "SalesVisit_assignedSalesperson_idx" ON "SalesVisit"("assignedSalesperson");

-- CreateIndex
CREATE INDEX "SalesVisit_manager_idx" ON "SalesVisit"("manager");

-- CreateIndex
CREATE INDEX "Customer_household_idx" ON "Customer"("household");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_household_fkey" FOREIGN KEY ("household") REFERENCES "CustomerHousehold"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerContactPreferenceEvent" ADD CONSTRAINT "CustomerContactPreferenceEvent_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerContactPreferenceEvent" ADD CONSTRAINT "CustomerContactPreferenceEvent_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerContactPreferenceEvent" ADD CONSTRAINT "CustomerContactPreferenceEvent_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerHousehold" ADD CONSTRAINT "CustomerHousehold_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesVisit" ADD CONSTRAINT "SalesVisit_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesVisit" ADD CONSTRAINT "SalesVisit_lead_fkey" FOREIGN KEY ("lead") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesVisit" ADD CONSTRAINT "SalesVisit_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesVisit" ADD CONSTRAINT "SalesVisit_vehicle_fkey" FOREIGN KEY ("vehicle") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesVisit" ADD CONSTRAINT "SalesVisit_assignedSalesperson_fkey" FOREIGN KEY ("assignedSalesperson") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesVisit" ADD CONSTRAINT "SalesVisit_manager_fkey" FOREIGN KEY ("manager") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
