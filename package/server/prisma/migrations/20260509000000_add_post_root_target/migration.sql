-- AlterTable
ALTER TABLE "Post" ADD COLUMN "rootTargetUnitId" UUID,
ADD COLUMN "rootTargetUnitType" VARCHAR(32);

-- CreateIndex
CREATE INDEX "Post_rootTargetUnitId_createdAt_idx" ON "Post"("rootTargetUnitId", "createdAt");
