CREATE TABLE "AuthenticationThrottle" (
  "id" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL DEFAULT '',
  "purpose" TEXT NOT NULL DEFAULT '',
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "windowStartedAt" TIMESTAMP(3) NOT NULL,
  "blockedUntil" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3),
  CONSTRAINT "AuthenticationThrottle_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuthenticationThrottle_values_check" CHECK ("keyHash" ~ '^[0-9a-f]{64}$' AND "purpose" IN ('sign-in','password-reset','password-reset-request') AND "failureCount" >= 0)
);
CREATE UNIQUE INDEX "AuthenticationThrottle_keyHash_key" ON "AuthenticationThrottle"("keyHash");
CREATE INDEX "AuthenticationThrottle_blockedUntil_idx" ON "AuthenticationThrottle"("blockedUntil");
