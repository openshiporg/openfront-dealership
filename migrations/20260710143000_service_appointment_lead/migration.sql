-- Link storefront service appointments to their CRM lead.
ALTER TABLE "ServiceAppointment" ADD COLUMN IF NOT EXISTS "lead" TEXT;
CREATE INDEX IF NOT EXISTS "ServiceAppointment_lead_idx" ON "ServiceAppointment"("lead");
ALTER TABLE "ServiceAppointment"
  ADD CONSTRAINT "ServiceAppointment_lead_fkey"
  FOREIGN KEY ("lead") REFERENCES "Lead"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
