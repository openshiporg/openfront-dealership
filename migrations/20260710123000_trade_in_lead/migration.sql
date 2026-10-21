-- Link public trade-in appraisal requests to their CRM lead.
ALTER TABLE "TradeIn" ADD COLUMN IF NOT EXISTS "lead" TEXT;
CREATE INDEX IF NOT EXISTS "TradeIn_lead_idx" ON "TradeIn"("lead");
ALTER TABLE "TradeIn"
  ADD CONSTRAINT "TradeIn_lead_fkey"
  FOREIGN KEY ("lead") REFERENCES "Lead"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
