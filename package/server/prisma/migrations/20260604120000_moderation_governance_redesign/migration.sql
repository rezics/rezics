-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('APPROVED', 'PENDING', 'REMOVED');

-- CreateEnum
CREATE TYPE "ModerationScope" AS ENUM ('PLATFORM', 'REALM');

-- CreateEnum
CREATE TYPE "ModerationTargetKind" AS ENUM ('UNIT', 'UNIT_REALM', 'COMMENT', 'UNIT_FIELD', 'ACCOUNT', 'REALM_MEMBER', 'FEEDBACK');

-- CreateEnum
CREATE TYPE "ModerationAuthority" AS ENUM ('PLATFORM', 'REALM', 'OWNER');

-- CreateEnum
CREATE TYPE "ModerationActorKind" AS ENUM ('USER', 'SYSTEM', 'AUTOMATION', 'IMPORT');

-- CreateEnum
CREATE TYPE "ModerationActionKind" AS ENUM ('APPROVE', 'REMOVE', 'RESTORE', 'LOCK', 'UNLOCK', 'FIELD_LOCK', 'FIELD_UNLOCK', 'WARNING', 'SILENCE', 'SUSPENSION', 'BAN', 'RATE_LIMIT', 'TRUST_RESTRICTION', 'REVOKE_ENFORCEMENT', 'MUTE_MEMBER', 'REMOVE_MEMBER', 'BAN_MEMBER', 'RESTORE_MEMBER', 'ESCALATE', 'REVERSE', 'NOTE');

-- AlterEnum
ALTER TYPE "ModerationCaseState" ADD VALUE 'REVIEWING';

-- DropForeignKey
ALTER TABLE "ContentModerationState" DROP CONSTRAINT "ContentModerationState_caseId_fkey";

-- DropForeignKey
ALTER TABLE "ContentModerationState" DROP CONSTRAINT "ContentModerationState_decidedById_fkey";

-- DropForeignKey
ALTER TABLE "ContentModerationState" DROP CONSTRAINT "ContentModerationState_moderatedUnitId_fkey";

-- DropForeignKey
ALTER TABLE "ModerationCaseEvent" DROP CONSTRAINT "ModerationCaseEvent_actorUserId_fkey";

-- DropForeignKey
ALTER TABLE "ModerationCaseEvent" DROP CONSTRAINT "ModerationCaseEvent_caseId_fkey";

-- DropForeignKey
ALTER TABLE "RealmModerationEvent" DROP CONSTRAINT "RealmModerationEvent_actorUserId_fkey";

-- DropForeignKey
ALTER TABLE "RealmModerationEvent" DROP CONSTRAINT "RealmModerationEvent_queueItemId_fkey";

-- DropForeignKey
ALTER TABLE "RealmModerationQueueItem" DROP CONSTRAINT "RealmModerationQueueItem_addressedUnitId_fkey";

-- DropForeignKey
ALTER TABLE "RealmModerationQueueItem" DROP CONSTRAINT "RealmModerationQueueItem_assignedToUserId_fkey";

-- DropForeignKey
ALTER TABLE "RealmModerationQueueItem" DROP CONSTRAINT "RealmModerationQueueItem_linkedCaseId_fkey";

-- DropForeignKey
ALTER TABLE "RealmModerationQueueItem" DROP CONSTRAINT "RealmModerationQueueItem_realmUnitId_fkey";

-- DropForeignKey
ALTER TABLE "RealmModerationQueueItem" DROP CONSTRAINT "RealmModerationQueueItem_reporterUserId_fkey";

-- DropForeignKey
ALTER TABLE "RealmModerationQueueItem" DROP CONSTRAINT "RealmModerationQueueItem_sourceFeedbackId_fkey";

-- DropForeignKey
ALTER TABLE "RealmModerationQueueItem" DROP CONSTRAINT "RealmModerationQueueItem_subjectUserId_fkey";

-- DropIndex
DROP INDEX "AccountEnforcement_auditLogId_idx";

-- DropIndex
DROP INDEX "Comment_visibilityState_idx";

-- DropIndex
DROP INDEX "Feedback_unitId_idx";

-- DropIndex
DROP INDEX "UnitRealm_realmUnitId_moderationState_visibilityState_creat_idx";

-- DropIndex
DROP INDEX "UnitRealm_realmUnitId_moderationState_visibilityState_isLoc_idx";

-- AlterTable
ALTER TABLE "AccountEnforcement" DROP COLUMN "auditLogId",
ADD COLUMN     "decisionActionId" UUID,
ADD COLUMN     "revocationActionId" UUID;

-- AlterTable
ALTER TABLE "Comment" DROP COLUMN "visibilityState",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'APPROVED';

-- AlterTable
ALTER TABLE "Feedback" DROP COLUMN "unitId",
ADD COLUMN     "addressedUnitId" UUID,
ADD COLUMN     "targetId" VARCHAR(128),
ADD COLUMN     "targetKind" "ModerationTargetKind";

