CREATE TABLE "ContentStructureAnchor" (
  "nodeId" UUID NOT NULL,
  "ownerUnitId" UUID NOT NULL,
  "contentUnitId" UUID NOT NULL,
  "parentNodeId" UUID,
  "ancestorNodeIds" JSONB NOT NULL,
  "path" JSONB NOT NULL,
  "depth" INTEGER NOT NULL,
  "sortKey" TEXT NOT NULL,
  "sortPath" TEXT NOT NULL,
  "titlePath" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ContentStructureAnchor_pkey" PRIMARY KEY ("nodeId")
);

CREATE INDEX "ContentStructureAnchor_ownerUnitId_sortPath_idx"
  ON "ContentStructureAnchor"("ownerUnitId", "sortPath");

CREATE INDEX "ContentStructureAnchor_contentUnitId_ownerUnitId_idx"
  ON "ContentStructureAnchor"("contentUnitId", "ownerUnitId");

CREATE INDEX "ContentStructureAnchor_ownerUnitId_parentNodeId_sortKey_idx"
  ON "ContentStructureAnchor"("ownerUnitId", "parentNodeId", "sortKey");

CREATE INDEX "ContentStructureAnchor_ownerUnitId_depth_idx"
  ON "ContentStructureAnchor"("ownerUnitId", "depth");

ALTER TABLE "ContentStructureAnchor"
  ADD CONSTRAINT "ContentStructureAnchor_ownerUnitId_fkey"
  FOREIGN KEY ("ownerUnitId") REFERENCES "ContentStructure"("ownerUnitId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentStructureAnchor"
  ADD CONSTRAINT "ContentStructureAnchor_nodeId_fkey"
  FOREIGN KEY ("nodeId") REFERENCES "ContentStructureNode"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentStructureAnchor"
  ADD CONSTRAINT "ContentStructureAnchor_contentUnitId_fkey"
  FOREIGN KEY ("contentUnitId") REFERENCES "Unit"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

WITH RECURSIVE tree AS (
  SELECT
    n."id",
    n."ownerUnitId",
    n."parentId",
    n."sortKey",
    n."contentUnitId",
    n."title",
    ARRAY[]::uuid[] AS "ancestorNodeIds",
    ARRAY[n."id"] AS "pathNodeIds",
    ARRAY[n."title"] AS "titlePath",
    0 AS "depth",
    n."sortKey"::text AS "sortPath"
  FROM "ContentStructureNode" n
  WHERE n."parentId" IS NULL
    AND n."isDeleted" = false

  UNION ALL

  SELECT
    child."id",
    child."ownerUnitId",
    child."parentId",
    child."sortKey",
    child."contentUnitId",
    child."title",
    tree."pathNodeIds" AS "ancestorNodeIds",
    tree."pathNodeIds" || child."id" AS "pathNodeIds",
    tree."titlePath" || child."title" AS "titlePath",
    tree."depth" + 1 AS "depth",
    tree."sortPath" || '.' || child."sortKey" AS "sortPath"
  FROM "ContentStructureNode" child
  JOIN tree ON tree."id" = child."parentId"
  WHERE child."isDeleted" = false
)
INSERT INTO "ContentStructureAnchor" (
  "nodeId",
  "ownerUnitId",
  "contentUnitId",
  "parentNodeId",
  "ancestorNodeIds",
  "path",
  "depth",
  "sortKey",
  "sortPath",
  "titlePath",
  "updatedAt"
)
SELECT
  tree."id",
  tree."ownerUnitId",
  tree."contentUnitId",
  tree."parentId",
  to_jsonb(tree."ancestorNodeIds"::text[]),
  to_jsonb(tree."pathNodeIds"::text[]),
  tree."depth",
  tree."sortKey",
  tree."sortPath",
  to_jsonb(tree."titlePath"),
  now()
FROM tree
WHERE tree."contentUnitId" IS NOT NULL;
