ALTER TABLE "Zone" ADD COLUMN "ownerRealmUnitId" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "Zone" ADD COLUMN "configVersion" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "Zone" ADD COLUMN "pages" jsonb;--> statement-breakpoint
ALTER TABLE "Zone" ADD COLUMN "sections" jsonb;--> statement-breakpoint
ALTER TABLE "Zone" ADD COLUMN "theme" jsonb;--> statement-breakpoint
ALTER TABLE "Zone" ADD COLUMN "primaryRealmUnitId" uuid;--> statement-breakpoint
CREATE INDEX "Zone_ownerRealmUnitId_idx" ON "Zone" ("ownerRealmUnitId");--> statement-breakpoint
CREATE INDEX "Zone_primaryRealmUnitId_idx" ON "Zone" ("primaryRealmUnitId");--> statement-breakpoint
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_ownerRealmUnitId_Unit_id_fkey" FOREIGN KEY ("ownerRealmUnitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_primaryRealmUnitId_Unit_id_fkey" FOREIGN KEY ("primaryRealmUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;