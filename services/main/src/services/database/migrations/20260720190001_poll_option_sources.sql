-- Create enum type "poll_option_source_kind"
CREATE TYPE "poll_option_source_kind" AS ENUM ('literal', 'unit');
-- Modify "poll_option" table
ALTER TABLE "poll_option" ADD CONSTRAINT "poll_option_source_check" CHECK (((source_kind = 'literal'::poll_option_source_kind) AND (target_unit_id IS NULL)) OR ((source_kind = 'unit'::poll_option_source_kind) AND (target_unit_id IS NOT NULL))), ADD COLUMN "source_kind" "poll_option_source_kind" NOT NULL DEFAULT 'literal', ADD COLUMN "target_unit_id" uuid NULL, ADD CONSTRAINT "poll_option_target_unit_id_unit_id_fkey" FOREIGN KEY ("target_unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "poll_option_target_unit_idx" to table: "poll_option"
CREATE INDEX "poll_option_target_unit_idx" ON "poll_option" ("target_unit_id");
