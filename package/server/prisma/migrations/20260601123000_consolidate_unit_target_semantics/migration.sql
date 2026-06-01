-- Generalize Unit.targetUnitId from catalog-variant-only metadata to the
-- canonical weak target edge for Unit rows, then move Post's duplicate target
-- storage onto the owning Unit.

ALTER TABLE "Unit"
  DROP CONSTRAINT IF EXISTS "Unit_catalogEntryKind_targetUnitId_check";

UPDATE "Unit" AS u
SET "targetUnitId" = p."targetUnitId"
FROM "Post" AS p
WHERE p."unitId" = u."id"
  AND u."targetUnitId" IS NULL
  AND p."targetUnitId" IS NOT NULL;

DROP INDEX IF EXISTS "Post_targetUnitId_state_idx";
DROP INDEX IF EXISTS "Post_targetUnitId_createdAt_idx";
ALTER TABLE "Post" DROP CONSTRAINT IF EXISTS "Post_targetUnitId_fkey";
ALTER TABLE "Post" DROP COLUMN IF EXISTS "targetUnitId";

DROP INDEX IF EXISTS "Unit_catalogEntryKind_targetUnitId_idx";
CREATE INDEX IF NOT EXISTS "Unit_targetUnitId_idx"
  ON "Unit"("targetUnitId");
CREATE INDEX IF NOT EXISTS "Unit_catalogEntryKind_targetUnitId_idx"
  ON "Unit"("catalogEntryKind", "targetUnitId");

ALTER TABLE "Unit"
  ADD CONSTRAINT "Unit_variant_targetUnitId_check"
  CHECK (
    "catalogEntryKind" <> 'VARIANT'
    OR "targetUnitId" IS NOT NULL
  );
