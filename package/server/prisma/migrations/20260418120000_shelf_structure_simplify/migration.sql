-- Shelf structure simplification migration.
--
-- This migration:
--   1. Adds the new ShelfItem columns (itemRef, kind, position)
--   2. Backfills them from existing data
--   3. Creates the new ShelfUnit junction table with role-discriminated rows
--   4. Backfills ShelfUnit primary / review / tag rows from legacy state
--   5. Drops old columns (itemUnitId, sortOrder, keywords, label, extra) and the
--      ShelfItem -> Unit FK
--   6. Drops the ShelfItemReview junction table (rows moved into ShelfUnit)
--   7. Drops User.keywords

-- DropForeignKey
ALTER TABLE "ShelfItemReview" DROP CONSTRAINT IF EXISTS "ShelfItemReview_shelfUnitId_itemUnitId_fkey";
ALTER TABLE "ShelfItemReview" DROP CONSTRAINT IF EXISTS "ShelfItemReview_reviewUnitId_fkey";
ALTER TABLE "ShelfItem" DROP CONSTRAINT IF EXISTS "ShelfItem_itemUnitId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "ShelfItem_itemUnitId_idx";
DROP INDEX IF EXISTS "ShelfItem_shelfUnitId_sortOrder_idx";

-- AlterTable: add new columns (nullable initially so backfill can run)
ALTER TABLE "ShelfItem"
  ADD COLUMN "itemRef"   UUID,
  ADD COLUMN "kind"      VARCHAR(32),
  ADD COLUMN "position"  VARCHAR(64);

-- Backfill itemRef = itemUnitId
UPDATE "ShelfItem" SET "itemRef" = "itemUnitId";

-- Backfill kind from Unit + Post
UPDATE "ShelfItem" si
SET "kind" = CASE
  WHEN u."type" = 'POST' AND p."kind" = 'REVIEW'  THEN 'review'
  WHEN u."type" = 'POST' AND p."kind" = 'EXCERPT' THEN 'quote'
  WHEN u."type" = 'POST' AND p."kind" = 'CHAPTER' THEN 'chapter'
  WHEN u."type" = 'POST'                          THEN 'post'
  WHEN u."type" = 'BOOK'                          THEN 'book'
  WHEN u."type" = 'TAG'                           THEN 'tag'
  WHEN u."type" = 'REALM'                         THEN 'realm'
  WHEN u."type" = 'LINK'                          THEN 'link'
  ELSE LOWER(u."type"::TEXT)
END
FROM "Unit" u
LEFT JOIN "Post" p ON p."unitId" = u."id"
WHERE si."itemUnitId" = u."id";

-- Orphans (Unit row gone) get a safe fallback
UPDATE "ShelfItem" SET "kind" = 'post' WHERE "kind" IS NULL;

-- Backfill position: evenly spaced zero-padded hex keys within each shelf.
--   For n items in a shelf, positions are (k+1)*1000 in hex, left-padded to 8 chars.
--   Keys are lexicographically sortable and leave room for inserts between any two.
WITH ranked AS (
  SELECT
    "shelfUnitId",
    "itemUnitId",
    (ROW_NUMBER() OVER (
      PARTITION BY "shelfUnitId"
      ORDER BY "sortOrder" ASC, "createdAt" ASC
    ) - 1) AS rnk
  FROM "ShelfItem"
)
UPDATE "ShelfItem" si
SET "position" = LPAD(TO_HEX(((r.rnk + 1) * 1000)::BIGINT), 8, '0')
FROM ranked r
WHERE si."shelfUnitId" = r."shelfUnitId"
  AND si."itemUnitId"  = r."itemUnitId";

-- NOT NULL constraints on newly-backfilled columns
ALTER TABLE "ShelfItem"
  ALTER COLUMN "itemRef"  SET NOT NULL,
  ALTER COLUMN "kind"     SET NOT NULL,
  ALTER COLUMN "position" SET NOT NULL;

-- Replace composite primary key
ALTER TABLE "ShelfItem" DROP CONSTRAINT "ShelfItem_pkey";
ALTER TABLE "ShelfItem" ADD  CONSTRAINT "ShelfItem_pkey" PRIMARY KEY ("shelfUnitId", "itemRef");

