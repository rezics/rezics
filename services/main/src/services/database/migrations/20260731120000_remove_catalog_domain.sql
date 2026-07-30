-- Unit ownership is authoritative; the redundant mode column must not drift from it.
ALTER TABLE "unit"
  DROP CONSTRAINT "unit_catalog_mode_check",
  DROP COLUMN "catalog_mode";

-- Source links are Unit-owned metadata, not a separate catalog domain.
ALTER TABLE "unit_link" RENAME TO "unit_source_link";
ALTER TABLE "unit_source_link"
  RENAME CONSTRAINT "unit_link_pkey" TO "unit_source_link_pkey";
ALTER TABLE "unit_source_link"
  RENAME CONSTRAINT "unit_link_unit_source_hash_key" TO "unit_source_link_unit_source_hash_key";
ALTER TABLE "unit_source_link"
  RENAME CONSTRAINT "unit_link_url_check" TO "unit_source_link_url_check";
ALTER TABLE "unit_source_link"
  RENAME CONSTRAINT "unit_link_hash_check" TO "unit_source_link_hash_check";
ALTER TABLE "unit_source_link"
  RENAME CONSTRAINT "unit_link_unit_id_unit_id_fkey" TO "unit_source_link_unit_id_unit_id_fkey";
ALTER TABLE "unit_source_link"
  RENAME CONSTRAINT "unit_link_source_entity_id_entity_id_fkey" TO "unit_source_link_source_entity_id_entity_id_fkey";
ALTER INDEX "unit_link_unit_position_idx" RENAME TO "unit_source_link_unit_position_idx";
ALTER INDEX "unit_link_source_entity_idx" RENAME TO "unit_source_link_source_entity_idx";
ALTER TABLE "software_requirement"
  RENAME CONSTRAINT "software_requirement_source_link_id_unit_link_id_fkey"
  TO "software_requirement_source_link_id_unit_source_link_id_fkey";

-- Replace the marker row with an append-only, versioned grant lifecycle.
DROP TRIGGER "search_projection_touch_catalog_unit_content_license_insert"
  ON "catalog_unit_content_license";
DROP TRIGGER "search_projection_touch_catalog_unit_content_license_update"
  ON "catalog_unit_content_license";
DROP TRIGGER "search_projection_touch_catalog_unit_content_license_delete"
  ON "catalog_unit_content_license";

ALTER TABLE "catalog_unit_content_license" RENAME TO "unit_content_license";
ALTER TABLE "unit_content_license"
  DROP CONSTRAINT "catalog_unit_content_license_pkey",
  DROP CONSTRAINT "catalog_unit_content_license_unit_kind_fkey",
  DROP CONSTRAINT "catalog_unit_content_license_kind_check";
ALTER TABLE "unit_content_license" RENAME COLUMN "created_at" TO "granted_at";
ALTER TABLE "unit_content_license"
  ADD COLUMN "id" uuid NOT NULL DEFAULT uuidv7(),
  ADD COLUMN "granted_by_profile_id" uuid,
  ADD COLUMN "reference_license_slug" text,
  ADD COLUMN "revoked_at" timestamptz(3);

UPDATE "unit_content_license" AS license
SET
  "granted_by_profile_id" = ownership."profile_id",
  "reference_license_slug" = 'rezics-unit-content-license-v1'
FROM "unit_ownership" AS ownership
WHERE ownership."unit_id" = license."unit_id"
  AND ownership."revoked_at" IS NULL;

ALTER TABLE "unit_content_license"
  ALTER COLUMN "granted_by_profile_id" SET NOT NULL,
  ALTER COLUMN "reference_license_slug" SET NOT NULL,
  DROP COLUMN "unit_kind",
  ADD CONSTRAINT "unit_content_license_pkey" PRIMARY KEY ("id"),
  ADD CONSTRAINT "unit_content_license_unit_id_unit_id_fkey"
    FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON DELETE CASCADE,
  ADD CONSTRAINT "unit_content_license_granted_by_profile_id_profile_id_fkey"
    FOREIGN KEY ("granted_by_profile_id") REFERENCES "profile" ("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "unit_content_license_reference_slug_check"
    CHECK ("reference_license_slug" IN ('rezics-unit-content-license-v1')),
  ADD CONSTRAINT "unit_content_license_revocation_check"
    CHECK ("revoked_at" IS NULL OR "revoked_at" >= "granted_at");

CREATE UNIQUE INDEX "unit_content_license_active_unit_key"
  ON "unit_content_license" ("unit_id")
  WHERE "revoked_at" IS NULL;
CREATE INDEX "unit_content_license_granted_by_idx"
  ON "unit_content_license" ("granted_by_profile_id");
CREATE INDEX "unit_content_license_reference_slug_idx"
  ON "unit_content_license" ("reference_license_slug");

CREATE TRIGGER "search_projection_touch_unit_content_license_insert"
AFTER INSERT ON "unit_content_license"
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION "search_touch_current_statement"('unit_id');

CREATE TRIGGER "search_projection_touch_unit_content_license_update"
AFTER UPDATE ON "unit_content_license"
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION "search_touch_current_statement"('unit_id');

CREATE TRIGGER "search_projection_touch_unit_content_license_delete"
AFTER DELETE ON "unit_content_license"
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT
EXECUTE FUNCTION "search_touch_current_statement"('unit_id');
