-- Add value to enum type: "unit_permission"
ALTER TYPE "unit_permission" ADD VALUE 'unit.realm-publication.manage' AFTER 'unit.tag-curation.manage';
-- Create enum type "realm_unit_publication_state"
CREATE TYPE "realm_unit_publication_state" AS ENUM ('active', 'withdrawn');
-- Modify "unit_access_invitation" table
ALTER TABLE "unit_access_invitation" DROP CONSTRAINT "unit_access_invitation_permissions_check", ADD CONSTRAINT "unit_access_invitation_permissions_check" CHECK (((cardinality(permissions) >= 1) AND (cardinality(permissions) <= 22)) AND (array_position(permissions, 'unit.ownership.transfer'::unit_permission) IS NULL) AND (array_position(permissions, 'unit.delete'::unit_permission) IS NULL));
-- Drop index "realm_unit_moderation_queue_idx" from table: "realm_unit"
DROP INDEX "realm_unit_moderation_queue_idx";
-- Drop index "realm_unit_realm_status_created_idx" from table: "realm_unit"
DROP INDEX "realm_unit_realm_status_created_idx";
-- Drop index "realm_unit_unit_realm_idx" from table: "realm_unit"
DROP INDEX "realm_unit_unit_realm_idx";
-- Modify "realm_unit" table
ALTER TABLE "realm_unit" ADD COLUMN "publication_state" "realm_unit_publication_state" NOT NULL DEFAULT 'active';
-- Keep the database-level Post targeting invariant aligned with effective Realm publication.
CREATE OR REPLACE FUNCTION assert_post_targeting_allowed(
  p_source_post_id uuid,
  p_targets jsonb,
  p_explicit_realm_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  target_record record;
  realm_record record;
  target_locked boolean;
BEGIN
  IF p_targets IS NULL OR jsonb_array_length(p_targets) = 0 THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_source_post_id::text, 4));

  FOR target_record IN
    SELECT DISTINCT ON (target_id)
      target_id,
      relation
    FROM jsonb_to_recordset(p_targets) AS target(target_id uuid, relation text)
    ORDER BY
      target_id,
      CASE relation WHEN 'subject' THEN 0 WHEN 'root' THEN 1 WHEN 'parent' THEN 2 END
  LOOP
    SELECT target.post_targeting_locked
      INTO target_locked
      FROM public.unit AS target
      WHERE target.id = target_record.target_id
      FOR SHARE;
    IF target_locked THEN
      RAISE EXCEPTION 'Post target does not accept new Post relations'
        USING
          ERRCODE = '23514',
          CONSTRAINT = 'post_targeting_global_unlocked',
          DETAIL = jsonb_build_object(
            'scope', 'global',
            'relation', target_record.relation,
            'targetUnitId', target_record.target_id
          )::text;
    END IF;
  END LOOP;

  FOR realm_record IN
    SELECT realm_id
    FROM (
      SELECT source_realm.realm_id
      FROM public.realm_unit AS source_realm
      WHERE source_realm.unit_id = p_source_post_id
        AND source_realm.publication_state = 'active'
      UNION
      SELECT p_explicit_realm_id
      WHERE p_explicit_realm_id IS NOT NULL
    ) AS source_realms
    ORDER BY realm_id
  LOOP
    FOR target_record IN
      SELECT DISTINCT ON (target_id)
        target_id,
        relation
      FROM jsonb_to_recordset(p_targets) AS target(target_id uuid, relation text)
      ORDER BY
        target_id,
        CASE relation WHEN 'subject' THEN 0 WHEN 'root' THEN 1 WHEN 'parent' THEN 2 END
    LOOP
      SELECT realm_target.post_targeting_locked
        INTO target_locked
        FROM public.realm_unit AS realm_target
        WHERE realm_target.realm_id = realm_record.realm_id
          AND realm_target.unit_id = target_record.target_id
          AND realm_target.publication_state = 'active'
        FOR SHARE;
      IF target_locked THEN
        RAISE EXCEPTION 'Post target does not accept new Post relations in this Realm'
          USING
            ERRCODE = '23514',
            CONSTRAINT = 'post_targeting_realm_unlocked',
            DETAIL = jsonb_build_object(
              'scope', 'realm',
              'relation', target_record.relation,
              'targetUnitId', target_record.target_id,
              'realmId', realm_record.realm_id
            )::text;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;
-- Create index "realm_unit_moderation_queue_idx" to table: "realm_unit"
CREATE INDEX "realm_unit_moderation_queue_idx" ON "realm_unit" ("realm_id", "publication_state", "status", "updated_at" DESC NULLS LAST, "unit_id" DESC NULLS LAST);
-- Create index "realm_unit_realm_status_created_idx" to table: "realm_unit"
CREATE INDEX "realm_unit_realm_status_created_idx" ON "realm_unit" ("realm_id", "publication_state", "status", "created_at" DESC NULLS LAST, "unit_id");
-- Create index "realm_unit_unit_publication_status_updated_idx" to table: "realm_unit"
CREATE INDEX "realm_unit_unit_publication_status_updated_idx" ON "realm_unit" ("unit_id", "publication_state", "status", "updated_at" DESC NULLS LAST, "realm_id" DESC NULLS LAST);
-- Create "realm_unit_publication_event" table
CREATE TABLE "realm_unit_publication_event" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "realm_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "from_state" "realm_unit_publication_state" NULL,
  "to_state" "realm_unit_publication_state" NOT NULL,
  "changed_by_profile_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "realm_unit_publication_event_EI9OF02bgNWn_fkey" FOREIGN KEY ("changed_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "realm_unit_publication_event_relation_fkey" FOREIGN KEY ("realm_id", "unit_id") REFERENCES "realm_unit" ("realm_id", "unit_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_unit_publication_event_transition_check" CHECK ((from_state IS NULL) OR (from_state <> to_state))
);
-- Create index "realm_unit_publication_event_actor_idx" to table: "realm_unit_publication_event"
CREATE INDEX "realm_unit_publication_event_actor_idx" ON "realm_unit_publication_event" ("changed_by_profile_id");
-- Create index "realm_unit_publication_event_history_idx" to table: "realm_unit_publication_event"
CREATE INDEX "realm_unit_publication_event_history_idx" ON "realm_unit_publication_event" ("unit_id", "realm_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
-- Backfill the immutable initial intent for every pre-existing relation.
INSERT INTO "realm_unit_publication_event" (
  "realm_id",
  "unit_id",
  "from_state",
  "to_state",
  "changed_by_profile_id",
  "created_at"
)
SELECT
  "realm_id",
  "unit_id",
  NULL,
  'active'::"realm_unit_publication_state",
  NULL,
  "created_at"
FROM "realm_unit";
