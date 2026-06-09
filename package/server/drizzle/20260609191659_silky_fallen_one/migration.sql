-- Custom SQL: development-stage clear cutover to the versioned config
-- envelope — no old-row compatibility; the factory reseed is the data path.
-- Existing rows cannot satisfy the NOT NULL "config" column, so drop them.
DELETE FROM "Zone";--> statement-breakpoint
ALTER TABLE "Zone" DROP CONSTRAINT "Zone_primaryRealmUnitId_Unit_id_fkey";--> statement-breakpoint
DROP INDEX "Zone_primaryRealmUnitId_idx";--> statement-breakpoint
ALTER TABLE "Zone" ADD COLUMN "config" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "Zone" DROP COLUMN "filters";--> statement-breakpoint
ALTER TABLE "Zone" DROP COLUMN "configVersion";--> statement-breakpoint
ALTER TABLE "Zone" DROP COLUMN "pages";--> statement-breakpoint
ALTER TABLE "Zone" DROP COLUMN "sections";--> statement-breakpoint
ALTER TABLE "Zone" DROP COLUMN "theme";--> statement-breakpoint
ALTER TABLE "Zone" DROP COLUMN "primaryRealmUnitId";--> statement-breakpoint
ALTER TABLE "Zone" DROP COLUMN "template";--> statement-breakpoint
ALTER TABLE "Zone" DROP COLUMN "styling";--> statement-breakpoint
ALTER TABLE "Zone" DROP COLUMN "wiki";