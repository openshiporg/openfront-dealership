-- AlterTable
ALTER TABLE "PaymentTransaction" ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT '';

-- Operator-recorded payments (cash sales, deposits) and installed providers other than Stripe
-- write their own provider key; the currency stays USD-only.
ALTER TABLE "PaymentTransaction" DROP CONSTRAINT "PaymentTransaction_provider_currency_check";
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_provider_currency_check" CHECK ("providerKey" <> '' AND "currency" = 'usd');
