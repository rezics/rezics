-- Rename ContentStructure ordering fields to the repository-wide `position`
-- vocabulary. Existing values are already lexicographic insert-between keys,
-- so this migration only renames columns and indexes.

ALTER TABLE "ContentStructureNode"
  RENAME COLUMN "sortKey" TO "position";

ALTER TABLE "ContentStructureAnchor"
  RENAME COLUMN "sortKey" TO "position";

ALTER TABLE "ContentStructureAnchor"
  RENAME COLUMN "sortPath" TO "positionPath";

ALTER INDEX "ContentStructureNode_ownerUnitId_parentId_sortKey_isDeleted_idx"
  RENAME TO "ContentStructureNode_ownerUnitId_parentId_position_isDeleted_idx";

ALTER INDEX "ContentStructureAnchor_ownerUnitId_sortPath_idx"
  RENAME TO "ContentStructureAnchor_ownerUnitId_positionPath_idx";

ALTER INDEX "ContentStructureAnchor_ownerUnitId_parentNodeId_sortKey_idx"
  RENAME TO "ContentStructureAnchor_ownerUnitId_parentNodeId_position_idx";
