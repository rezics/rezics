-- Add platform authorization governance primitives.

CREATE TYPE "GovernanceGrantState" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');
CREATE TYPE "AccountEnforcementKind" AS ENUM ('WARNING', 'SILENCE', 'SUSPENSION', 'BAN', 'RATE_LIMIT', 'TRUST_RESTRICTION');
CREATE TYPE "AccountEnforcementState" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');
CREATE TYPE "ModerationCaseState" AS ENUM ('NEW', 'TRIAGED', 'ASSIGNED', 'ACTIONED', 'RESOLVED', 'DUPLICATE', 'REJECTED', 'ESCALATED');
CREATE TYPE "RealmModerationQueueState" AS ENUM ('NEW', 'REVIEWING', 'ACTIONED', 'RESOLVED', 'DUPLICATE', 'REJECTED', 'ESCALATED');
CREATE TYPE "ContentModerationStateKind" AS ENUM ('VISIBLE', 'HIDDEN', 'TOMBSTONED', 'LOCKED', 'ARCHIVED', 'REMOVED');

CREATE TABLE "StaffGrant" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "userId" UUID NOT NULL,
  "capability" VARCHAR(96) NOT NULL,
  "scopeKind" VARCHAR(32) NOT NULL DEFAULT 'global',
  "realmUnitId" UUID,
  "state" "GovernanceGrantState" NOT NULL DEFAULT 'ACTIVE',
  "grantedById" UUID NOT NULL,
  "revokedById" UUID,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StaffGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RealmCapabilityGrant" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "realmUnitId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "capability" VARCHAR(96) NOT NULL,
  "state" "GovernanceGrantState" NOT NULL DEFAULT 'ACTIVE',
  "grantedById" UUID NOT NULL,
  "revokedById" UUID,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RealmCapabilityGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountEnforcement" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "targetUserId" UUID NOT NULL,
  "kind" "AccountEnforcementKind" NOT NULL,
  "state" "AccountEnforcementState" NOT NULL DEFAULT 'ACTIVE',
  "reason" TEXT NOT NULL,
  "safeMessage" TEXT,
  "decidedById" UUID NOT NULL,
  "decisionCode" VARCHAR(64) NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedById" UUID,
  "auditLogId" UUID,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AccountEnforcement_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AccountEnforcement" (
  "targetUserId",
  "kind",
  "state",
  "reason",
  "safeMessage",
  "decidedById",
  "decisionCode",
  "metadata"
)
SELECT
  u."unitId",
  'BAN',
  'ACTIVE',
  'Backfilled from legacy BLOCKED permission.',
  'This account is restricted.',
  u."unitId",
  'BLOCKED_ACCOUNT',
  jsonb_build_object('source', 'legacy-permission-blocked')
FROM "User" u
WHERE u."permission" IS NOT NULL
  AND (
    (u."permission"::jsonb->'role' ? 'BLOCKED')
    OR u."permission"::jsonb->>'role' = 'BLOCKED'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "AccountEnforcement" existing
    WHERE existing."targetUserId" = u."unitId"
      AND existing."kind" = 'BAN'
      AND existing."state" = 'ACTIVE'
      AND (existing."expiresAt" IS NULL OR existing."expiresAt" > now())
  );

UPDATE "User"
SET "permission" = jsonb_set("permission"::jsonb, '{role}', '["MEMBER"]'::jsonb)
WHERE "permission" IS NOT NULL
  AND "permission"::jsonb->'role' ? 'BLOCKED';

UPDATE "User"
SET "permission" = jsonb_set("permission"::jsonb, '{role}', '"MEMBER"'::jsonb)
WHERE "permission" IS NOT NULL
  AND "permission"::jsonb->>'role' = 'BLOCKED';

