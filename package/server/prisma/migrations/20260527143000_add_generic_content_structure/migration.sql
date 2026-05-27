-- Generic content-structure storage.
-- Existing BookContentStructure rows are copied forward so live code can cut
-- over without dropping the compatibility tables in the same migration.

CREATE TABLE "ContentStructure" (
  "ownerUnitId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ContentStructure_pkey" PRIMARY KEY ("ownerUnitId")
);

CREATE TABLE "ContentStructureNode" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "ownerUnitId" UUID NOT NULL,
  "parentId" UUID,
  "sortKey" TEXT NOT NULL,
  "contentUnitId" UUID,
  "title" TEXT NOT NULL,
  "noContent" BOOLEAN NOT NULL DEFAULT false,
  "rating" "ContentRating",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ContentStructureNode_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ContentStructure" ("ownerUnitId", "createdAt", "updatedAt")
SELECT "bookUnitId", "createdAt", "updatedAt"
FROM "BookContentStructure"
ON CONFLICT ("ownerUnitId") DO UPDATE
SET
  "createdAt" = EXCLUDED."createdAt",
  "updatedAt" = EXCLUDED."updatedAt";

INSERT INTO "ContentStructureNode" (
  "id",
  "ownerUnitId",
  "parentId",
  "sortKey",
  "contentUnitId",
  "title",
  "noContent",
  "rating",
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  "bookUnitId",
  "parentId",
  "sortKey",
  "chapterUnitId",
  "title",
  "noContent",
  "rating",
  "createdAt",
  "updatedAt"
FROM "BookContentStructureNode"
ON CONFLICT ("id") DO UPDATE
SET
  "ownerUnitId" = EXCLUDED."ownerUnitId",
  "parentId" = EXCLUDED."parentId",
  "sortKey" = EXCLUDED."sortKey",
  "contentUnitId" = EXCLUDED."contentUnitId",
  "title" = EXCLUDED."title",
  "noContent" = EXCLUDED."noContent",
  "rating" = EXCLUDED."rating",
  "createdAt" = EXCLUDED."createdAt",
  "updatedAt" = EXCLUDED."updatedAt";

CREATE INDEX "ContentStructure_updatedAt_idx" ON "ContentStructure"("updatedAt" DESC);
CREATE INDEX "ContentStructureNode_ownerUnitId_parentId_sortKey_idx" ON "ContentStructureNode"("ownerUnitId", "parentId", "sortKey");
CREATE INDEX "ContentStructureNode_contentUnitId_idx" ON "ContentStructureNode"("contentUnitId");
CREATE INDEX "ContentStructureNode_ownerUnitId_updatedAt_idx" ON "ContentStructureNode"("ownerUnitId", "updatedAt" DESC);

ALTER TABLE "ContentStructure"
  ADD CONSTRAINT "ContentStructure_ownerUnitId_fkey"
  FOREIGN KEY ("ownerUnitId") REFERENCES "Unit"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentStructureNode"
  ADD CONSTRAINT "ContentStructureNode_ownerUnitId_fkey"
  FOREIGN KEY ("ownerUnitId") REFERENCES "ContentStructure"("ownerUnitId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentStructureNode"
  ADD CONSTRAINT "ContentStructureNode_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "ContentStructureNode"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentStructureNode"
  ADD CONSTRAINT "ContentStructureNode_contentUnitId_fkey"
  FOREIGN KEY ("contentUnitId") REFERENCES "Unit"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

DO $$
DECLARE
  mismatch_count integer;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM (
    SELECT
      b."id",
      b."bookUnitId",
      b."parentId",
      b."sortKey",
      b."chapterUnitId",
      b."title",
      b."noContent",
      b."rating",
      b."createdAt",
      b."updatedAt"
    FROM "BookContentStructureNode" b
    EXCEPT
    SELECT
      g."id",
      g."ownerUnitId",
      g."parentId",
      g."sortKey",
      g."contentUnitId",
      g."title",
      g."noContent",
      g."rating",
      g."createdAt",
      g."updatedAt"
    FROM "ContentStructureNode" g
  ) diff;

  IF mismatch_count <> 0 THEN
    RAISE EXCEPTION 'ContentStructure backfill parity failed: % mismatched rows', mismatch_count;
  END IF;
END $$;
