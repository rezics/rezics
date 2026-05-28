-- ContentStructureNode: add soft-delete fields and reindex
ALTER TABLE "ContentStructureNode" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContentStructureNode" ADD COLUMN "deletedAt" TIMESTAMP(3);

DROP INDEX "ContentStructureNode_ownerUnitId_parentId_sortKey_idx";
CREATE INDEX "ContentStructureNode_ownerUnitId_parentId_sortKey_isDeleted_idx" ON "ContentStructureNode"("ownerUnitId", "parentId", "sortKey", "isDeleted");
CREATE INDEX "ContentStructureNode_ownerUnitId_isDeleted_updatedAt_idx" ON "ContentStructureNode"("ownerUnitId", "isDeleted", "updatedAt" DESC);

-- UserUnitProgress: replace lastPosition JSON with lastReadNodeId FK + lastReadAnchor JSON
ALTER TABLE "UserUnitProgress" DROP COLUMN "lastPosition";
ALTER TABLE "UserUnitProgress" ADD COLUMN "lastReadNodeId" UUID;
ALTER TABLE "UserUnitProgress" ADD COLUMN "lastReadAnchor" JSONB;

CREATE INDEX "UserUnitProgress_lastReadNodeId_idx" ON "UserUnitProgress"("lastReadNodeId");

ALTER TABLE "UserUnitProgress"
  ADD CONSTRAINT "UserUnitProgress_lastReadNodeId_fkey"
  FOREIGN KEY ("lastReadNodeId") REFERENCES "ContentStructureNode"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- UserContentNodeProgress: per-(user, node) manual completion marks
CREATE TABLE "UserContentNodeProgress" (
    "userId" UUID NOT NULL,
    "nodeId" UUID NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserContentNodeProgress_pkey" PRIMARY KEY ("userId", "nodeId")
);

CREATE INDEX "UserContentNodeProgress_nodeId_idx" ON "UserContentNodeProgress"("nodeId");

ALTER TABLE "UserContentNodeProgress"
  ADD CONSTRAINT "UserContentNodeProgress_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("unitId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserContentNodeProgress"
  ADD CONSTRAINT "UserContentNodeProgress_nodeId_fkey"
  FOREIGN KEY ("nodeId") REFERENCES "ContentStructureNode"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
