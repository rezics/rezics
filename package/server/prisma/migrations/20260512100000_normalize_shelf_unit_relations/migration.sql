-- Normalize shelf containment and relations:
--   ShelfItem        -> ShelfUnit          (columns: shelfUnitId->shelfId, itemRef->unitId)
--   ShelfItemUnit    -> ShelfUnitRelation  (columns: shelfUnitId->shelfId, itemRef->parentUnitId, unitId->childUnitId)
-- Drop redundant role='primary' rows; create missing child ShelfUnit rows for review/tag children.

BEGIN;

-- 1. Drop existing FK constraints on ShelfItemUnit (we'll rebuild them against ShelfUnit).
ALTER TABLE "ShelfItemUnit" DROP CONSTRAINT IF EXISTS "ShelfItemUnit_shelfUnitId_fkey";
ALTER TABLE "ShelfItemUnit" DROP CONSTRAINT IF EXISTS "ShelfItemUnit_shelfUnitId_itemRef_fkey";
ALTER TABLE "ShelfItemUnit" DROP CONSTRAINT IF EXISTS "ShelfItemUnit_unitId_fkey";

-- 2. Drop redundant 'primary' rows. Containment is now represented by ShelfUnit itself.
DELETE FROM "ShelfItemUnit" WHERE "role" = 'primary';

-- 3. Rename ShelfItem -> ShelfUnit and its columns.
ALTER TABLE "ShelfItem" RENAME TO "ShelfUnit";
ALTER TABLE "ShelfUnit" RENAME COLUMN "shelfUnitId" TO "shelfId";
ALTER TABLE "ShelfUnit" RENAME COLUMN "itemRef" TO "unitId";
ALTER INDEX "ShelfItem_pkey" RENAME TO "ShelfUnit_pkey";
ALTER INDEX "ShelfItem_shelfUnitId_position_idx" RENAME TO "ShelfUnit_shelfId_position_idx";
ALTER TABLE "ShelfUnit" RENAME CONSTRAINT "ShelfItem_shelfUnitId_fkey" TO "ShelfUnit_shelfId_fkey";

-- 4. Rename ShelfItemUnit -> ShelfUnitRelation and its columns. Drop stale indexes and PK.
ALTER TABLE "ShelfItemUnit" RENAME TO "ShelfUnitRelation";
ALTER TABLE "ShelfUnitRelation" RENAME COLUMN "shelfUnitId" TO "shelfId";
ALTER TABLE "ShelfUnitRelation" RENAME COLUMN "itemRef" TO "parentUnitId";
ALTER TABLE "ShelfUnitRelation" RENAME COLUMN "unitId" TO "childUnitId";
ALTER INDEX "ShelfItemUnit_pkey" RENAME TO "ShelfUnitRelation_pkey";
DROP INDEX IF EXISTS "ShelfItemUnit_unitId_idx";
DROP INDEX IF EXISTS "ShelfItemUnit_unitId_role_idx";
DROP INDEX IF EXISTS "ShelfItemUnit_shelfUnitId_role_idx";

-- 5. Ensure a ShelfUnit row exists for every (shelfId, childUnitId) referenced by a relation.
-- Place new children deterministically between their representative parent's position and the
-- next root's position. We approximate the design.md keyBetween rule by emitting a suffix-based
-- slot so children sort immediately after their parent. Determinism: order by role then unitId.
WITH child_rows AS (
  SELECT DISTINCT "shelfId", "childUnitId"
  FROM "ShelfUnitRelation"
),
needs_new AS (
  SELECT cr."shelfId", cr."childUnitId"
  FROM child_rows cr
  WHERE NOT EXISTS (
    SELECT 1 FROM "ShelfUnit" su
    WHERE su."shelfId" = cr."shelfId" AND su."unitId" = cr."childUnitId"
  )
),
representative AS (
  SELECT
    nn."shelfId",
    nn."childUnitId",
    MIN(rel."parentUnitId" || '|' || rel."role") AS "tie",
    (ARRAY_AGG(rel."parentUnitId" ORDER BY rel."role", rel."parentUnitId"))[1] AS "parentUnitId",
    (ARRAY_AGG(rel."role" ORDER BY rel."role", rel."parentUnitId"))[1] AS "role"
  FROM needs_new nn
  JOIN "ShelfUnitRelation" rel
    ON rel."shelfId" = nn."shelfId" AND rel."childUnitId" = nn."childUnitId"
  GROUP BY nn."shelfId", nn."childUnitId"
),
with_meta AS (
  SELECT
    r."shelfId",
    r."childUnitId",
    r."parentUnitId",
    r."role",
    p_su."position" AS "parentPosition",
    CASE
      WHEN u."type" = 'POST' AND p."kind" = 'REVIEW'  THEN 'review'
      WHEN u."type" = 'POST' AND p."kind" = 'EXCERPT' THEN 'quote'
      WHEN u."type" = 'POST' AND p."kind" = 'CHAPTER' THEN 'chapter'
      WHEN u."type" = 'POST'                          THEN 'post'
      WHEN u."type" = 'TAG'                           THEN 'tag'
      WHEN u."type" = 'BOOK'                          THEN 'book'
      WHEN u."type" = 'SHELF'                         THEN 'shelf'
      WHEN u."type" = 'LINK'                          THEN 'link'
      WHEN u."type" = 'GAME'                          THEN 'game'
      WHEN u."type" = 'MEDIA'                         THEN 'media'
      WHEN u."type" = 'IMAGE'                         THEN 'image'
      WHEN u."type" = 'VIDEO'                         THEN 'video'
      ELSE LOWER(u."type"::text)
    END AS "kind"
  FROM representative r
  LEFT JOIN "Unit" u  ON u."id" = r."childUnitId"
  LEFT JOIN "Post" p  ON p."unitId" = r."childUnitId"
  LEFT JOIN "ShelfUnit" p_su
    ON p_su."shelfId" = r."shelfId" AND p_su."unitId" = r."parentUnitId"
)
INSERT INTO "ShelfUnit" ("shelfId", "unitId", "kind", "position", "createdAt", "updatedAt")
SELECT
  wm."shelfId",
  wm."childUnitId",
  COALESCE(wm."kind", 'post'),
  COALESCE(wm."parentPosition", 'm0')
    || 'a'
    || LPAD(
         (ROW_NUMBER() OVER (
            PARTITION BY wm."shelfId", wm."parentUnitId"
            ORDER BY wm."role", wm."childUnitId"
         ))::text,
         5, '0'
       ),
  NOW(),
  NOW()
FROM with_meta wm
ON CONFLICT DO NOTHING;

-- 6. Recreate FK constraints on ShelfUnitRelation. Parent and child both reference ShelfUnit.
ALTER TABLE "ShelfUnitRelation"
  ADD CONSTRAINT "ShelfUnitRelation_shelfId_fkey"
  FOREIGN KEY ("shelfId") REFERENCES "Shelf"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShelfUnitRelation"
  ADD CONSTRAINT "ShelfUnitRelation_shelfId_parentUnitId_fkey"
  FOREIGN KEY ("shelfId", "parentUnitId") REFERENCES "ShelfUnit"("shelfId", "unitId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShelfUnitRelation"
  ADD CONSTRAINT "ShelfUnitRelation_shelfId_childUnitId_fkey"
  FOREIGN KEY ("shelfId", "childUnitId") REFERENCES "ShelfUnit"("shelfId", "unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. Recreate indexes on ShelfUnitRelation for graph reads.
CREATE INDEX "ShelfUnitRelation_shelfId_parentUnitId_role_idx"
  ON "ShelfUnitRelation" ("shelfId", "parentUnitId", "role");
CREATE INDEX "ShelfUnitRelation_shelfId_childUnitId_idx"
  ON "ShelfUnitRelation" ("shelfId", "childUnitId");
CREATE INDEX "ShelfUnitRelation_childUnitId_role_idx"
  ON "ShelfUnitRelation" ("childUnitId", "role");
CREATE INDEX "ShelfUnitRelation_parentUnitId_role_idx"
  ON "ShelfUnitRelation" ("parentUnitId", "role");

-- 8. Recompute Shelf.itemCount to match new ShelfUnit count.
UPDATE "Shelf" s
SET "itemCount" = COALESCE(
  (SELECT COUNT(*)::int FROM "ShelfUnit" su WHERE su."shelfId" = s."unitId"),
  0
);

COMMIT;
