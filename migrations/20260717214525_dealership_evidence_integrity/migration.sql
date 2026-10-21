-- Convert persisted dealership money from floating-point dollars to integer USD
-- cents without dropping data. Compatibility GraphQL virtuals continue to expose
-- dollar values to existing readers.

ALTER TABLE "Vehicle" RENAME COLUMN "purchasePrice" TO "purchasePriceCents";
ALTER TABLE "Vehicle" RENAME COLUMN "listPrice" TO "listPriceCents";
ALTER TABLE "Vehicle" RENAME COLUMN "price" TO "priceCents";
ALTER TABLE "Vehicle"
  ALTER COLUMN "purchasePriceCents" TYPE INTEGER USING CASE WHEN "purchasePriceCents" IS NULL THEN NULL ELSE ROUND("purchasePriceCents" * 100)::INTEGER END,
  ALTER COLUMN "listPriceCents" TYPE INTEGER USING CASE WHEN "listPriceCents" IS NULL THEN NULL ELSE ROUND("listPriceCents" * 100)::INTEGER END,
  ALTER COLUMN "priceCents" TYPE INTEGER USING CASE WHEN "priceCents" IS NULL THEN NULL ELSE ROUND("priceCents" * 100)::INTEGER END;

ALTER TABLE "PriceHistory" RENAME COLUMN "previousPrice" TO "previousPriceCents";
ALTER TABLE "PriceHistory" RENAME COLUMN "newPrice" TO "newPriceCents";
ALTER TABLE "PriceHistory"
  ALTER COLUMN "previousPriceCents" TYPE INTEGER USING CASE WHEN "previousPriceCents" IS NULL THEN NULL ELSE ROUND("previousPriceCents" * 100)::INTEGER END,
  ALTER COLUMN "newPriceCents" TYPE INTEGER USING ROUND("newPriceCents" * 100)::INTEGER;

ALTER TABLE "Deal" RENAME COLUMN "vehiclePrice" TO "vehiclePriceCents";
ALTER TABLE "Deal" RENAME COLUMN "tradeInValue" TO "tradeInValueCents";
ALTER TABLE "Deal" RENAME COLUMN "downPayment" TO "downPaymentCents";
ALTER TABLE "Deal" RENAME COLUMN "financingAmount" TO "financingAmountCents";
ALTER TABLE "Deal" RENAME COLUMN "monthlyPayment" TO "monthlyPaymentCents";
ALTER TABLE "Deal" RENAME COLUMN "taxAmount" TO "taxAmountCents";
ALTER TABLE "Deal"
  ALTER COLUMN "vehiclePriceCents" TYPE INTEGER USING CASE WHEN "vehiclePriceCents" IS NULL THEN NULL ELSE ROUND("vehiclePriceCents" * 100)::INTEGER END,
  ALTER COLUMN "tradeInValueCents" TYPE INTEGER USING CASE WHEN "tradeInValueCents" IS NULL THEN NULL ELSE ROUND("tradeInValueCents" * 100)::INTEGER END,
  ALTER COLUMN "downPaymentCents" TYPE INTEGER USING CASE WHEN "downPaymentCents" IS NULL THEN NULL ELSE ROUND("downPaymentCents" * 100)::INTEGER END,
  ALTER COLUMN "financingAmountCents" TYPE INTEGER USING CASE WHEN "financingAmountCents" IS NULL THEN NULL ELSE ROUND("financingAmountCents" * 100)::INTEGER END,
  ALTER COLUMN "monthlyPaymentCents" TYPE INTEGER USING CASE WHEN "monthlyPaymentCents" IS NULL THEN NULL ELSE ROUND("monthlyPaymentCents" * 100)::INTEGER END,
  ALTER COLUMN "taxAmountCents" TYPE INTEGER USING CASE WHEN "taxAmountCents" IS NULL THEN NULL ELSE ROUND("taxAmountCents" * 100)::INTEGER END,
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "evidenceSnapshot" JSONB DEFAULT '{}'::jsonb;

ALTER TABLE "TradeIn" RENAME COLUMN "kbbValue" TO "kbbValueCents";
ALTER TABLE "TradeIn" RENAME COLUMN "offerAmount" TO "offerAmountCents";
ALTER TABLE "TradeIn"
  ALTER COLUMN "kbbValueCents" TYPE INTEGER USING CASE WHEN "kbbValueCents" IS NULL THEN NULL ELSE ROUND("kbbValueCents" * 100)::INTEGER END,
  ALTER COLUMN "offerAmountCents" TYPE INTEGER USING CASE WHEN "offerAmountCents" IS NULL THEN NULL ELSE ROUND("offerAmountCents" * 100)::INTEGER END;