-- New ShelfItem index (sole index; reverse lookups live on ShelfUnit)
CREATE INDEX "ShelfItem_shelfUnitId_position_idx" ON "ShelfItem"("shelfUnitId", "position");

-- CreateTable ShelfUnit (shelf↔unit m:m junction, role-discriminated)
CREATE TABLE "ShelfUnit" (
    "shelfUnitId" UUID NOT NULL,
    "itemRef"     UUID NOT NULL,
    "unitId"      UUID NOT NULL,
    "role"        VARCHAR(32) NOT NULL,

    CONSTRAINT "ShelfUnit_pkey" PRIMARY KEY ("shelfUnitId", "itemRef", "unitId", "role")
);

CREATE INDEX "ShelfUnit_unitId_idx"               ON "ShelfUnit"("unitId");
CREATE INDEX "ShelfUnit_unitId_role_idx"          ON "ShelfUnit"("unitId", "role");
CREATE INDEX "ShelfUnit_shelfUnitId_role_idx"     ON "ShelfUnit"("shelfUnitId", "role");

ALTER TABLE "ShelfUnit"
  ADD CONSTRAINT "ShelfUnit_shelfUnitId_fkey"
  FOREIGN KEY ("shelfUnitId") REFERENCES "Shelf"("unitId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShelfUnit"
  ADD CONSTRAINT "ShelfUnit_shelfUnitId_itemRef_fkey"
  FOREIGN KEY ("shelfUnitId", "itemRef") REFERENCES "ShelfItem"("shelfUnitId", "itemRef")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShelfUnit"
  ADD CONSTRAINT "ShelfUnit_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill ShelfUnit primary rows: one per ShelfItem, unitId = itemRef.
-- Skip rows whose itemRef has no Unit (orphans) to satisfy the FK.
INSERT INTO "ShelfUnit" ("shelfUnitId", "itemRef", "unitId", "role")
SELECT si."shelfUnitId", si."itemRef", si."itemRef", 'primary'
FROM "ShelfItem" si
WHERE EXISTS (SELECT 1 FROM "Unit" u WHERE u."id" = si."itemRef")
ON CONFLICT DO NOTHING;

-- Backfill ShelfUnit review rows from the legacy ShelfItemReview table.
-- Requires the parent ShelfItem row exists; skip orphan review entries.
INSERT INTO "ShelfUnit" ("shelfUnitId", "itemRef", "unitId", "role")
SELECT r."shelfUnitId", r."itemUnitId", r."reviewUnitId", 'review'
FROM "ShelfItemReview" r
WHERE EXISTS (
        SELECT 1 FROM "ShelfItem" si
        WHERE si."shelfUnitId" = r."shelfUnitId" AND si."itemRef" = r."itemUnitId")
  AND EXISTS (SELECT 1 FROM "Unit" u WHERE u."id" = r."reviewUnitId")
ON CONFLICT DO NOTHING;

-- Backfill ShelfUnit tag rows by resolving legacy keywords strings to Tag units.
-- Unresolved keyword strings are dropped silently.
INSERT INTO "ShelfUnit" ("shelfUnitId", "itemRef", "unitId", "role")
SELECT DISTINCT si."shelfUnitId", si."itemRef", u."id", 'tag'
FROM "ShelfItem" si
JOIN "UnitTranslation" t ON t."title" = ANY(si."keywords")
JOIN "Unit" u ON u."id" = t."unitId" AND u."type" = 'TAG'
WHERE si."keywords" IS NOT NULL AND array_length(si."keywords", 1) > 0
ON CONFLICT DO NOTHING;

-- Drop old ShelfItem columns and legacy table
ALTER TABLE "ShelfItem"
  DROP COLUMN "itemUnitId",
  DROP COLUMN "sortOrder",
  DROP COLUMN "keywords",
  DROP COLUMN "label",
  DROP COLUMN "extra";

DROP TABLE "ShelfItemReview";

-- Drop User.keywords
ALTER TABLE "User" DROP COLUMN IF EXISTS "keywords";
