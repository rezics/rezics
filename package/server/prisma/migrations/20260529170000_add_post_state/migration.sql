-- add-post-state-schema: generic, behaviorally-inert lifecycle label on Post.
-- Additive; no backfill — all existing posts keep state = NULL (no lifecycle).
-- The governing schema is snapshotted in extra.stateSchemaTag (JSON, no column).

-- AlterTable
ALTER TABLE "Post" ADD COLUMN "state" TEXT;

-- CreateIndex
-- Bucket filtering for lifecycle listings (state IN active|closed slugs),
-- scoped by rootTargetUnitId so target/realm feeds hit the index. No anti-join.
CREATE INDEX "Post_rootTargetUnitId_state_idx" ON "Post"("rootTargetUnitId", "state");
