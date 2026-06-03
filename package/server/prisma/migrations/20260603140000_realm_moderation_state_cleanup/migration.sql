-- UnitRealm relation moderation state replaces the old feed-publication name.
ALTER TYPE "RealmFeedPublicationState" RENAME TO "UnitRealmModerationState";

ALTER TABLE "UnitRealm"
  RENAME COLUMN "state" TO "moderationState";

CREATE TYPE "UnitRealmVisibilityState" AS ENUM ('VISIBLE', 'HIDDEN', 'TOMBSTONED');

ALTER TABLE "UnitRealm"
  ADD COLUMN "visibilityState" "UnitRealmVisibilityState" NOT NULL DEFAULT 'VISIBLE',
  ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false;

UPDATE "UnitRealm" ur
SET
  "visibilityState" = CASE rcm."state"
    WHEN 'HIDDEN'::"ContentModerationStateKind" THEN 'HIDDEN'::"UnitRealmVisibilityState"
    WHEN 'TOMBSTONED'::"ContentModerationStateKind" THEN 'TOMBSTONED'::"UnitRealmVisibilityState"
    ELSE ur."visibilityState"
  END,
  "isLocked" = CASE rcm."state"
    WHEN 'LOCKED'::"ContentModerationStateKind" THEN true
    ELSE ur."isLocked"
  END
FROM "RealmContentModeration" rcm
WHERE rcm."realmUnitId" = ur."realmUnitId"
  AND rcm."moderatedUnitId" = ur."unitId";

DROP INDEX IF EXISTS "UnitRealm_realmUnitId_state_createdAt_idx";
CREATE INDEX "UnitRealm_realmUnitId_moderationState_visibilityState_create_idx"
  ON "UnitRealm"("realmUnitId", "moderationState", "visibilityState", "createdAt");
CREATE INDEX "UnitRealm_realmUnitId_moderationState_visibilityState_isLoc_idx"
  ON "UnitRealm"("realmUnitId", "moderationState", "visibilityState", "isLocked", "createdAt");

ALTER TABLE "RealmContentModeration" DROP CONSTRAINT IF EXISTS "RealmContentModeration_caseId_fkey";
ALTER TABLE "RealmContentModeration" DROP CONSTRAINT IF EXISTS "RealmContentModeration_realmUnitId_fkey";
ALTER TABLE "RealmContentModeration" DROP CONSTRAINT IF EXISTS "RealmContentModeration_moderatedUnitId_fkey";
ALTER TABLE "RealmContentModeration" DROP CONSTRAINT IF EXISTS "RealmContentModeration_decidedById_fkey";
DROP TABLE IF EXISTS "RealmContentModeration";

-- Narrow global Unit moderation to global visibility/removal states.
CREATE TYPE "ContentModerationStateKind_next" AS ENUM ('VISIBLE', 'HIDDEN', 'TOMBSTONED', 'REMOVED');
ALTER TABLE "ContentModerationState"
  ALTER COLUMN "state" DROP DEFAULT,
  ALTER COLUMN "state" TYPE "ContentModerationStateKind_next"
  USING CASE
    WHEN "state" = 'ARCHIVED'::"ContentModerationStateKind" THEN 'TOMBSTONED'::"ContentModerationStateKind_next"
    WHEN "state" = 'LOCKED'::"ContentModerationStateKind" THEN 'VISIBLE'::"ContentModerationStateKind_next"
    ELSE "state"::text::"ContentModerationStateKind_next"
  END,
  ALTER COLUMN "state" SET DEFAULT 'VISIBLE';
DROP TYPE "ContentModerationStateKind";
ALTER TYPE "ContentModerationStateKind_next" RENAME TO "ContentModerationStateKind";

-- Comments are lightweight rows. Existing Unit-backed comment ids become Comment.id.
ALTER TABLE "CommentPromotion" DROP CONSTRAINT IF EXISTS "CommentPromotion_commentUnitId_fkey";
ALTER TABLE "Comment" DROP CONSTRAINT IF EXISTS "Comment_unitId_fkey";
ALTER TABLE "Comment" DROP CONSTRAINT IF EXISTS "Comment_parentCommentUnitId_fkey";
ALTER TABLE "Comment" DROP CONSTRAINT IF EXISTS "Comment_realmUnitId_fkey";

ALTER TABLE "Comment" RENAME COLUMN "unitId" TO "id";
ALTER TABLE "Comment" RENAME COLUMN "parentCommentUnitId" TO "parentCommentId";
ALTER TABLE "Comment" ALTER COLUMN "realmUnitId" DROP NOT NULL;
ALTER TABLE "Comment" ADD COLUMN "visibilityState" "UnitRealmVisibilityState" NOT NULL DEFAULT 'VISIBLE';

ALTER INDEX IF EXISTS "Comment_rootUnitId_realmUnitId_parentCommentUnitId_createdA_idx"
  RENAME TO "Comment_rootUnitId_realmUnitId_parentCommentId_createdAt_idx";
ALTER INDEX IF EXISTS "Comment_parentCommentUnitId_createdAt_idx"
  RENAME TO "Comment_parentCommentId_createdAt_idx";

ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_realmUnitId_fkey"
  FOREIGN KEY ("realmUnitId") REFERENCES "Unit"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_parentCommentId_fkey"
  FOREIGN KEY ("parentCommentId") REFERENCES "Comment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "User"("unitId")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Comment_visibilityState_idx" ON "Comment"("visibilityState");

ALTER TABLE "CommentPromotion" RENAME COLUMN "commentUnitId" TO "commentId";
ALTER INDEX IF EXISTS "CommentPromotion_commentUnitId_idx" RENAME TO "CommentPromotion_commentId_idx";
ALTER TABLE "CommentPromotion"
  ADD CONSTRAINT "CommentPromotion_commentId_fkey"
  FOREIGN KEY ("commentId") REFERENCES "Comment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
