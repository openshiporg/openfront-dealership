-- Generated from declared Prisma 6.5 schema diff on the goal-owned fresh database.
-- Preserve legacy throttle rows whose previous nullable updatedAt was unset.
ALTER TABLE "AuthenticationThrottle"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "AuthenticationThrottle" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "AuthenticationThrottle"
  ALTER COLUMN "updatedAt" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
