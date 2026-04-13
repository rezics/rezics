-- AlterEnum: Remove COMMENT from PostKind
-- Note: Existing rows with kind='COMMENT' are NOT affected.
-- They remain in the database but new posts cannot use this value.

-- Update any existing COMMENT posts to POST before removing the enum value
UPDATE "Post" SET "kind" = 'POST' WHERE "kind" = 'COMMENT';

-- Remove the COMMENT value from the PostKind enum
ALTER TYPE "PostKind" RENAME TO "PostKind_old";
CREATE TYPE "PostKind" AS ENUM ('REVIEW', 'QUOTE', 'REMARK', 'POST');
ALTER TABLE "Post" ALTER COLUMN "kind" TYPE "PostKind" USING ("kind"::text::"PostKind");
DROP TYPE "PostKind_old";
