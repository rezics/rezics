-- Add nullable publication metadata for a backward-compatible rollout.
ALTER TABLE "Unit"
ADD COLUMN "licenseSlug" TEXT,
ADD COLUMN "copyrightNotice" TEXT;

-- Existing publishable Units get the platform default effective license.
-- This does not migrate or reinterpret Book/Game/Media isLicensed fields.
UPDATE "Unit"
SET "licenseSlug" = 'all-rights-reserved'
WHERE "licenseSlug" IS NULL
  AND "type" IN ('BOOK', 'GAME', 'MEDIA', 'POST', 'SHELF', 'IMAGE', 'VIDEO', 'QUOTE', 'LINK');

