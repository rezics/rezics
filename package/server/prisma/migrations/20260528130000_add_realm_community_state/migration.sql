CREATE TYPE "RealmMemberState" AS ENUM ('ACTIVE', 'PENDING', 'MUTED', 'REMOVED', 'BANNED');

ALTER TABLE "Realm"
  ADD COLUMN "ruleVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "ruleRequireOnJoin" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ruleRequireOnPost" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ruleRequireOnUpdate" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "rulePolicyUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "joinRequiresApproval" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "RealmMember"
  ADD COLUMN "state" "RealmMemberState" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

ALTER TABLE "UnitRealm"
  ADD COLUMN "state" "ContentModerationStateKind" NOT NULL DEFAULT 'VISIBLE';

CREATE TABLE "RealmRuleAcknowledgement" (
  "realmUnitId" UUID NOT NULL,
  "ruleUnitId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "userId" UUID NOT NULL,
  "acceptedLanguage" VARCHAR(16),
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RealmRuleAcknowledgement_pkey" PRIMARY KEY ("realmUnitId", "ruleUnitId", "version", "userId")
);

ALTER TABLE "RealmRuleAcknowledgement"
  ADD CONSTRAINT "RealmRuleAcknowledgement_realmUnitId_fkey"
  FOREIGN KEY ("realmUnitId") REFERENCES "Realm"("unitId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RealmRuleAcknowledgement"
  ADD CONSTRAINT "RealmRuleAcknowledgement_ruleUnitId_fkey"
  FOREIGN KEY ("ruleUnitId") REFERENCES "Unit"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RealmRuleAcknowledgement"
  ADD CONSTRAINT "RealmRuleAcknowledgement_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("unitId")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "RealmMember_realmUnitId_state_idx" ON "RealmMember"("realmUnitId", "state");
CREATE INDEX "RealmRuleAcknowledgement_userId_acceptedAt_idx" ON "RealmRuleAcknowledgement"("userId", "acceptedAt");
CREATE INDEX "RealmRuleAcknowledgement_realmUnitId_userId_acceptedAt_idx" ON "RealmRuleAcknowledgement"("realmUnitId", "userId", "acceptedAt");
CREATE INDEX "UnitRealm_realmUnitId_state_createdAt_idx" ON "UnitRealm"("realmUnitId", "state", "createdAt");
