-- Create "unit_progress_entry" table
CREATE TABLE "unit_progress_entry" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "profile_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "entry_kind" text NOT NULL,
  "status" "progress_status" NOT NULL,
  "progress" double precision NOT NULL,
  "completion_delta" integer NOT NULL DEFAULT 0,
  "total_time_ms" bigint NOT NULL DEFAULT 0,
  "content_structure_node_id" uuid NULL,
  "content_structure_revision_id" uuid NULL,
  "occurred_at" timestamptz(3) NULL,
  "date_precision" text NOT NULL,
  "affects_current" boolean NOT NULL DEFAULT true,
  "deleted_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "unit_progress_entry_id_profile_unit_key" UNIQUE ("id", "profile_id", "unit_id"),
  CONSTRAINT "unit_progress_entry_content_structure_revision_fkey" FOREIGN KEY ("content_structure_revision_id") REFERENCES "content_structure_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_progress_entry_content_structure_node_fkey" FOREIGN KEY ("content_structure_node_id", "unit_id") REFERENCES "content_structure_node" ("id", "owner_unit_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_progress_entry_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_progress_entry_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_progress_entry_completion_delta_check" CHECK ((completion_delta >= 0) AND (completion_delta <= 1)),
  CONSTRAINT "unit_progress_entry_completion_shape_check" CHECK ((entry_kind <> 'completion'::text) OR ((status = 'completed'::progress_status) AND (progress = (1)::double precision) AND (completion_delta = 1) AND (content_structure_node_id IS NULL))),
  CONSTRAINT "unit_progress_entry_date_precision_check" CHECK (date_precision = ANY (ARRAY['instant'::text, 'day'::text, 'month'::text, 'year'::text, 'unknown'::text])),
  CONSTRAINT "unit_progress_entry_deleted_at_check" CHECK ((deleted_at IS NULL) OR (deleted_at >= created_at)),
  CONSTRAINT "unit_progress_entry_kind_check" CHECK (entry_kind = ANY (ARRAY['update'::text, 'completion'::text])),
  CONSTRAINT "unit_progress_entry_occurred_at_check" CHECK ((date_precision = 'unknown'::text) = (occurred_at IS NULL)),
  CONSTRAINT "unit_progress_entry_total_time_check" CHECK (total_time_ms >= 0),
  CONSTRAINT "unit_progress_entry_value_check" CHECK ((progress >= (0)::double precision) AND (progress <= (1)::double precision))
);
-- Create index "unit_progress_entry_content_structure_node_idx" to table: "unit_progress_entry"
CREATE INDEX "unit_progress_entry_content_structure_node_idx" ON "unit_progress_entry" ("content_structure_node_id");
-- Create index "unit_progress_entry_content_structure_revision_idx" to table: "unit_progress_entry"
CREATE INDEX "unit_progress_entry_content_structure_revision_idx" ON "unit_progress_entry" ("content_structure_revision_id");
-- Create index "unit_progress_entry_profile_unit_occurred_idx" to table: "unit_progress_entry"
CREATE INDEX "unit_progress_entry_profile_unit_occurred_idx" ON "unit_progress_entry" ("profile_id", "unit_id", "occurred_at" DESC NULLS LAST, "created_at" DESC NULLS LAST, "id" DESC NULLS LAST) WHERE (deleted_at IS NULL);
-- Create index "unit_progress_entry_unit_idx" to table: "unit_progress_entry"
CREATE INDEX "unit_progress_entry_unit_idx" ON "unit_progress_entry" ("unit_id");
-- Create "post_progress_entry" table
CREATE TABLE "post_progress_entry" (
  "post_id" uuid NOT NULL,
  "progress_entry_id" uuid NOT NULL,
  "position" text NOT NULL COLLATE "C",
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("post_id"),
  CONSTRAINT "post_progress_entry_post_position_key" UNIQUE ("post_id", "position"),
  CONSTRAINT "post_progress_entry_progress_entry_key" UNIQUE ("progress_entry_id"),
  CONSTRAINT "post_progress_entry_progress_entry_fkey" FOREIGN KEY ("progress_entry_id") REFERENCES "unit_progress_entry" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "post_progress_entry_post_id_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "post_progress_entry_progress_entry_idx" to table: "post_progress_entry"
CREATE INDEX "post_progress_entry_progress_entry_idx" ON "post_progress_entry" ("progress_entry_id");
-- Modify "unit_progress" table
ALTER TABLE "unit_progress" ADD COLUMN "current_entry_id" uuid NULL, ADD CONSTRAINT "unit_progress_current_entry_fkey" FOREIGN KEY ("current_entry_id") REFERENCES "unit_progress_entry" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Create index "unit_progress_current_entry_idx" to table: "unit_progress"
CREATE INDEX "unit_progress_current_entry_idx" ON "unit_progress" ("current_entry_id");
