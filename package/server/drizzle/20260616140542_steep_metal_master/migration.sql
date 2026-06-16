CREATE TABLE "Pinboard" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"realmUnitId" uuid NOT NULL,
	"key" varchar(64) NOT NULL,
	"kind" varchar(32) DEFAULT 'list' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "Pinboard_realmUnitId_key_unique" UNIQUE("realmUnitId","key")
);
--> statement-breakpoint
CREATE TABLE "PinboardEntry" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"pinboardId" uuid NOT NULL,
	"unitId" uuid NOT NULL,
	"position" varchar(64) DEFAULT 'V' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "PinboardEntry_pinboardId_unitId_unique" UNIQUE("pinboardId","unitId")
);
--> statement-breakpoint
ALTER TABLE "Realm" ADD COLUMN "sidebar" jsonb;--> statement-breakpoint
ALTER TABLE "Realm" ADD COLUMN "ruleUnitId" uuid;--> statement-breakpoint
CREATE INDEX "Pinboard_realmUnitId_idx" ON "Pinboard" ("realmUnitId");--> statement-breakpoint
CREATE INDEX "PinboardEntry_pinboardId_position_unitId_idx" ON "PinboardEntry" ("pinboardId","position","unitId");--> statement-breakpoint
ALTER TABLE "Pinboard" ADD CONSTRAINT "Pinboard_realmUnitId_Realm_unitId_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Realm"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PinboardEntry" ADD CONSTRAINT "PinboardEntry_pinboardId_Pinboard_id_fkey" FOREIGN KEY ("pinboardId") REFERENCES "Pinboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PinboardEntry" ADD CONSTRAINT "PinboardEntry_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Realm" ADD CONSTRAINT "Realm_ruleUnitId_Unit_id_fkey" FOREIGN KEY ("ruleUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;