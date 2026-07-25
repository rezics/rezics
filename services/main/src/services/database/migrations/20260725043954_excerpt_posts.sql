-- Add value to enum type: "post_kind"
ALTER TYPE "post_kind" ADD VALUE 'excerpt' AFTER 'reply';
-- Modify "post" table
ALTER TABLE "post" ADD CONSTRAINT "post_excerpt_subject_check" CHECK ((kind <> 'excerpt'::post_kind) OR (subject_unit_id IS NOT NULL));
