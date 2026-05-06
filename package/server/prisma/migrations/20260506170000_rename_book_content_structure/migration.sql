-- Development-stage breaking rename from BookIndex/chapterIndex/index to
-- BookContentStructure/contentStructure/nodes.
ALTER TABLE IF EXISTS "BookIndex" RENAME TO "BookContentStructure";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'BookContentStructure'
      AND column_name = 'index'
  ) THEN
    ALTER TABLE "BookContentStructure" RENAME COLUMN "index" TO "nodes";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'BookIndex_pkey'
      AND conrelid = '"BookContentStructure"'::regclass
  ) THEN
    ALTER TABLE "BookContentStructure" RENAME CONSTRAINT "BookIndex_pkey" TO "BookContentStructure_pkey";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'BookIndex_bookUnitId_fkey'
      AND conrelid = '"BookContentStructure"'::regclass
  ) THEN
    ALTER TABLE "BookContentStructure" RENAME CONSTRAINT "BookIndex_bookUnitId_fkey" TO "BookContentStructure_bookUnitId_fkey";
  END IF;
END $$;
