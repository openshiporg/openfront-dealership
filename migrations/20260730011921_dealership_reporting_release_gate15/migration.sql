-- CreateTable
CREATE TABLE "SavedReport" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "owner" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "reportType" TEXT NOT NULL,
    "filters" JSONB DEFAULT '{}',
    "exportFormat" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "SavedReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "savedReport" TEXT,
    "status" TEXT NOT NULL,
    "exportFormat" TEXT NOT NULL,
    "resultSnapshot" JSONB DEFAULT '{}',
    "resultDigest" TEXT NOT NULL DEFAULT '',
    "errorCode" TEXT NOT NULL DEFAULT '',
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ReportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionPolicy" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "rationale" TEXT NOT NULL DEFAULT '',
    "lastSweptAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedReport_idempotencyKey_key" ON "SavedReport"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SavedReport_rooftop_idx" ON "SavedReport"("rooftop");

-- CreateIndex
CREATE INDEX "SavedReport_owner_idx" ON "SavedReport"("owner");

-- CreateIndex
CREATE UNIQUE INDEX "ReportRun_idempotencyKey_key" ON "ReportRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ReportRun_rooftop_idx" ON "ReportRun"("rooftop");

-- CreateIndex
CREATE INDEX "ReportRun_savedReport_idx" ON "ReportRun"("savedReport");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionPolicy_idempotencyKey_key" ON "RetentionPolicy"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RetentionPolicy_rooftop_idx" ON "RetentionPolicy"("rooftop");

ALTER TABLE "SavedReport" ALTER COLUMN "owner" SET NOT NULL;
ALTER TABLE "ReportRun" ALTER COLUMN "savedReport" SET NOT NULL;
CREATE UNIQUE INDEX "RetentionPolicy_rooftop_category_key" ON "RetentionPolicy"("rooftop", "category");
ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_minimum_days_check" CHECK (("category" = 'audit-evidence' AND "retentionDays" >= 2555) OR ("category" = 'customer-intake' AND "retentionDays" >= 730) OR ("category" = 'provider-payload' AND "retentionDays" >= 365) OR ("category" = 'report-export' AND "retentionDays" >= 1));

-- AddForeignKey
ALTER TABLE "SavedReport" ADD CONSTRAINT "SavedReport_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedReport" ADD CONSTRAINT "SavedReport_owner_fkey" FOREIGN KEY ("owner") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRun" ADD CONSTRAINT "ReportRun_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRun" ADD CONSTRAINT "ReportRun_savedReport_fkey" FOREIGN KEY ("savedReport") REFERENCES "SavedReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
