DROP INDEX IF EXISTS "Post_targetUnitId_realmUnitId_createdAt_idx";

ALTER TABLE "Post" DROP CONSTRAINT IF EXISTS "Post_realmUnitId_fkey";

ALTER TABLE "Post" DROP COLUMN IF EXISTS "realmUnitId";
