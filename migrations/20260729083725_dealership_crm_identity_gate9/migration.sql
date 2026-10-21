-- Add CRM lifecycle columns first. Customer remains nullable only during the
-- deterministic retained-row backfill below, then becomes required.
ALTER TABLE "Lead" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "customer" TEXT,
ADD COLUMN     "firstResponseAt" TIMESTAMP(3),
ADD COLUMN     "firstResponseDueAt" TIMESTAMP(3),
ADD COLUMN     "lostReason" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "primaryEmail" TEXT NOT NULL DEFAULT '',
    "primaryPhone" TEXT NOT NULL DEFAULT '',
    "normalizedEmail" TEXT NOT NULL DEFAULT '',
    "normalizedPhone" TEXT NOT NULL DEFAULT '',
    "identityKey" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "emailConsent" BOOLEAN NOT NULL DEFAULT false,
    "smsConsent" BOOLEAN NOT NULL DEFAULT false,
    "phoneConsent" BOOLEAN NOT NULL DEFAULT false,
    "mergedAt" TIMESTAMP(3),
    "mergedInto" TEXT,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- Backfill one deterministic customer identity per rooftop and strongest
-- normalized contact key. Existing Lead IDs and operational relationships are
-- preserved; matching retained leads reuse the same Customer row.
WITH normalized_leads AS (
  SELECT
    l."id" AS lead_id,
    l."rooftop" AS rooftop_id,
    l."firstName" AS first_name,
    l."lastName" AS last_name,
    l."email" AS primary_email,
    l."phone" AS primary_phone,
    lower(trim(coalesce(l."email", ''))) AS normalized_email,
    CASE
      WHEN length(regexp_replace(coalesce(l."phone", ''), '[^0-9]', '', 'g')) = 11
        AND regexp_replace(coalesce(l."phone", ''), '[^0-9]', '', 'g') LIKE '1%'
      THEN substring(regexp_replace(coalesce(l."phone", ''), '[^0-9]', '', 'g') FROM 2)
      ELSE regexp_replace(coalesce(l."phone", ''), '[^0-9]', '', 'g')
    END AS normalized_phone,
    l."createdAt" AS created_at,
    l."updatedAt" AS updated_at
  FROM "Lead" l
), keyed AS (
  SELECT *,
    rooftop_id || ':' || CASE
      WHEN normalized_email <> '' THEN 'email:' || normalized_email
      WHEN normalized_phone <> '' THEN 'phone:' || normalized_phone
      ELSE 'lead:' || lead_id
    END AS contact_key
  FROM normalized_leads
), canonical AS (
  SELECT DISTINCT ON (contact_key) *
  FROM keyed
  ORDER BY contact_key, created_at, lead_id
)
INSERT INTO "Customer" (
  "id", "createdAt", "updatedAt", "rooftop", "firstName", "lastName",
  "primaryEmail", "primaryPhone", "normalizedEmail", "normalizedPhone", "identityKey", "status"
)
SELECT
  'cust_' || md5(contact_key), created_at, updated_at, rooftop_id, first_name, last_name,
  primary_email, primary_phone, normalized_email, normalized_phone, md5(contact_key), 'active'
FROM canonical;

WITH normalized_leads AS (
  SELECT
    l."id" AS lead_id,
    l."rooftop" || ':' || CASE
      WHEN lower(trim(coalesce(l."email", ''))) <> '' THEN 'email:' || lower(trim(l."email"))
      WHEN regexp_replace(coalesce(l."phone", ''), '[^0-9]', '', 'g') <> '' THEN 'phone:' || CASE
        WHEN length(regexp_replace(l."phone", '[^0-9]', '', 'g')) = 11
          AND regexp_replace(l."phone", '[^0-9]', '', 'g') LIKE '1%'
        THEN substring(regexp_replace(l."phone", '[^0-9]', '', 'g') FROM 2)
        ELSE regexp_replace(l."phone", '[^0-9]', '', 'g')
      END
      ELSE 'lead:' || l."id"
    END AS contact_key
  FROM "Lead" l
)
UPDATE "Lead" l
SET "customer" = 'cust_' || md5(n.contact_key)
FROM normalized_leads n
WHERE l."id" = n.lead_id;

ALTER TABLE "Lead" ALTER COLUMN "customer" SET NOT NULL;

