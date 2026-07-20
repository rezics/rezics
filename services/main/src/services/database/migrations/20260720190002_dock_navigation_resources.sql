-- Create "unit_dock" table
CREATE TABLE "unit_dock" (
  "unit_id" uuid NOT NULL,
  "surface" text NOT NULL,
  "document" jsonb NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("unit_id", "surface"),
  CONSTRAINT "unit_dock_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_dock_surface_check" CHECK (surface = ANY (ARRAY['main'::text, 'wiki'::text]))
);
-- Move the former Zone root Dock into the Unit-owned main surface.
INSERT INTO "unit_dock" ("unit_id", "surface", "document", "created_at", "updated_at")
SELECT
  "id",
  'main',
  jsonb_set("dock_document", '{_type}', '"dock-document"'::jsonb, false),
  "created_at",
  "updated_at"
FROM "zone";
-- Modify "zone" table
ALTER TABLE "zone" DROP COLUMN "dock_document";
-- Modify "zone_navigation" table
ALTER TABLE "zone_navigation" DROP CONSTRAINT "zone_navigation_key_check", DROP COLUMN "key", DROP COLUMN "position";
-- Create index "zone_navigation_zone_created_idx" to table: "zone_navigation"
CREATE INDEX "zone_navigation_zone_created_idx" ON "zone_navigation" ("zone_id", "created_at", "id");
-- Create "realm_navigation" table
CREATE TABLE "realm_navigation" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "realm_id" uuid NOT NULL,
  "document" jsonb NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "realm_navigation_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "realm_navigation_realm_created_idx" to table: "realm_navigation"
CREATE INDEX "realm_navigation_realm_created_idx" ON "realm_navigation" ("realm_id", "created_at", "id");
