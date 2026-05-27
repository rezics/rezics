-- Legacy book-specific content-structure tables were backfilled into
-- ContentStructure / ContentStructureNode in 20260527143000.
-- Drop the old storage tables after the generic service cutover.

DROP TABLE "BookContentStructureNode";
DROP TABLE "BookContentStructure";
