-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "selectedLenderDecision" TEXT;

-- CreateIndex
CREATE INDEX "Deal_selectedLenderDecision_idx" ON "Deal"("selectedLenderDecision");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_selectedLenderDecision_fkey" FOREIGN KEY ("selectedLenderDecision") REFERENCES "LenderDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