CREATE TABLE "ModerationCase" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "state" "ModerationCaseState" NOT NULL DEFAULT 'NEW',
  "severity" VARCHAR(32),
  "reporterUserId" UUID,
  "subjectUserId" UUID,
  "targetKind" VARCHAR(64) NOT NULL,
  "targetId" VARCHAR(128) NOT NULL,
  "targetUnitId" UUID,
  "realmUnitId" UUID,
  "sourceFeedbackId" UUID,
  "assignedToUserId" UUID,
  "duplicateOfCaseId" UUID,
  "reason" TEXT,
  "safeSummary" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ModerationCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModerationCaseEvent" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "caseId" UUID NOT NULL,
  "actorUserId" UUID NOT NULL,
  "eventType" VARCHAR(64) NOT NULL,
  "decision" JSONB,
  "decisionCode" VARCHAR(64),
  "reason" TEXT,
  "before" JSONB,
  "after" JSONB,
  "reversible" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ModerationCaseEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RealmModerationQueueItem" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "realmUnitId" UUID NOT NULL,
  "state" "RealmModerationQueueState" NOT NULL DEFAULT 'NEW',
  "reporterUserId" UUID,
  "subjectUserId" UUID,
  "targetKind" VARCHAR(64) NOT NULL,
  "targetId" VARCHAR(128) NOT NULL,
  "targetUnitId" UUID,
  "sourceFeedbackId" UUID,
  "linkedCaseId" UUID,
  "assignedToUserId" UUID,
  "reason" TEXT,
  "safeSummary" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RealmModerationQueueItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RealmModerationEvent" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "queueItemId" UUID NOT NULL,
  "realmUnitId" UUID NOT NULL,
  "actorUserId" UUID NOT NULL,
  "decisionKind" VARCHAR(64),
  "decision" JSONB,
  "decisionCode" VARCHAR(64),
  "reason" TEXT,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RealmModerationEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentModerationState" (
  "targetUnitId" UUID NOT NULL,
  "state" "ContentModerationStateKind" NOT NULL DEFAULT 'VISIBLE',
  "decidedById" UUID,
  "caseId" UUID,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ContentModerationState_pkey" PRIMARY KEY ("targetUnitId")
);

CREATE TABLE "RealmContentModeration" (
  "realmUnitId" UUID NOT NULL,
  "targetUnitId" UUID NOT NULL,
  "state" "ContentModerationStateKind" NOT NULL,
  "decidedById" UUID,
  "caseId" UUID,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RealmContentModeration_pkey" PRIMARY KEY ("realmUnitId", "targetUnitId")
);

CREATE TABLE "StaffAuditLog" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "actorUserId" UUID NOT NULL,
  "action" VARCHAR(128) NOT NULL,
  "targetKind" VARCHAR(64) NOT NULL,
  "targetId" VARCHAR(128) NOT NULL,
  "decisionCode" VARCHAR(64) NOT NULL,
  "requestId" VARCHAR(128),
  "reason" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StaffAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffGrant_userId_state_expiresAt_idx" ON "StaffGrant"("userId", "state", "expiresAt");
CREATE INDEX "StaffGrant_capability_scopeKind_realmUnitId_idx" ON "StaffGrant"("capability", "scopeKind", "realmUnitId");
CREATE INDEX "StaffGrant_grantedById_createdAt_idx" ON "StaffGrant"("grantedById", "createdAt");
CREATE INDEX "StaffGrant_revokedById_idx" ON "StaffGrant"("revokedById");

CREATE INDEX "RealmCapabilityGrant_realmUnitId_userId_state_idx" ON "RealmCapabilityGrant"("realmUnitId", "userId", "state");
CREATE INDEX "RealmCapabilityGrant_realmUnitId_capability_state_idx" ON "RealmCapabilityGrant"("realmUnitId", "capability", "state");
CREATE INDEX "RealmCapabilityGrant_userId_capability_state_idx" ON "RealmCapabilityGrant"("userId", "capability", "state");
CREATE INDEX "RealmCapabilityGrant_grantedById_createdAt_idx" ON "RealmCapabilityGrant"("grantedById", "createdAt");
CREATE INDEX "RealmCapabilityGrant_revokedById_idx" ON "RealmCapabilityGrant"("revokedById");

CREATE INDEX "AccountEnforcement_targetUserId_state_kind_expiresAt_idx" ON "AccountEnforcement"("targetUserId", "state", "kind", "expiresAt");
CREATE INDEX "AccountEnforcement_kind_state_createdAt_idx" ON "AccountEnforcement"("kind", "state", "createdAt");
CREATE INDEX "AccountEnforcement_decidedById_createdAt_idx" ON "AccountEnforcement"("decidedById", "createdAt");
CREATE INDEX "AccountEnforcement_revokedById_idx" ON "AccountEnforcement"("revokedById");
CREATE INDEX "AccountEnforcement_auditLogId_idx" ON "AccountEnforcement"("auditLogId");

CREATE INDEX "ModerationCase_state_severity_createdAt_idx" ON "ModerationCase"("state", "severity", "createdAt");
CREATE INDEX "ModerationCase_realmUnitId_state_createdAt_idx" ON "ModerationCase"("realmUnitId", "state", "createdAt");
CREATE INDEX "ModerationCase_assignedToUserId_state_createdAt_idx" ON "ModerationCase"("assignedToUserId", "state", "createdAt");
CREATE INDEX "ModerationCase_targetKind_targetId_idx" ON "ModerationCase"("targetKind", "targetId");
CREATE INDEX "ModerationCase_targetUnitId_state_idx" ON "ModerationCase"("targetUnitId", "state");
CREATE INDEX "ModerationCase_subjectUserId_state_createdAt_idx" ON "ModerationCase"("subjectUserId", "state", "createdAt");
CREATE INDEX "ModerationCase_reporterUserId_createdAt_idx" ON "ModerationCase"("reporterUserId", "createdAt");
CREATE INDEX "ModerationCase_sourceFeedbackId_idx" ON "ModerationCase"("sourceFeedbackId");
CREATE INDEX "ModerationCase_duplicateOfCaseId_idx" ON "ModerationCase"("duplicateOfCaseId");

