-- Create enum type "book_chapter_draft_job_state"
CREATE TYPE "book_chapter_draft_job_state" AS ENUM ('pending', 'processing', 'retry_wait', 'completed', 'cancelled', 'failed');
-- Create "book_chapter_draft_job" table
CREATE TABLE "book_chapter_draft_job" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "book_id" uuid NOT NULL,
  "structure_id" uuid NULL,
  "requested_by_profile_id" uuid NOT NULL,
  "book_updated_at" timestamptz(3) NOT NULL,
  "state" "book_chapter_draft_job_state" NOT NULL DEFAULT 'pending',
  "cursor_node_id" uuid NULL,
  "processed_node_count" bigint NOT NULL DEFAULT 0,
  "drafted_chapter_count" bigint NOT NULL DEFAULT 0,
  "skipped_chapter_count" bigint NOT NULL DEFAULT 0,
  "attempt_count" integer NOT NULL DEFAULT 0,
  "available_at" timestamptz(3) NOT NULL DEFAULT now(),
  "lease_token" uuid NULL,
  "lease_expires_at" timestamptz(3) NULL,
  "last_error_message" text NULL,
  "completed_at" timestamptz(3) NULL,
  "cancelled_at" timestamptz(3) NULL,
  "failed_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "book_chapter_draft_job_book_id_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "book" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "book_chapter_draft_job_requested_by_profile_id_profile_id_fkey" FOREIGN KEY ("requested_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "book_chapter_draft_job_structure_id_content_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "content_structure" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "book_chapter_draft_job_attempt_count_check" CHECK (attempt_count >= 0),
  CONSTRAINT "book_chapter_draft_job_drafted_count_check" CHECK (drafted_chapter_count >= 0),
  CONSTRAINT "book_chapter_draft_job_lease_shape_check" CHECK ((state = 'processing'::book_chapter_draft_job_state) = ((lease_token IS NOT NULL) AND (lease_expires_at IS NOT NULL))),
  CONSTRAINT "book_chapter_draft_job_processed_count_check" CHECK (processed_node_count >= 0),
  CONSTRAINT "book_chapter_draft_job_skipped_count_check" CHECK (skipped_chapter_count >= 0)
);
-- Create index "book_chapter_draft_job_active_book_key" to table: "book_chapter_draft_job"
CREATE UNIQUE INDEX "book_chapter_draft_job_active_book_key" ON "book_chapter_draft_job" ("book_id") WHERE (state = ANY (ARRAY['pending'::book_chapter_draft_job_state, 'processing'::book_chapter_draft_job_state, 'retry_wait'::book_chapter_draft_job_state]));
-- Create index "book_chapter_draft_job_book_created_idx" to table: "book_chapter_draft_job"
CREATE INDEX "book_chapter_draft_job_book_created_idx" ON "book_chapter_draft_job" ("book_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
-- Create index "book_chapter_draft_job_claim_idx" to table: "book_chapter_draft_job"
CREATE INDEX "book_chapter_draft_job_claim_idx" ON "book_chapter_draft_job" ("available_at", "created_at", "id") WHERE (state = ANY (ARRAY['pending'::book_chapter_draft_job_state, 'retry_wait'::book_chapter_draft_job_state]));
-- Create index "book_chapter_draft_job_lease_idx" to table: "book_chapter_draft_job"
CREATE INDEX "book_chapter_draft_job_lease_idx" ON "book_chapter_draft_job" ("lease_expires_at", "id") WHERE (state = 'processing'::book_chapter_draft_job_state);
