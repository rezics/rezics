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
ALTER TABLE "Zone" ADD COLUMN "boundary" jsonb;--> statement-breakpoint
ALTER TABLE "Zone" ADD COLUMN "nav" jsonb;--> statement-breakpoint
ALTER TABLE "Zone" ADD COLUMN "theme" jsonb;--> statement-breakpoint
ALTER TABLE "Zone" ADD COLUMN "homePageId" uuid;--> statement-breakpoint
UPDATE "Zone"
SET
	"boundary" = jsonb_build_object(
		'schema', 'rezics/zone-boundary',
		'version', 1,
		'context', coalesce("config"->'context', '{"kind":"global"}'::jsonb),
		'filters', coalesce("config"->'filters', '{}'::jsonb)
	),
	"nav" = jsonb_build_object(
		'schema', 'rezics/zone-nav',
		'version', 1,
		'menus', coalesce("config"->'menus', '[]'::jsonb),
		'header', coalesce("config"->'header', '{"menuId":"main"}'::jsonb)
	),
	"theme" = jsonb_build_object(
		'schema', 'rezics/zone-theme',
		'version', 1
	);--> statement-breakpoint
WITH inserted AS (
	INSERT INTO "ZonePage" ("zoneUnitId", "slug", "config", "position")
	SELECT
		"unitId",
		'home',
		jsonb_build_object(
			'schema', 'rezics/zone-page',
			'version', 1,
			'sections', coalesce("config"->'pages'->'home'->'sections', '[]'::jsonb)
		),
		0
	FROM "Zone"
	RETURNING "id", "zoneUnitId"
)
UPDATE "Zone"
SET "homePageId" = inserted."id"
FROM inserted
WHERE "Zone"."unitId" = inserted."zoneUnitId";--> statement-breakpoint
ALTER TABLE "Zone" ALTER COLUMN "boundary" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "Zone" ALTER COLUMN "nav" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "Zone" ALTER COLUMN "theme" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "Zone" DROP COLUMN "config";--> statement-breakpoint
CREATE INDEX "ZonePage_zoneUnitId_position_idx" ON "ZonePage" ("zoneUnitId","position");--> statement-breakpoint
ALTER TABLE "ZonePage" ADD CONSTRAINT "ZonePage_zoneUnitId_Zone_unitId_fkey" FOREIGN KEY ("zoneUnitId") REFERENCES "Zone"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;
