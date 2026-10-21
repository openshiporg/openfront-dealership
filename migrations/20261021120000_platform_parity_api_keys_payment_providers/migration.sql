-- CreateEnum
CREATE TYPE "ApiKeyStatusType" AS ENUM ('active', 'inactive', 'revoked');

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "canManageKeys" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManagePayments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageSettings" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageUsers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadPayments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadRoles" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadUsers" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "canViewInventory" SET DEFAULT false;

-- AlterTable
ALTER TABLE "AccountingMapping" ALTER COLUMN "providerKey" SET DEFAULT 'operator-recorded';

-- AlterTable
ALTER TABLE "PaymentTransaction" ADD COLUMN     "paymentProvider" TEXT;

-- CreateTable
CREATE TABLE "PaymentProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "isInstalled" BOOLEAN NOT NULL DEFAULT true,
    "credentials" JSONB DEFAULT '{}',
    "metadata" JSONB DEFAULT '{}',
    "createPaymentFunction" TEXT NOT NULL DEFAULT '',
    "capturePaymentFunction" TEXT NOT NULL DEFAULT '',
    "refundPaymentFunction" TEXT NOT NULL DEFAULT '',
    "getPaymentStatusFunction" TEXT NOT NULL DEFAULT '',
    "generatePaymentLinkFunction" TEXT NOT NULL DEFAULT '',
    "handleWebhookFunction" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "tokenSecret" TEXT NOT NULL,
    "tokenPreview" TEXT NOT NULL DEFAULT '',
    "scopes" JSONB DEFAULT '[]',
    "status" "ApiKeyStatusType" DEFAULT 'active',
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "usageCount" JSONB DEFAULT '{"total":0,"daily":{}}',
    "restrictedToIPs" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user" TEXT,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProvider_code_key" ON "PaymentProvider"("code");

-- CreateIndex
CREATE INDEX "ApiKey_user_idx" ON "ApiKey"("user");

-- CreateIndex
CREATE INDEX "PaymentTransaction_paymentProvider_idx" ON "PaymentTransaction"("paymentProvider");

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_paymentProvider_fkey" FOREIGN KEY ("paymentProvider") REFERENCES "PaymentProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: keep existing roles' abilities under the new permission checkboxes.
UPDATE "Role" SET "canReadPayments" = true WHERE "canViewReports" = true;
UPDATE "Role" SET "canManagePayments" = true WHERE "canViewReports" = true AND "canManageDealerships" = true;
UPDATE "Role" SET "canReadUsers" = true, "canManageUsers" = true WHERE "canManagePeople" = true;
UPDATE "Role" SET "canReadRoles" = true, "canManageKeys" = true WHERE "canManageRoles" = true;
UPDATE "Role" SET "canManageSettings" = true WHERE "canManageDealerships" = true;
