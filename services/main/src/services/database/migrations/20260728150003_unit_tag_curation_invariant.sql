-- Modify "unit_tag" table
ALTER TABLE "unit_tag" ADD CONSTRAINT "unit_tag_pinned_position_check" CHECK ((pinned AND ("position" IS NOT NULL)) OR ((NOT pinned) AND ("position" IS NULL)));
