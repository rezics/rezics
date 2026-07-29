-- Create "profile_favorites_collection" table
CREATE TABLE "profile_favorites_collection" (
  "profile_id" uuid NOT NULL,
  "collection_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("profile_id"),
  CONSTRAINT "profile_favorites_collection_collection_id_unique" UNIQUE ("collection_id"),
  CONSTRAINT "profile_favorites_collection_collection_id_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collection" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "profile_favorites_collection_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Preserve Favorites identity independently from Collection ownership.
INSERT INTO "profile_favorites_collection" ("profile_id", "collection_id", "created_at")
SELECT "owner_profile_id", "id", "created_at"
FROM "collection"
WHERE "system_key" = 'favorites'::"collection_system_key";
-- Public authorship is credit attribution, not access ownership.
INSERT INTO "credit_attribution" ("source_unit_id", "credited_unit_id", "role")
SELECT "id", "owner_profile_id", 'publisher'
FROM "collection"
ON CONFLICT ("source_unit_id", "credited_unit_id", "role") DO NOTHING;
-- Favorites engagement follows the dedicated Profile relation.
CREATE OR REPLACE FUNCTION maintain_favorite_item_stats() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE row_data collection_item%ROWTYPE; direction bigint; is_favorite boolean; change record;
BEGIN
  IF TG_OP = 'UPDATE' AND
    (OLD.collection_id, OLD.unit_id, OLD.added_by_profile_id, OLD.created_at) IS NOT DISTINCT FROM
    (NEW.collection_id, NEW.unit_id, NEW.added_by_profile_id, NEW.created_at) THEN
    RETURN NULL;
  END IF;
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    SELECT EXISTS (
      SELECT 1 FROM profile_favorites_collection
      WHERE collection_id = row_data.collection_id
    ) INTO is_favorite;
    IF is_favorite THEN
      PERFORM apply_unit_engagement_stat(row_data.unit_id, p_favorites => direction);
      PERFORM apply_recommendation_unit_signal(
        row_data.unit_id, row_data.created_at, 'favorite', direction, direction * 5
      );
      IF row_data.added_by_profile_id IS NOT NULL THEN
        PERFORM apply_recommendation_profile_signal(
          row_data.added_by_profile_id, row_data.unit_id, row_data.created_at,
          'favorite', direction, direction * 5
        );
      END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
-- The marker table now has no mutable aggregate identity columns.
DROP TRIGGER "collection_aggregate_identity_protect" ON "collection";
DROP FUNCTION "protect_collection_aggregate_identity"();
-- Drop indexes owned by the removed access and dynamic-definition columns.
DROP INDEX "collection_owner_created_at_idx";
DROP INDEX "collection_owner_system_key";
-- Modify "collection" table
ALTER TABLE "collection" DROP CONSTRAINT "collection_source_system_key_check", DROP COLUMN "owner_profile_id", DROP COLUMN "source", DROP COLUMN "system_key", DROP COLUMN "definition_document", DROP COLUMN "presentation_document", DROP COLUMN "created_at", DROP COLUMN "updated_at";
-- Drop index "collection_item_collection_position_idx" from table: "collection_item"
DROP INDEX "collection_item_collection_position_idx";
-- Modify "collection_item" table
ALTER TABLE "collection_item" DROP COLUMN "role", ADD CONSTRAINT "collection_item_position_unique" UNIQUE ("collection_id", "position");
-- Create index "collection_item_collection_position_idx" to table: "collection_item"
CREATE INDEX "collection_item_collection_position_idx" ON "collection_item" ("collection_id", "position", "unit_id");
-- Drop enum type "collection_source"
DROP TYPE "collection_source";
-- Drop enum type "collection_system_key"
DROP TYPE "collection_system_key";
-- Drop enum type "collection_item_role"
DROP TYPE "collection_item_role";
