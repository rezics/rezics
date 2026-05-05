ALTER TABLE "Shelf" ADD COLUMN "itemCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "Shelf" AS s
SET "itemCount" = counts.count
FROM (
  SELECT "shelfUnitId", COUNT(*)::INTEGER AS count
  FROM "ShelfItem"
  GROUP BY "shelfUnitId"
) AS counts
WHERE s."unitId" = counts."shelfUnitId";
