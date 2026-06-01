-- Drop legacy Post tree columns now that replies live in Comment.
-- Post rows are root submissions only; Comment owns discussion topology.

DO $$
DECLARE
  bad integer;
BEGIN
  SELECT count(*) INTO bad
  FROM "Post"
  WHERE "parentPostUnitId" IS NOT NULL
     OR "depth" <> 0
     OR ("rootPostUnitId" IS NOT NULL AND "rootPostUnitId" <> "unitId");

  IF bad > 0 THEN
    RAISE EXCEPTION 'cannot drop Post tree residue: % non-root Post row(s) remain', bad;
  END IF;

  SELECT count(*) INTO bad
  FROM information_schema.columns
  WHERE table_schema = current_schema()
    AND table_name <> 'Unit'
    AND column_name = 'targetUnitId';

  IF bad > 0 THEN
    RAISE EXCEPTION 'generic targetUnitId remains on % non-Unit table column(s)', bad;
  END IF;
END $$;

DROP INDEX IF EXISTS "Post_rootPostUnitId_createdAt_idx";
DROP INDEX IF EXISTS "Post_parentPostUnitId_createdAt_idx";
DROP INDEX IF EXISTS "Post_path_gist_idx";

ALTER TABLE "Post" DROP CONSTRAINT IF EXISTS "Post_rootPostUnitId_fkey";
ALTER TABLE "Post" DROP CONSTRAINT IF EXISTS "Post_parentPostUnitId_fkey";

ALTER TABLE "Post"
  DROP COLUMN IF EXISTS "rootPostUnitId",
  DROP COLUMN IF EXISTS "parentPostUnitId",
  DROP COLUMN IF EXISTS "depth",
  DROP COLUMN IF EXISTS "path";
