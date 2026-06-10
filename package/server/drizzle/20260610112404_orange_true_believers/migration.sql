CREATE TABLE "ZonePage" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"zoneUnitId" uuid NOT NULL,
	"slug" text NOT NULL,
	"config" jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "ZonePage_zoneUnitId_slug_unique" UNIQUE("zoneUnitId","slug")
);
--> statement-breakpoint
ALTER TABLE "Zone" ADD COLUMN "boundary" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "Zone" ADD COLUMN "nav" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "Zone" ADD COLUMN "theme" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "Zone" ADD COLUMN "homePageId" uuid;--> statement-breakpoint
ALTER TABLE "Zone" DROP COLUMN "config";--> statement-breakpoint
CREATE INDEX "ZonePage_zoneUnitId_position_idx" ON "ZonePage" ("zoneUnitId","position");--> statement-breakpoint
ALTER TABLE "ZonePage" ADD CONSTRAINT "ZonePage_zoneUnitId_Zone_unitId_fkey" FOREIGN KEY ("zoneUnitId") REFERENCES "Zone"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;