-- Shelf structure simplification migration.
--
-- This migration:
--   1. Adds the new ShelfItem columns (itemRef, kind, position, reviewIds, tagIds)
--   2. Backfills them from existing data
--   3. Drops old columns (itemUnitId, sortOrder, keywords, label, extra) and the
--      ShelfItem -> Unit FK
--   4. Drops the ShelfItemReview junction table (data moves into ShelfItem.reviewIds)
--   5. Drops User.keywords

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
  ADD COLUMN "position"  VARCHAR(64),
  ADD COLUMN "reviewIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  ADD COLUMN "tagIds"    UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];

-- Backfill itemRef = itemUnitId
UPDATE "ShelfItem" SET "itemRef" = "itemUnitId";

-- Backfill kind from Unit + Post
UPDATE "ShelfItem" si
SET "kind" = CASE
  WHEN u."type" = 'POST' AND p."kind" = 'REVIEW' THEN 'review'
  WHEN u."type" = 'POST' AND p."kind" = 'QUOTE'  THEN 'quote'
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

-- Backfill reviewIds from ShelfItemReview rows
UPDATE "ShelfItem" si
SET "reviewIds" = COALESCE(agg.ids, ARRAY[]::UUID[])
FROM (
  SELECT "shelfUnitId", "itemUnitId", ARRAY_AGG("reviewUnitId") AS ids
  FROM "ShelfItemReview"
  GROUP BY "shelfUnitId", "itemUnitId"
) agg
WHERE si."shelfUnitId" = agg."shelfUnitId"
  AND si."itemUnitId"  = agg."itemUnitId";

-- Backfill tagIds: resolve each legacy keywords string to a Tag unit via title match (English).
-- Unresolved entries are dropped silently.
UPDATE "ShelfItem" si
SET "tagIds" = COALESCE((
  SELECT ARRAY_AGG(DISTINCT u."id")
  FROM "Unit" u
  JOIN "UnitTranslation" t ON t."unitId" = u."id"
  WHERE u."type" = 'TAG'
    AND t."title" = ANY(si."keywords")
), ARRAY[]::UUID[]);

-- NOT NULL constraints on newly-backfilled columns
ALTER TABLE "ShelfItem"
  ALTER COLUMN "itemRef"  SET NOT NULL,
  ALTER COLUMN "kind"     SET NOT NULL,
  ALTER COLUMN "position" SET NOT NULL;

-- Replace composite primary key
ALTER TABLE "ShelfItem" DROP CONSTRAINT "ShelfItem_pkey";
ALTER TABLE "ShelfItem" ADD  CONSTRAINT "ShelfItem_pkey" PRIMARY KEY ("shelfUnitId", "itemRef");

-- Drop old ShelfItem columns
ALTER TABLE "ShelfItem"
  DROP COLUMN "itemUnitId",
  DROP COLUMN "sortOrder",
  DROP COLUMN "keywords",
  DROP COLUMN "label",
  DROP COLUMN "extra";

-- New indexes
CREATE INDEX "ShelfItem_itemRef_idx"           ON "ShelfItem"("itemRef");
CREATE INDEX "ShelfItem_shelfUnitId_position_idx" ON "ShelfItem"("shelfUnitId", "position");
CREATE INDEX "ShelfItem_reviewIds_idx"          ON "ShelfItem" USING GIN ("reviewIds");
CREATE INDEX "ShelfItem_tagIds_idx"             ON "ShelfItem" USING GIN ("tagIds");

-- Drop ShelfItemReview table
DROP TABLE "ShelfItemReview";

-- Drop User.keywords
ALTER TABLE "User" DROP COLUMN "keywords";
