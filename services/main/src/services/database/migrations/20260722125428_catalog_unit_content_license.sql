-- Modify "book" table
ALTER TABLE "book" DROP COLUMN "licensed";
-- Modify "media" table
ALTER TABLE "media" DROP COLUMN "licensed";
-- Modify "software" table
ALTER TABLE "software" DROP COLUMN "licensed";
-- Create "catalog_unit_content_license" table
CREATE TABLE "catalog_unit_content_license" (
  "unit_id" uuid NOT NULL,
  "unit_kind" text NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("unit_id"),
  CONSTRAINT "catalog_unit_content_license_unit_kind_fkey" FOREIGN KEY ("unit_id", "unit_kind") REFERENCES "unit" ("id", "kind") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "catalog_unit_content_license_kind_check" CHECK (unit_kind = ANY (ARRAY['book'::text, 'software'::text, 'media'::text]))
);

-- Keep the existing search projection ledger synchronized with marker changes.
CREATE TRIGGER "search_projection_touch_catalog_unit_content_license_insert"
AFTER INSERT ON "catalog_unit_content_license"
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION "search_touch_current_statement"('unit_id');

CREATE TRIGGER "search_projection_touch_catalog_unit_content_license_update"
AFTER UPDATE ON "catalog_unit_content_license"
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION "search_touch_current_statement"('unit_id');

CREATE TRIGGER "search_projection_touch_catalog_unit_content_license_delete"
AFTER DELETE ON "catalog_unit_content_license"
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT
EXECUTE FUNCTION "search_touch_current_statement"('unit_id');
