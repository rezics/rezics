-- Create index "unit_tag_unit_pinned_position_unique" to table: "unit_tag"
CREATE UNIQUE INDEX "unit_tag_unit_pinned_position_unique" ON "unit_tag" ("unit_id", "position") WHERE pinned;