CREATE INDEX "ModerationCaseEvent_caseId_createdAt_idx" ON "ModerationCaseEvent"("caseId", "createdAt");
CREATE INDEX "ModerationCaseEvent_actorUserId_createdAt_idx" ON "ModerationCaseEvent"("actorUserId", "createdAt");
CREATE INDEX "ModerationCaseEvent_eventType_createdAt_idx" ON "ModerationCaseEvent"("eventType", "createdAt");
CREATE INDEX "ModerationCaseEvent_decisionCode_createdAt_idx" ON "ModerationCaseEvent"("decisionCode", "createdAt");

CREATE INDEX "RealmModerationQueueItem_realmUnitId_state_createdAt_idx" ON "RealmModerationQueueItem"("realmUnitId", "state", "createdAt");
CREATE INDEX "RealmModerationQueueItem_realmUnitId_assignedToUserId_state_idx" ON "RealmModerationQueueItem"("realmUnitId", "assignedToUserId", "state", "createdAt");
CREATE INDEX "RealmModerationQueueItem_targetKind_targetId_idx" ON "RealmModerationQueueItem"("targetKind", "targetId");
CREATE INDEX "RealmModerationQueueItem_targetUnitId_state_idx" ON "RealmModerationQueueItem"("targetUnitId", "state");
CREATE INDEX "RealmModerationQueueItem_subjectUserId_state_createdAt_idx" ON "RealmModerationQueueItem"("subjectUserId", "state", "createdAt");
CREATE INDEX "RealmModerationQueueItem_reporterUserId_createdAt_idx" ON "RealmModerationQueueItem"("reporterUserId", "createdAt");
CREATE INDEX "RealmModerationQueueItem_sourceFeedbackId_idx" ON "RealmModerationQueueItem"("sourceFeedbackId");
CREATE INDEX "RealmModerationQueueItem_linkedCaseId_idx" ON "RealmModerationQueueItem"("linkedCaseId");

CREATE INDEX "RealmModerationEvent_queueItemId_createdAt_idx" ON "RealmModerationEvent"("queueItemId", "createdAt");
CREATE INDEX "RealmModerationEvent_realmUnitId_createdAt_idx" ON "RealmModerationEvent"("realmUnitId", "createdAt");
CREATE INDEX "RealmModerationEvent_actorUserId_createdAt_idx" ON "RealmModerationEvent"("actorUserId", "createdAt");
CREATE INDEX "RealmModerationEvent_decisionKind_createdAt_idx" ON "RealmModerationEvent"("decisionKind", "createdAt");

CREATE INDEX "ContentModerationState_state_updatedAt_idx" ON "ContentModerationState"("state", "updatedAt");
CREATE INDEX "ContentModerationState_decidedById_updatedAt_idx" ON "ContentModerationState"("decidedById", "updatedAt");
CREATE INDEX "ContentModerationState_caseId_idx" ON "ContentModerationState"("caseId");

CREATE INDEX "RealmContentModeration_realmUnitId_state_updatedAt_idx" ON "RealmContentModeration"("realmUnitId", "state", "updatedAt");
CREATE INDEX "RealmContentModeration_targetUnitId_state_idx" ON "RealmContentModeration"("targetUnitId", "state");
CREATE INDEX "RealmContentModeration_decidedById_updatedAt_idx" ON "RealmContentModeration"("decidedById", "updatedAt");
CREATE INDEX "RealmContentModeration_caseId_idx" ON "RealmContentModeration"("caseId");

CREATE INDEX "StaffAuditLog_actorUserId_createdAt_idx" ON "StaffAuditLog"("actorUserId", "createdAt");
CREATE INDEX "StaffAuditLog_action_createdAt_idx" ON "StaffAuditLog"("action", "createdAt");
CREATE INDEX "StaffAuditLog_targetKind_targetId_createdAt_idx" ON "StaffAuditLog"("targetKind", "targetId", "createdAt");
CREATE INDEX "StaffAuditLog_decisionCode_createdAt_idx" ON "StaffAuditLog"("decisionCode", "createdAt");
CREATE INDEX "StaffAuditLog_requestId_idx" ON "StaffAuditLog"("requestId");

