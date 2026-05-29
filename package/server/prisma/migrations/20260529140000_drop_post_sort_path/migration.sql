-- Drop the legacy `Post.sortPath` materialized-path column and its indexes,
-- now that all code reads/writes the native `ltree` `Post.path` column added in
-- `20260529130000_manual_redesign_post_ltree_index`. Sequenced after the code
-- cutover so that rollback before this point is code-only.

-- DropIndex
DROP INDEX IF EXISTS "Post_targetUnitId_sortPath_idx";

-- DropIndex
DROP INDEX IF EXISTS "Post_rootPostUnitId_sortPath_idx";

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "sortPath";
