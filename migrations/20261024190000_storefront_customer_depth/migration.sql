-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "account" TEXT;

-- AlterTable
ALTER TABLE "ServiceAppointment" ADD COLUMN     "servicePackage" TEXT;

-- AlterTable
ALTER TABLE "TestDrive" ADD COLUMN     "cancelledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Customer_account_idx" ON "Customer"("account");

-- CreateIndex
CREATE INDEX "ServiceAppointment_servicePackage_idx" ON "ServiceAppointment"("servicePackage");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_account_fkey" FOREIGN KEY ("account") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAppointment" ADD CONSTRAINT "ServiceAppointment_servicePackage_fkey" FOREIGN KEY ("servicePackage") REFERENCES "ServicePackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
