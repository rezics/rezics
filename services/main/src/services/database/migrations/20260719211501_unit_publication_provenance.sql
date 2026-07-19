-- Create enum type "unit_status_actor_kind"
CREATE TYPE "unit_status_actor_kind" AS ENUM ('profile', 'system', 'import');
-- Modify "post" table
ALTER TABLE "post" DROP COLUMN "author_profile_id";
-- Create "unit_status_event" table
CREATE TABLE "unit_status_event" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "unit_id" uuid NOT NULL,
  "from_status" "unit_status" NULL,
  "to_status" "unit_status" NOT NULL,
  "actor_kind" "unit_status_actor_kind" NOT NULL,
  "changed_by_profile_id" uuid NULL,
  "revision_id" uuid NULL,
  "actor_hidden" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "unit_status_event_changed_by_profile_id_profile_id_fkey" FOREIGN KEY ("changed_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_status_event_revision_unit_fkey" FOREIGN KEY ("revision_id", "unit_id") REFERENCES "unit_revision" ("id", "unit_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_status_event_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_status_event_actor_shape_check" CHECK (((actor_kind = 'profile'::unit_status_actor_kind) AND (changed_by_profile_id IS NOT NULL)) OR ((actor_kind = ANY (ARRAY['system'::unit_status_actor_kind, 'import'::unit_status_actor_kind])) AND (changed_by_profile_id IS NULL))),
  CONSTRAINT "unit_status_event_transition_check" CHECK ((from_status IS NULL) OR (from_status <> to_status))
);
-- Create index "unit_status_event_actor_created_at_idx" to table: "unit_status_event"
CREATE INDEX "unit_status_event_actor_created_at_idx" ON "unit_status_event" ("changed_by_profile_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
-- Create index "unit_status_event_publication_idx" to table: "unit_status_event"
CREATE INDEX "unit_status_event_publication_idx" ON "unit_status_event" ("unit_id", "to_status", "created_at", "id");
-- Create index "unit_status_event_unit_created_at_idx" to table: "unit_status_event"
CREATE INDEX "unit_status_event_unit_created_at_idx" ON "unit_status_event" ("unit_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
