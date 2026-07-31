-- A Unit content License is a one-time, immutable grant. Unit availability,
-- removal, and monetization remain independent lifecycle concerns.
DROP TRIGGER "search_projection_touch_unit_content_license_update"
  ON "unit_content_license";

DROP TRIGGER "search_projection_touch_unit_content_license_delete"
  ON "unit_content_license";

DROP INDEX "unit_content_license_active_unit_key";

ALTER TABLE "unit_content_license"
  DROP CONSTRAINT "unit_content_license_revocation_check",
  DROP CONSTRAINT "unit_content_license_unit_id_unit_id_fkey",
  DROP COLUMN "revoked_at";

ALTER TABLE "unit_content_license"
  ADD CONSTRAINT "unit_content_license_unit_id_unit_id_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON DELETE RESTRICT;

CREATE UNIQUE INDEX "unit_content_license_unit_key"
  ON "unit_content_license" ("unit_id");

CREATE TRIGGER "unit_content_license_immutable"
BEFORE UPDATE OR DELETE ON "unit_content_license"
FOR EACH ROW
EXECUTE FUNCTION "reject_immutable_history_mutation"();
