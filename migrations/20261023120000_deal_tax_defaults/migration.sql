-- AlterTable
ALTER TABLE "DealershipProfile" ADD COLUMN     "docFeeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "salesTaxRateBps" INTEGER NOT NULL DEFAULT 0;