ALTER TABLE "ServiceOrder" RENAME COLUMN "laborTotal" TO "laborTotalCents";
ALTER TABLE "ServiceOrder" RENAME COLUMN "partsTotal" TO "partsTotalCents";
ALTER TABLE "ServiceOrder" RENAME COLUMN "tax" TO "taxCents";
ALTER TABLE "ServiceOrder" RENAME COLUMN "grandTotal" TO "grandTotalCents";
ALTER TABLE "ServiceOrder"
  ALTER COLUMN "laborTotalCents" TYPE INTEGER USING CASE WHEN "laborTotalCents" IS NULL THEN NULL ELSE ROUND("laborTotalCents" * 100)::INTEGER END,
  ALTER COLUMN "partsTotalCents" TYPE INTEGER USING CASE WHEN "partsTotalCents" IS NULL THEN NULL ELSE ROUND("partsTotalCents" * 100)::INTEGER END,
  ALTER COLUMN "taxCents" TYPE INTEGER USING CASE WHEN "taxCents" IS NULL THEN NULL ELSE ROUND("taxCents" * 100)::INTEGER END,
  ALTER COLUMN "grandTotalCents" TYPE INTEGER USING CASE WHEN "grandTotalCents" IS NULL THEN NULL ELSE ROUND("grandTotalCents" * 100)::INTEGER END,
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "settledAt" TIMESTAMP(3),
  ADD COLUMN "evidenceSnapshot" JSONB DEFAULT '{}'::jsonb;

ALTER TABLE "RepairOrderLineItem" RENAME COLUMN "unitPrice" TO "unitPriceCents";
ALTER TABLE "RepairOrderLineItem" RENAME COLUMN "price" TO "priceCents";
ALTER TABLE "RepairOrderLineItem" RENAME COLUMN "cost" TO "costCents";
ALTER TABLE "RepairOrderLineItem"
  ALTER COLUMN "unitPriceCents" TYPE INTEGER USING ROUND("unitPriceCents" * 100)::INTEGER,
  ALTER COLUMN "priceCents" TYPE INTEGER USING ROUND("priceCents" * 100)::INTEGER,
  ALTER COLUMN "costCents" TYPE INTEGER USING CASE WHEN "costCents" IS NULL THEN NULL ELSE ROUND("costCents" * 100)::INTEGER END;

ALTER TABLE "ServicePackage" RENAME COLUMN "price" TO "priceCents";
ALTER TABLE "ServicePackage"
  ALTER COLUMN "priceCents" TYPE INTEGER USING ROUND("priceCents" * 100)::INTEGER;

ALTER TABLE "PartsInventory" RENAME COLUMN "cost" TO "costCents";
ALTER TABLE "PartsInventory" RENAME COLUMN "price" TO "priceCents";
ALTER TABLE "PartsInventory"
  ALTER COLUMN "costCents" TYPE INTEGER USING CASE WHEN "costCents" IS NULL THEN NULL ELSE ROUND("costCents" * 100)::INTEGER END,
  ALTER COLUMN "priceCents" TYPE INTEGER USING ROUND("priceCents" * 100)::INTEGER;

-- Remove only the known starter placeholders. Unknown/operator-supplied identity
-- values are intentionally preserved.
UPDATE "DealershipProfile"
SET
  "phone" = CASE WHEN "phone" = '(555) 123-4567' THEN '' ELSE "phone" END,
  "addressLine1" = CASE WHEN "addressLine1" = '123 Auto Drive' THEN '' ELSE "addressLine1" END,
  "city" = CASE WHEN "city" = 'Anytown' THEN '' ELSE "city" END,
  "state" = CASE WHEN "state" = 'USA' THEN '' ELSE "state" END,
  "postalCode" = CASE WHEN "postalCode" = '12345' THEN '' ELSE "postalCode" END
WHERE
  "phone" = '(555) 123-4567'
  OR "addressLine1" = '123 Auto Drive'
  OR "city" = 'Anytown'
  OR "state" = 'USA'
  OR "postalCode" = '12345';
