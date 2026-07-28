-- Represent every existing Zone Page in the shared Post kind model.
INSERT INTO "post" ("id", "subject_unit_id", "kind", "created_at", "updated_at")
SELECT
  "id",
  "zone_id",
  'page'::post_kind,
  "created_at",
  "updated_at"
FROM "zone_page"
ON CONFLICT ("id") DO UPDATE
SET
  "subject_unit_id" = EXCLUDED."subject_unit_id",
  "kind" = EXCLUDED."kind",
  "updated_at" = EXCLUDED."updated_at";
