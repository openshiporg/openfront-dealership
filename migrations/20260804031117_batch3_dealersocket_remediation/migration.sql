BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "SalesVisit"
    WHERE "lead" IS NULL OR "customer" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot enforce SalesVisit customer/lead identity while retained rows are incomplete';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "SavedReport"
    WHERE "owner" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot enforce SavedReport owner authority while retained rows are incomplete';
  END IF;
END $$;

ALTER TABLE "AuthenticationThrottle"
  DROP CONSTRAINT "AuthenticationThrottle_values_check";

ALTER TABLE "AuthenticationThrottle"
  ADD CONSTRAINT "AuthenticationThrottle_values_check"
  CHECK (
    "keyHash" ~ '^[0-9a-f]{64}$'
    AND "purpose" IN (
      'sign-in',
      'password-reset',
      'password-reset-request',
      'public-inquiry-identity',
      'public-inquiry-network',
      'public-test-drive-identity',
      'public-test-drive-network',
      'public-trade-in-identity',
      'public-trade-in-network',
      'public-financing-identity',
      'public-financing-network',
      'public-service-identity',
      'public-service-network'
    )
    AND "failureCount" >= 0
  );

ALTER TABLE "SavedReport"
  DROP CONSTRAINT "SavedReport_owner_fkey";

ALTER TABLE "SalesVisit"
  ALTER COLUMN "lead" SET NOT NULL,
  ALTER COLUMN "customer" SET NOT NULL;

CREATE INDEX "DeliveryCase_deal_idx" ON "DeliveryCase"("deal");
CREATE INDEX "FinanceContractPackage_deal_idx" ON "FinanceContractPackage"("deal");
CREATE INDEX "FinanceFundingCase_deal_idx" ON "FinanceFundingCase"("deal");

ALTER TABLE "SavedReport"
  ADD CONSTRAINT "SavedReport_owner_fkey"
  FOREIGN KEY ("owner") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
