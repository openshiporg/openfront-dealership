-- Add public static image path support for dealership demo inventory media.
-- Matches VehicleImage.imagePath in the Keystone model and storefront/feed queries.
ALTER TABLE "VehicleImage" ADD COLUMN IF NOT EXISTS "imagePath" TEXT NOT NULL DEFAULT '';
