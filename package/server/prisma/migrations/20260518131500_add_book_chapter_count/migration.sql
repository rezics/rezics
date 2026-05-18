-- AlterTable
ALTER TABLE "Book" ADD COLUMN "chapterCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill existing books from readable content-structure node occurrences.
UPDATE "Book" AS b
SET "chapterCount" = counts."chapterCount"
FROM (
    SELECT "bookUnitId", COUNT(*)::INTEGER AS "chapterCount"
    FROM "BookContentStructureNode"
    WHERE "noContent" = false
    GROUP BY "bookUnitId"
) AS counts
WHERE b."unitId" = counts."bookUnitId";
