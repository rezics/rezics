CREATE TABLE "RealmRuleItem" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"policyId" uuid NOT NULL,
	"revisionId" uuid NOT NULL,
	"rulePostUnitId" uuid NOT NULL,
	"position" text NOT NULL,
	"appliesTo" varchar(32),
	"reportReasonUnitId" uuid,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RealmRulePolicy" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"realmUnitId" uuid NOT NULL,
	"currentRevisionId" uuid,
	"requireOnJoin" boolean DEFAULT false NOT NULL,
	"requireOnPost" boolean DEFAULT false NOT NULL,
	"requireOnUpdate" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RealmRuleRevision" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"policyId" uuid NOT NULL,
	"version" integer NOT NULL,
	"createdByUserId" uuid,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RealmTagTree" (
	"realmUnitId" uuid PRIMARY KEY,
	"tree" jsonb NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "RealmRuleAcknowledgement" DROP CONSTRAINT "RealmRuleAcknowledgement_ruleUnitId_Unit_id_fkey";--> statement-breakpoint
ALTER TABLE "Realm" DROP CONSTRAINT "Realm_ruleUnitId_Unit_id_fkey";--> statement-breakpoint
ALTER TABLE "RealmRuleAcknowledgement" DROP CONSTRAINT "RealmRuleAcknowledgement_pkey";--> statement-breakpoint
DELETE FROM "RealmRuleAcknowledgement";--> statement-breakpoint
ALTER TABLE "RealmRuleAcknowledgement" ADD COLUMN "policyId" uuid;--> statement-breakpoint
ALTER TABLE "RealmRuleAcknowledgement" ADD COLUMN "revisionId" uuid;--> statement-breakpoint
ALTER TABLE "RealmRuleAcknowledgement" DROP COLUMN "ruleUnitId";--> statement-breakpoint
ALTER TABLE "RealmRuleAcknowledgement" ALTER COLUMN "policyId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "RealmRuleAcknowledgement" ALTER COLUMN "revisionId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "Realm" DROP COLUMN "ruleUnitId";--> statement-breakpoint
ALTER TABLE "Realm" DROP COLUMN "ruleVersion";--> statement-breakpoint
ALTER TABLE "Realm" DROP COLUMN "ruleRequireOnJoin";--> statement-breakpoint
ALTER TABLE "Realm" DROP COLUMN "ruleRequireOnPost";--> statement-breakpoint
ALTER TABLE "Realm" DROP COLUMN "ruleRequireOnUpdate";--> statement-breakpoint
ALTER TABLE "Realm" DROP COLUMN "rulePolicyUpdatedAt";--> statement-breakpoint
ALTER TABLE "RealmRuleAcknowledgement" ADD CONSTRAINT "RealmRuleAcknowledgement_pkey" PRIMARY KEY("realmUnitId","policyId","revisionId","userId");--> statement-breakpoint
CREATE INDEX "RealmRuleItem_revisionId_position_idx" ON "RealmRuleItem" ("revisionId","position");--> statement-breakpoint
CREATE INDEX "RealmRuleItem_rulePostUnitId_idx" ON "RealmRuleItem" ("rulePostUnitId");--> statement-breakpoint
CREATE UNIQUE INDEX "RealmRulePolicy_realmUnitId_key" ON "RealmRulePolicy" ("realmUnitId");--> statement-breakpoint
CREATE INDEX "RealmRulePolicy_currentRevisionId_idx" ON "RealmRulePolicy" ("currentRevisionId");--> statement-breakpoint
CREATE UNIQUE INDEX "RealmRuleRevision_policyId_version_key" ON "RealmRuleRevision" ("policyId","version");--> statement-breakpoint
CREATE INDEX "RealmRuleRevision_policyId_createdAt_idx" ON "RealmRuleRevision" ("policyId","createdAt");--> statement-breakpoint
ALTER TABLE "RealmRuleAcknowledgement" ADD CONSTRAINT "RealmRuleAcknowledgement_policyId_RealmRulePolicy_id_fkey" FOREIGN KEY ("policyId") REFERENCES "RealmRulePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmRuleAcknowledgement" ADD CONSTRAINT "RealmRuleAcknowledgement_revisionId_RealmRuleRevision_id_fkey" FOREIGN KEY ("revisionId") REFERENCES "RealmRuleRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmRuleItem" ADD CONSTRAINT "RealmRuleItem_policyId_RealmRulePolicy_id_fkey" FOREIGN KEY ("policyId") REFERENCES "RealmRulePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmRuleItem" ADD CONSTRAINT "RealmRuleItem_revisionId_RealmRuleRevision_id_fkey" FOREIGN KEY ("revisionId") REFERENCES "RealmRuleRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmRuleItem" ADD CONSTRAINT "RealmRuleItem_rulePostUnitId_Unit_id_fkey" FOREIGN KEY ("rulePostUnitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmRuleItem" ADD CONSTRAINT "RealmRuleItem_reportReasonUnitId_Unit_id_fkey" FOREIGN KEY ("reportReasonUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmRulePolicy" ADD CONSTRAINT "RealmRulePolicy_realmUnitId_Realm_unitId_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Realm"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmRuleRevision" ADD CONSTRAINT "RealmRuleRevision_policyId_RealmRulePolicy_id_fkey" FOREIGN KEY ("policyId") REFERENCES "RealmRulePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmRuleRevision" ADD CONSTRAINT "RealmRuleRevision_createdByUserId_User_unitId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmTagTree" ADD CONSTRAINT "RealmTagTree_realmUnitId_Realm_unitId_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Realm"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;