-- AlterTable
ALTER TABLE "ModerationCase" ADD COLUMN     "parentCaseId" UUID,
ADD COLUMN     "scope" "ModerationScope" NOT NULL DEFAULT 'PLATFORM',
DROP COLUMN "targetKind",
ADD COLUMN     "targetKind" "ModerationTargetKind" NOT NULL;

-- AlterTable
ALTER TABLE "StaffAuditLog" DROP COLUMN "after",
DROP COLUMN "before";

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'APPROVED';

-- AlterTable
ALTER TABLE "UnitRealm" DROP COLUMN "moderationState",
DROP COLUMN "visibilityState",
ADD COLUMN     "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'APPROVED';

-- DropTable
DROP TABLE "ContentModerationState";

-- DropTable
DROP TABLE "ModerationCaseEvent";

-- DropTable
DROP TABLE "RealmModerationEvent";

-- DropTable
DROP TABLE "RealmModerationQueueItem";

-- DropEnum
DROP TYPE "ContentModerationStateKind";

-- DropEnum
DROP TYPE "RealmModerationQueueState";

-- DropEnum
DROP TYPE "UnitRealmModerationState";

-- DropEnum
DROP TYPE "UnitRealmVisibilityState";

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "authority" "ModerationAuthority" NOT NULL,
    "realmUnitId" UUID,
    "targetKind" "ModerationTargetKind" NOT NULL,
    "targetId" VARCHAR(128) NOT NULL,
    "targetPath" TEXT,
    "actorKind" "ModerationActorKind" NOT NULL DEFAULT 'USER',
    "actorUserId" UUID,
    "actionKind" "ModerationActionKind" NOT NULL,
    "resultingStatus" "ModerationStatus",
    "resultingLocked" BOOLEAN,
    "reasonCode" VARCHAR(64) NOT NULL,
    "reasonText" TEXT,
    "publicMessage" TEXT,
    "caseId" UUID,
    "reversesActionId" UUID,
    "requestId" VARCHAR(128),
    "idempotencyKey" VARCHAR(256),
    "importedFrom" VARCHAR(128),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModerationAction_idempotencyKey_key" ON "ModerationAction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ModerationAction_targetKind_targetId_createdAt_id_idx" ON "ModerationAction"("targetKind", "targetId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ModerationAction_targetKind_targetId_actionKind_createdAt_i_idx" ON "ModerationAction"("targetKind", "targetId", "actionKind", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ModerationAction_realmUnitId_createdAt_id_idx" ON "ModerationAction"("realmUnitId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ModerationAction_actorUserId_createdAt_id_idx" ON "ModerationAction"("actorUserId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ModerationAction_caseId_createdAt_id_idx" ON "ModerationAction"("caseId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ModerationAction_actionKind_createdAt_id_idx" ON "ModerationAction"("actionKind", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ModerationAction_requestId_idx" ON "ModerationAction"("requestId");

-- CreateIndex
CREATE INDEX "AccountEnforcement_decisionActionId_idx" ON "AccountEnforcement"("decisionActionId");

-- CreateIndex
CREATE INDEX "AccountEnforcement_revocationActionId_idx" ON "AccountEnforcement"("revocationActionId");

-- CreateIndex
CREATE INDEX "Comment_moderationStatus_idx" ON "Comment"("moderationStatus");

-- CreateIndex
CREATE INDEX "Comment_deletedAt_idx" ON "Comment"("deletedAt");

-- CreateIndex
CREATE INDEX "Feedback_targetKind_targetId_idx" ON "Feedback"("targetKind", "targetId");

-- CreateIndex
CREATE INDEX "Feedback_addressedUnitId_idx" ON "Feedback"("addressedUnitId");

-- CreateIndex
CREATE INDEX "ModerationCase_scope_state_createdAt_idx" ON "ModerationCase"("scope", "state", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationCase_targetKind_targetId_idx" ON "ModerationCase"("targetKind", "targetId");

-- CreateIndex
CREATE INDEX "ModerationCase_parentCaseId_idx" ON "ModerationCase"("parentCaseId");

-- CreateIndex
CREATE INDEX "Unit_moderationStatus_idx" ON "Unit"("moderationStatus");

-- CreateIndex
CREATE INDEX "UnitRealm_realmUnitId_moderationStatus_createdAt_idx" ON "UnitRealm"("realmUnitId", "moderationStatus", "createdAt");

-- CreateIndex
CREATE INDEX "UnitRealm_realmUnitId_moderationStatus_isLocked_createdAt_idx" ON "UnitRealm"("realmUnitId", "moderationStatus", "isLocked", "createdAt");

-- AddForeignKey
ALTER TABLE "AccountEnforcement" ADD CONSTRAINT "AccountEnforcement_decisionActionId_fkey" FOREIGN KEY ("decisionActionId") REFERENCES "ModerationAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountEnforcement" ADD CONSTRAINT "AccountEnforcement_revocationActionId_fkey" FOREIGN KEY ("revocationActionId") REFERENCES "ModerationAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_parentCaseId_fkey" FOREIGN KEY ("parentCaseId") REFERENCES "ModerationCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_realmUnitId_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ModerationCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_reversesActionId_fkey" FOREIGN KEY ("reversesActionId") REFERENCES "ModerationAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
