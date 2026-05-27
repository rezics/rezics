CREATE TYPE "AiDisclosureMode" AS ENUM (
  'UNKNOWN',
  'NONE',
  'AI_ASSISTED',
  'AI_ORIGINATED',
  'MACHINE_GENERATED'
);

ALTER TABLE "Unit"
  ADD COLUMN "aiDisclosureMode" "AiDisclosureMode" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "aiDisclosureDetails" JSONB;

UPDATE "Unit"
SET "aiDisclosureMode" = 'UNKNOWN'
WHERE "aiDisclosureMode" IS NULL;
