ALTER TYPE "UnitType" ADD VALUE IF NOT EXISTS 'COMMENT';

CREATE TABLE "Comment" (
    "unitId" UUID NOT NULL,
    "rootUnitId" UUID NOT NULL,
    "realmUnitId" UUID NOT NULL,
    "parentCommentUnitId" UUID,
    "authorUserId" UUID NOT NULL,
    "content" JSONB,
    "depth" INTEGER NOT NULL DEFAULT 1,
    "path" ltree,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "directReplyCount" INTEGER NOT NULL DEFAULT 0,
    "lastReplyAt" TIMESTAMP(3),
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("unitId")
);

CREATE INDEX "Comment_rootUnitId_realmUnitId_createdAt_idx"
    ON "Comment"("rootUnitId", "realmUnitId", "createdAt");

CREATE INDEX "Comment_rootUnitId_realmUnitId_parentCommentUnitId_createdA_idx"
    ON "Comment"("rootUnitId", "realmUnitId", "parentCommentUnitId", "createdAt");

CREATE INDEX "Comment_parentCommentUnitId_createdAt_idx"
    ON "Comment"("parentCommentUnitId", "createdAt");

CREATE INDEX "Comment_authorUserId_createdAt_idx"
    ON "Comment"("authorUserId", "createdAt");

CREATE INDEX "Comment_state_idx" ON "Comment"("state");

CREATE INDEX "Comment_path_gist_idx" ON "Comment" USING GIST ("path");

ALTER TABLE "Comment"
    ADD CONSTRAINT "Comment_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Comment"
    ADD CONSTRAINT "Comment_rootUnitId_fkey"
    FOREIGN KEY ("rootUnitId") REFERENCES "Unit"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Comment"
    ADD CONSTRAINT "Comment_realmUnitId_fkey"
    FOREIGN KEY ("realmUnitId") REFERENCES "Unit"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Comment"
    ADD CONSTRAINT "Comment_parentCommentUnitId_fkey"
    FOREIGN KEY ("parentCommentUnitId") REFERENCES "Unit"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
