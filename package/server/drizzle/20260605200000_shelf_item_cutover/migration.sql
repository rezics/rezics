ALTER TABLE "Shelf" ADD COLUMN IF NOT EXISTS "rootItemCount" integer DEFAULT 0 NOT NULL;

ALTER TABLE "ShelfUnit" RENAME TO "ShelfItem";
ALTER TABLE "ShelfItem" RENAME COLUMN "unitId" TO "itemId";

ALTER TABLE "ShelfItem" ADD COLUMN IF NOT EXISTS "itemType" varchar(32) DEFAULT 'unit' NOT NULL;
ALTER TABLE "ShelfItem" ADD COLUMN IF NOT EXISTS "parentItemType" varchar(32);
ALTER TABLE "ShelfItem" ADD COLUMN IF NOT EXISTS "parentItemId" uuid;
ALTER TABLE "ShelfItem" ADD COLUMN IF NOT EXISTS "parentRole" varchar(32);
ALTER TABLE "ShelfItem" ADD COLUMN IF NOT EXISTS "searchText" text;
ALTER TABLE "ShelfItem" ADD COLUMN IF NOT EXISTS "createdByUserId" uuid;

UPDATE "ShelfItem" si
SET "searchText" = uuc."searchText"
FROM "Shelf" s
JOIN "UserUnitCollection" uuc
  ON uuc."userId" = s."ownerUserId"
WHERE si."shelfId" = s."unitId"
  AND si."itemType" = 'unit'
  AND si."itemId" = uuc."unitId"
  AND uuc."searchText" IS NOT NULL;

UPDATE "ShelfItem" si
SET
  "parentItemType" = 'unit',
  "parentItemId" = rel."parentUnitId",
  "parentRole" = rel."role"
FROM "ShelfUnitRelation" rel
WHERE rel."shelfId" = si."shelfId"
  AND rel."childUnitId" = si."itemId";

DROP TABLE IF EXISTS "ShelfUnitRelation";
DROP TABLE IF EXISTS "UserUnitCollection";

DROP INDEX IF EXISTS "ShelfUnit_shelfId_position_idx";
DROP INDEX IF EXISTS "ShelfUnit_variantUnitId_idx";

ALTER TABLE "ShelfItem" DROP CONSTRAINT IF EXISTS "ShelfUnit_pkey";
ALTER TABLE "ShelfItem"
  ADD CONSTRAINT "ShelfItem_pkey" PRIMARY KEY ("shelfId", "itemType", "itemId");

ALTER TABLE "ShelfItem"
  ADD CONSTRAINT "ShelfItem_parent_fkey"
  FOREIGN KEY ("shelfId", "parentItemType", "parentItemId")
  REFERENCES "ShelfItem" ("shelfId", "itemType", "itemId")
  ON UPDATE cascade
  ON DELETE set null;

ALTER TABLE "ShelfItem"
  ADD CONSTRAINT "ShelfItem_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId")
  REFERENCES "User" ("unitId")
  ON UPDATE cascade
  ON DELETE set null;

ALTER TABLE "ShelfItem"
  ADD CONSTRAINT "ShelfItem_not_self_parent"
  CHECK ("parentItemId" IS NULL OR "parentItemId" <> "itemId" OR "parentItemType" <> "itemType");

CREATE INDEX IF NOT EXISTS "ShelfItem_shelfId_parent_position_idx"
  ON "ShelfItem" USING btree ("shelfId", "parentItemType", "parentItemId", "position");
CREATE INDEX IF NOT EXISTS "ShelfItem_shelfId_position_idx"
  ON "ShelfItem" USING btree ("shelfId", "position");
CREATE INDEX IF NOT EXISTS "ShelfItem_item_idx"
  ON "ShelfItem" USING btree ("itemType", "itemId");
CREATE INDEX IF NOT EXISTS "ShelfItem_variantUnitId_idx"
  ON "ShelfItem" USING btree ("variantUnitId");

UPDATE "Shelf" s
SET
  "itemCount" = counts.total_count,
  "rootItemCount" = counts.root_count
FROM (
  SELECT
    "shelfId",
    count(*)::integer AS total_count,
    count(*) FILTER (WHERE "parentItemId" IS NULL)::integer AS root_count
  FROM "ShelfItem"
  GROUP BY "shelfId"
) counts
WHERE counts."shelfId" = s."unitId";