ALTER TABLE "StaffGrant" ADD CONSTRAINT "StaffGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffGrant" ADD CONSTRAINT "StaffGrant_realmUnitId_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffGrant" ADD CONSTRAINT "StaffGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("unitId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffGrant" ADD CONSTRAINT "StaffGrant_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RealmCapabilityGrant" ADD CONSTRAINT "RealmCapabilityGrant_realmUnitId_userId_fkey" FOREIGN KEY ("realmUnitId", "userId") REFERENCES "RealmMember"("realmUnitId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RealmCapabilityGrant" ADD CONSTRAINT "RealmCapabilityGrant_realmUnitId_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Realm"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RealmCapabilityGrant" ADD CONSTRAINT "RealmCapabilityGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("unitId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RealmCapabilityGrant" ADD CONSTRAINT "RealmCapabilityGrant_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccountEnforcement" ADD CONSTRAINT "AccountEnforcement_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountEnforcement" ADD CONSTRAINT "AccountEnforcement_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("unitId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountEnforcement" ADD CONSTRAINT "AccountEnforcement_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_targetUnitId_fkey" FOREIGN KEY ("targetUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_realmUnitId_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_sourceFeedbackId_fkey" FOREIGN KEY ("sourceFeedbackId") REFERENCES "Feedback"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_duplicateOfCaseId_fkey" FOREIGN KEY ("duplicateOfCaseId") REFERENCES "ModerationCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ModerationCaseEvent" ADD CONSTRAINT "ModerationCaseEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ModerationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationCaseEvent" ADD CONSTRAINT "ModerationCaseEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("unitId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RealmModerationQueueItem" ADD CONSTRAINT "RealmModerationQueueItem_realmUnitId_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Realm"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RealmModerationQueueItem" ADD CONSTRAINT "RealmModerationQueueItem_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RealmModerationQueueItem" ADD CONSTRAINT "RealmModerationQueueItem_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RealmModerationQueueItem" ADD CONSTRAINT "RealmModerationQueueItem_targetUnitId_fkey" FOREIGN KEY ("targetUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RealmModerationQueueItem" ADD CONSTRAINT "RealmModerationQueueItem_sourceFeedbackId_fkey" FOREIGN KEY ("sourceFeedbackId") REFERENCES "Feedback"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RealmModerationQueueItem" ADD CONSTRAINT "RealmModerationQueueItem_linkedCaseId_fkey" FOREIGN KEY ("linkedCaseId") REFERENCES "ModerationCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RealmModerationQueueItem" ADD CONSTRAINT "RealmModerationQueueItem_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RealmModerationEvent" ADD CONSTRAINT "RealmModerationEvent_queueItemId_fkey" FOREIGN KEY ("queueItemId") REFERENCES "RealmModerationQueueItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RealmModerationEvent" ADD CONSTRAINT "RealmModerationEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("unitId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContentModerationState" ADD CONSTRAINT "ContentModerationState_targetUnitId_fkey" FOREIGN KEY ("targetUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentModerationState" ADD CONSTRAINT "ContentModerationState_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentModerationState" ADD CONSTRAINT "ContentModerationState_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ModerationCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RealmContentModeration" ADD CONSTRAINT "RealmContentModeration_realmUnitId_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Realm"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RealmContentModeration" ADD CONSTRAINT "RealmContentModeration_targetUnitId_fkey" FOREIGN KEY ("targetUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RealmContentModeration" ADD CONSTRAINT "RealmContentModeration_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RealmContentModeration" ADD CONSTRAINT "RealmContentModeration_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ModerationCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StaffAuditLog" ADD CONSTRAINT "StaffAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("unitId") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "ModerationCase" (
  "state",
  "reporterUserId",
  "targetKind",
  "targetId",
  "targetUnitId",
  "sourceFeedbackId",
  "reason",
  "safeSummary",
  "createdAt",
  "updatedAt"
)
SELECT
  'NEW'::"ModerationCaseState",
  CASE WHEN EXISTS (SELECT 1 FROM "User" u WHERE u."unitId" = f."userId") THEN f."userId" ELSE NULL END,
  CASE WHEN f."unitId" IS NOT NULL THEN 'unit' WHEN f."url" IS NOT NULL THEN 'url' ELSE 'feedback' END,
  COALESCE(f."unitId"::TEXT, f."url", f."id"::TEXT),
  f."unitId",
  f."id",
  f."content",
  left(f."content", 500),
  f."createdAt",
  f."updatedAt"
FROM "Feedback" f
WHERE f."type" = 'REPORT'
  AND NOT EXISTS (
    SELECT 1 FROM "ModerationCase" mc WHERE mc."sourceFeedbackId" = f."id"
  );
