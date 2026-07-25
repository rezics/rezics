-- PostgreSQL exposes a newly added enum value only after its transaction commits.
-- Keep this constraint in the migration after the post_kind extension.
ALTER TABLE "post" ADD CONSTRAINT "post_excerpt_subject_check" CHECK ((kind <> 'excerpt'::post_kind) OR (subject_unit_id IS NOT NULL));
