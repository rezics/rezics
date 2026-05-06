-- Development-stage breaking rename from BookIndex/chapterIndex/index to
-- BookContentStructure/contentStructure/nodes.
ALTER TABLE IF EXISTS "BookIndex" RENAME TO "BookContentStructure";
ALTER TABLE IF EXISTS "BookContentStructure" RENAME COLUMN "index" TO "nodes";
ALTER TABLE IF EXISTS "BookContentStructure" RENAME CONSTRAINT "BookIndex_pkey" TO "BookContentStructure_pkey";
ALTER TABLE IF EXISTS "BookContentStructure" RENAME CONSTRAINT "BookIndex_bookUnitId_fkey" TO "BookContentStructure_bookUnitId_fkey";