-- CreateTable
CREATE TABLE "CustomerMergeEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "survivor" TEXT NOT NULL,
    "duplicate" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "mergedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "movedLeadIds" JSONB DEFAULT '[]',
    "evidenceSnapshot" JSONB DEFAULT '{}',

    CONSTRAINT "CustomerMergeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadAssignmentEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "lead" TEXT NOT NULL,
    "fromUser" TEXT,
    "toUser" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "routeKey" TEXT NOT NULL DEFAULT '',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstResponseDueAt" TIMESTAMP(3),

    CONSTRAINT "LeadAssignmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadRoutingRule" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "routeKey" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "source" TEXT NOT NULL DEFAULT 'any',
    "assignee" TEXT NOT NULL,
    "firstResponseMinutes" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "LeadRoutingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_identityKey_key" ON "Customer"("identityKey");

-- CreateIndex
CREATE INDEX "Customer_rooftop_idx" ON "Customer"("rooftop");

-- CreateIndex
CREATE INDEX "Customer_normalizedEmail_idx" ON "Customer"("normalizedEmail");

-- CreateIndex
CREATE INDEX "Customer_normalizedPhone_idx" ON "Customer"("normalizedPhone");

-- CreateIndex
CREATE INDEX "Customer_mergedInto_idx" ON "Customer"("mergedInto");

-- CreateIndex
CREATE INDEX "CustomerMergeEvent_rooftop_idx" ON "CustomerMergeEvent"("rooftop");

-- CreateIndex
CREATE INDEX "CustomerMergeEvent_survivor_idx" ON "CustomerMergeEvent"("survivor");

-- CreateIndex
CREATE INDEX "CustomerMergeEvent_duplicate_idx" ON "CustomerMergeEvent"("duplicate");

-- CreateIndex
CREATE INDEX "CustomerMergeEvent_actor_idx" ON "CustomerMergeEvent"("actor");

-- CreateIndex
CREATE INDEX "LeadAssignmentEvent_rooftop_idx" ON "LeadAssignmentEvent"("rooftop");

-- CreateIndex
CREATE INDEX "LeadAssignmentEvent_lead_idx" ON "LeadAssignmentEvent"("lead");

-- CreateIndex
CREATE INDEX "LeadAssignmentEvent_fromUser_idx" ON "LeadAssignmentEvent"("fromUser");

-- CreateIndex
CREATE INDEX "LeadAssignmentEvent_toUser_idx" ON "LeadAssignmentEvent"("toUser");

-- CreateIndex
CREATE INDEX "LeadAssignmentEvent_actor_idx" ON "LeadAssignmentEvent"("actor");

-- CreateIndex
CREATE UNIQUE INDEX "LeadRoutingRule_routeKey_key" ON "LeadRoutingRule"("routeKey");

-- CreateIndex
CREATE INDEX "LeadRoutingRule_rooftop_idx" ON "LeadRoutingRule"("rooftop");

-- CreateIndex
CREATE INDEX "LeadRoutingRule_assignee_idx" ON "LeadRoutingRule"("assignee");

-- CreateIndex
CREATE INDEX "Lead_customer_idx" ON "Lead"("customer");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_mergedInto_fkey" FOREIGN KEY ("mergedInto") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMergeEvent" ADD CONSTRAINT "CustomerMergeEvent_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMergeEvent" ADD CONSTRAINT "CustomerMergeEvent_survivor_fkey" FOREIGN KEY ("survivor") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMergeEvent" ADD CONSTRAINT "CustomerMergeEvent_duplicate_fkey" FOREIGN KEY ("duplicate") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMergeEvent" ADD CONSTRAINT "CustomerMergeEvent_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignmentEvent" ADD CONSTRAINT "LeadAssignmentEvent_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignmentEvent" ADD CONSTRAINT "LeadAssignmentEvent_lead_fkey" FOREIGN KEY ("lead") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignmentEvent" ADD CONSTRAINT "LeadAssignmentEvent_fromUser_fkey" FOREIGN KEY ("fromUser") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignmentEvent" ADD CONSTRAINT "LeadAssignmentEvent_toUser_fkey" FOREIGN KEY ("toUser") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignmentEvent" ADD CONSTRAINT "LeadAssignmentEvent_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadRoutingRule" ADD CONSTRAINT "LeadRoutingRule_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadRoutingRule" ADD CONSTRAINT "LeadRoutingRule_assignee_fkey" FOREIGN KEY ("assignee") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
