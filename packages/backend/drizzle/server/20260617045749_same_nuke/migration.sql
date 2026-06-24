CREATE TYPE "PolicyTagRuleState" AS ENUM('ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "PolicyTagApplication" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"ruleId" uuid NOT NULL,
	"unitId" uuid NOT NULL,
	"position" text,
	"metadata" jsonb,
	"appliedByUserId" uuid NOT NULL,
	"updatedByUserId" uuid,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PolicyTagRule" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"scopeKind" text NOT NULL,
	"realmUnitId" uuid,
	"tagUnitId" uuid NOT NULL,
	"state" "PolicyTagRuleState" DEFAULT 'ACTIVE'::"PolicyTagRuleState" NOT NULL,
	"createdByUserId" uuid NOT NULL,
	"updatedByUserId" uuid,
	"reason" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "PolicyTagApplication_ruleId_unitId_key" ON "PolicyTagApplication" ("ruleId","unitId");--> statement-breakpoint
CREATE INDEX "PolicyTagApplication_ruleId_position_createdAt_unitId_idx" ON "PolicyTagApplication" ("ruleId","position","createdAt","unitId");--> statement-breakpoint
CREATE INDEX "PolicyTagApplication_unitId_ruleId_idx" ON "PolicyTagApplication" ("unitId","ruleId");--> statement-breakpoint
CREATE UNIQUE INDEX "PolicyTagRule_global_active_tagUnitId_key" ON "PolicyTagRule" ("tagUnitId") WHERE ("scopeKind" = 'global' AND "state" = 'ACTIVE');--> statement-breakpoint
CREATE UNIQUE INDEX "PolicyTagRule_realm_active_realmUnitId_tagUnitId_key" ON "PolicyTagRule" ("realmUnitId","tagUnitId") WHERE ("scopeKind" = 'realm' AND "state" = 'ACTIVE');--> statement-breakpoint
CREATE INDEX "PolicyTagRule_scope_state_idx" ON "PolicyTagRule" ("scopeKind","realmUnitId","state");--> statement-breakpoint
CREATE INDEX "PolicyTagRule_tagUnitId_state_idx" ON "PolicyTagRule" ("tagUnitId","state");--> statement-breakpoint
ALTER TABLE "PolicyTagApplication" ADD CONSTRAINT "PolicyTagApplication_ruleId_PolicyTagRule_id_fkey" FOREIGN KEY ("ruleId") REFERENCES "PolicyTagRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PolicyTagApplication" ADD CONSTRAINT "PolicyTagApplication_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PolicyTagApplication" ADD CONSTRAINT "PolicyTagApplication_appliedByUserId_User_unitId_fkey" FOREIGN KEY ("appliedByUserId") REFERENCES "User"("unitId") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PolicyTagApplication" ADD CONSTRAINT "PolicyTagApplication_updatedByUserId_User_unitId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PolicyTagRule" ADD CONSTRAINT "PolicyTagRule_realmUnitId_Realm_unitId_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Realm"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PolicyTagRule" ADD CONSTRAINT "PolicyTagRule_tagUnitId_Unit_id_fkey" FOREIGN KEY ("tagUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PolicyTagRule" ADD CONSTRAINT "PolicyTagRule_createdByUserId_User_unitId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("unitId") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PolicyTagRule" ADD CONSTRAINT "PolicyTagRule_updatedByUserId_User_unitId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;
