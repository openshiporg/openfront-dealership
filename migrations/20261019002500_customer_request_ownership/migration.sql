-- AlterTable
ALTER TABLE "ServiceAppointment" ADD COLUMN     "requestedBy" TEXT;

-- AlterTable
ALTER TABLE "TestDrive" ADD COLUMN     "requestedBy" TEXT;

-- CreateIndex
CREATE INDEX "ServiceAppointment_requestedBy_idx" ON "ServiceAppointment"("requestedBy");

-- CreateIndex
CREATE INDEX "TestDrive_requestedBy_idx" ON "TestDrive"("requestedBy");

-- AddForeignKey
ALTER TABLE "TestDrive" ADD CONSTRAINT "TestDrive_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAppointment" ADD CONSTRAINT "ServiceAppointment_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

