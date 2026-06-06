DROP INDEX IF EXISTS "Comment_path_gist_idx";--> statement-breakpoint
ALTER TABLE "Comment" DROP COLUMN IF EXISTS "path";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Comment_rootUnitId_realmUnitId_parentCommentId_createdAt_id_idx" ON "Comment" USING btree ("rootUnitId","realmUnitId","parentCommentId","createdAt","id");
