-- shelf-redesign: Schema changes
-- 1. Add LINK to UnitType enum
-- 2. Create Link extension table
-- 3. Add keywords to ShelfItem, remove reviewPostUnitId
-- 4. Create ShelfItemReview junction table
-- 5. Add keywords to User
-- 6. Drop Bookmark table

-- 1. Add LINK to UnitType enum
ALTER TYPE "UnitType" ADD VALUE 'LINK';

-- 2. Create Link extension table
CREATE TABLE "Link" (
    "unitId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "siteName" VARCHAR(128),
    "faviconUrl" TEXT,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Link_pkey" PRIMARY KEY ("unitId")
);

ALTER TABLE "Link" ADD CONSTRAINT "Link_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. ShelfItem: add keywords column
ALTER TABLE "ShelfItem" ADD COLUMN "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 4. Create ShelfItemReview junction table
CREATE TABLE "ShelfItemReview" (
    "shelfUnitId" UUID NOT NULL,
    "itemUnitId" UUID NOT NULL,
    "reviewUnitId" UUID NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShelfItemReview_pkey" PRIMARY KEY ("shelfUnitId","itemUnitId","reviewUnitId")
);

CREATE INDEX "ShelfItemReview_reviewUnitId_idx" ON "ShelfItemReview"("reviewUnitId");

ALTER TABLE "ShelfItemReview" ADD CONSTRAINT "ShelfItemReview_shelfUnitId_itemUnitId_fkey"
    FOREIGN KEY ("shelfUnitId", "itemUnitId") REFERENCES "ShelfItem"("shelfUnitId", "itemUnitId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShelfItemReview" ADD CONSTRAINT "ShelfItemReview_reviewUnitId_fkey"
    FOREIGN KEY ("reviewUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Migrate reviewPostUnitId data to ShelfItemReview before dropping
INSERT INTO "ShelfItemReview" ("shelfUnitId", "itemUnitId", "reviewUnitId", "addedAt")
SELECT "shelfUnitId", "itemUnitId", "reviewPostUnitId", "createdAt"
FROM "ShelfItem"
WHERE "reviewPostUnitId" IS NOT NULL;

-- 6. Drop reviewPostUnitId column from ShelfItem
ALTER TABLE "ShelfItem" DROP CONSTRAINT IF EXISTS "ShelfItem_reviewPostUnitId_fkey";
ALTER TABLE "ShelfItem" DROP COLUMN "reviewPostUnitId";

-- 7. Add keywords to User
ALTER TABLE "User" ADD COLUMN "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 8. Migrate Bookmarks to Favorites shelves
-- 8a. Create a Favorites shelf (Unit + Shelf) for every user who has bookmarks
-- Uses uuidv7() for deterministic ordering
INSERT INTO "Unit" ("id", "type", "userId", "status", "visibility", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'SHELF'::"UnitType", u."unitId", 'PUBLISHED'::"UnitStatus", 'PRIVATE'::"UnitVisibility", NOW(), NOW()
FROM "User" u
WHERE EXISTS (SELECT 1 FROM "Bookmark" b WHERE b."userId" = u."unitId");

-- Create the Shelf extension for each new shelf unit
INSERT INTO "Shelf" ("unitId", "kindKey", "createdAt", "updatedAt")
SELECT u."id", 'favorites', NOW(), NOW()
FROM "Unit" u
WHERE u."type" = 'SHELF'::"UnitType"
  AND u."visibility" = 'PRIVATE'::"UnitVisibility"
  AND NOT EXISTS (SELECT 1 FROM "Shelf" s WHERE s."unitId" = u."id");

-- Create UnitTranslation for each favorites shelf
INSERT INTO "UnitTranslation" ("unitId", "language", "title", "createdAt", "updatedAt")
SELECT s."unitId", 'en', 'Favorites', NOW(), NOW()
FROM "Shelf" s
WHERE s."kindKey" = 'favorites'
  AND NOT EXISTS (SELECT 1 FROM "UnitTranslation" ut WHERE ut."unitId" = s."unitId" AND ut."language" = 'en');

-- 8b. Migrate Bookmark rows to ShelfItems in user's Favorites shelf
INSERT INTO "ShelfItem" ("shelfUnitId", "itemUnitId", "sortOrder", "keywords", "createdAt", "updatedAt")
SELECT
    shelf_unit."id" AS "shelfUnitId",
    b."targetId" AS "itemUnitId",
    ROW_NUMBER() OVER (PARTITION BY b."userId" ORDER BY b."createdAt") AS "sortOrder",
    b."tags" AS "keywords",
    b."createdAt",
    b."updatedAt"
FROM "Bookmark" b
JOIN "Unit" shelf_unit ON shelf_unit."userId" = b."userId"
    AND shelf_unit."type" = 'SHELF'::"UnitType"
    AND shelf_unit."visibility" = 'PRIVATE'::"UnitVisibility"
JOIN "Shelf" s ON s."unitId" = shelf_unit."id" AND s."kindKey" = 'favorites';

-- 8c. Merge bookmark tags into User.keywords (deduplicated)
UPDATE "User" u
SET "keywords" = (
    SELECT ARRAY(
        SELECT DISTINCT unnest(array_agg(tag))
        FROM (
            SELECT unnest(b."tags") AS tag
            FROM "Bookmark" b
            WHERE b."userId" = u."unitId"
        ) sub
    )
)
WHERE EXISTS (
    SELECT 1 FROM "Bookmark" b
    WHERE b."userId" = u."unitId" AND array_length(b."tags", 1) > 0
);

-- 9. Drop Bookmark table
DROP TABLE "Bookmark";
