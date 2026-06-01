-- Rename persisted non-Unit target endpoints so `targetUnitId` remains reserved
-- for the canonical weak Unit edge on the Unit table.

ALTER TABLE "Subscription"
  RENAME COLUMN "targetUnitId" TO "subscribedUnitId";
ALTER INDEX IF EXISTS "Subscription_targetUnitId_idx"
  RENAME TO "Subscription_subscribedUnitId_idx";
ALTER INDEX IF EXISTS "Subscription_subscriberUnitId_targetUnitId_key"
  RENAME TO "Subscription_subscriberUnitId_subscribedUnitId_key";
ALTER TABLE "Subscription"
  RENAME CONSTRAINT "Subscription_targetUnitId_fkey" TO "Subscription_subscribedUnitId_fkey";

ALTER TABLE "ModerationCase"
  RENAME COLUMN "targetUnitId" TO "addressedUnitId";
ALTER INDEX IF EXISTS "ModerationCase_targetUnitId_state_idx"
  RENAME TO "ModerationCase_addressedUnitId_state_idx";
ALTER TABLE "ModerationCase"
  RENAME CONSTRAINT "ModerationCase_targetUnitId_fkey" TO "ModerationCase_addressedUnitId_fkey";

ALTER TABLE "RealmModerationQueueItem"
  RENAME COLUMN "targetUnitId" TO "addressedUnitId";
ALTER INDEX IF EXISTS "RealmModerationQueueItem_targetUnitId_state_idx"
  RENAME TO "RealmModerationQueueItem_addressedUnitId_state_idx";
ALTER TABLE "RealmModerationQueueItem"
  RENAME CONSTRAINT "RealmModerationQueueItem_targetUnitId_fkey" TO "RealmModerationQueueItem_addressedUnitId_fkey";

ALTER TABLE "ContentModerationState"
  RENAME COLUMN "targetUnitId" TO "moderatedUnitId";
ALTER TABLE "ContentModerationState"
  RENAME CONSTRAINT "ContentModerationState_targetUnitId_fkey" TO "ContentModerationState_moderatedUnitId_fkey";

ALTER TABLE "RealmContentModeration"
  RENAME COLUMN "targetUnitId" TO "moderatedUnitId";
ALTER INDEX IF EXISTS "RealmContentModeration_targetUnitId_state_idx"
  RENAME TO "RealmContentModeration_moderatedUnitId_state_idx";
ALTER TABLE "RealmContentModeration"
  RENAME CONSTRAINT "RealmContentModeration_targetUnitId_fkey" TO "RealmContentModeration_moderatedUnitId_fkey";
