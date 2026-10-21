-- Add source-wired onboarding fields needed by the dealership runtime.
-- These mirror the Openfront/Openfront Restaurant onboarding status and role permission pattern.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingStatus" TEXT DEFAULT 'not_started';
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "canManageOnboarding" BOOLEAN NOT NULL DEFAULT false;

-- Runtime inventory feeds and storefront freshness filters expect Vehicle.updatedAt.
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
