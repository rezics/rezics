SET search_path TO public;

-- Create "reference_value" table
CREATE TABLE "reference_value" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "target_publishing_id" uuid NULL,
  "target_music_id" uuid NULL,
  "target_program_id" uuid NULL,
  "target_software_id" uuid NULL,
  "target_entity_id" uuid NULL,
  "target_grouping_id" uuid NULL,
  "target_reference_id" uuid NULL,
  "target_distribution_id" uuid NULL,
  "target_video_id" uuid NULL,
  "target_audio_id" uuid NULL,
  "target_post_id" uuid NULL,
  "target_poll_id" uuid NULL,
  "target_zone_id" uuid NULL,
  "target_realm_id" uuid NULL,
  "target_realm_rule_id" uuid NULL,
  "target_custom_theme_id" uuid NULL,
  "target_collection_id" uuid NULL,
  "target_tag_id" uuid NULL,
  "target_tag_path_id" uuid NULL,
  "target_label_id" uuid NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "reference_value_c87fLhgxHt66_fkey" FOREIGN KEY ("target_distribution_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_value_j0YUxh80sQZi_fkey" FOREIGN KEY ("target_publishing_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_value_target_audio_id_audio_id_fkey" FOREIGN KEY ("target_audio_id") REFERENCES "audio" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_value_target_collection_id_collection_id_fkey" FOREIGN KEY ("target_collection_id") REFERENCES "collection" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_value_target_custom_theme_id_custom_theme_id_fkey" FOREIGN KEY ("target_custom_theme_id") REFERENCES "custom_theme" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_value_target_entity_id_entity_identity_id_fkey" FOREIGN KEY ("target_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_value_target_grouping_id_grouping_identity_id_fkey" FOREIGN KEY ("target_grouping_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_value_target_label_id_label_id_fkey" FOREIGN KEY ("target_label_id") REFERENCES "label" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_value_target_music_id_music_identity_id_fkey" FOREIGN KEY ("target_music_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_value_target_poll_id_poll_id_fkey" FOREIGN KEY ("target_poll_id") REFERENCES "poll" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_value_target_post_id_post_id_fkey" FOREIGN KEY ("target_post_id") REFERENCES "post" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_value_target_program_id_program_identity_id_fkey" FOREIGN KEY ("target_program_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_value_target_realm_id_realm_id_fkey" FOREIGN KEY ("target_realm_id") REFERENCES "realm" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_value_target_realm_rule_id_realm_rule_id_fkey" FOREIGN KEY ("target_realm_rule_id") REFERENCES "realm_rule" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_value_target_reference_id_reference_identity_id_fkey" FOREIGN KEY ("target_reference_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_value_target_software_id_software_identity_id_fkey" FOREIGN KEY ("target_software_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_value_target_tag_id_tag_id_fkey" FOREIGN KEY ("target_tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_value_target_tag_path_id_tag_path_id_fkey" FOREIGN KEY ("target_tag_path_id") REFERENCES "tag_path" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_value_target_video_id_video_id_fkey" FOREIGN KEY ("target_video_id") REFERENCES "video" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_value_target_zone_id_zone_id_fkey" FOREIGN KEY ("target_zone_id") REFERENCES "zone" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_value_target_check" CHECK (num_nonnulls(target_publishing_id, target_music_id, target_program_id, target_software_id, target_entity_id, target_grouping_id, target_reference_id, target_distribution_id, target_video_id, target_audio_id, target_post_id, target_poll_id, target_zone_id, target_realm_id, target_realm_rule_id, target_custom_theme_id, target_collection_id, target_tag_id, target_tag_path_id, target_label_id) = 1)
);
-- Create index "reference_value_target_audio_key" to table: "reference_value"
CREATE UNIQUE INDEX "reference_value_target_audio_key" ON "reference_value" ("target_audio_id") WHERE (target_audio_id IS NOT NULL);
-- Create index "reference_value_target_collection_key" to table: "reference_value"
CREATE UNIQUE INDEX "reference_value_target_collection_key" ON "reference_value" ("target_collection_id") WHERE (target_collection_id IS NOT NULL);
-- Create index "reference_value_target_custom_theme_key" to table: "reference_value"
CREATE UNIQUE INDEX "reference_value_target_custom_theme_key" ON "reference_value" ("target_custom_theme_id") WHERE (target_custom_theme_id IS NOT NULL);
-- Create index "reference_value_target_distribution_key" to table: "reference_value"
CREATE UNIQUE INDEX "reference_value_target_distribution_key" ON "reference_value" ("target_distribution_id") WHERE (target_distribution_id IS NOT NULL);
-- Create index "reference_value_target_entity_key" to table: "reference_value"
CREATE UNIQUE INDEX "reference_value_target_entity_key" ON "reference_value" ("target_entity_id") WHERE (target_entity_id IS NOT NULL);
-- Create index "reference_value_target_grouping_key" to table: "reference_value"
CREATE UNIQUE INDEX "reference_value_target_grouping_key" ON "reference_value" ("target_grouping_id") WHERE (target_grouping_id IS NOT NULL);
-- Create index "reference_value_target_label_key" to table: "reference_value"
CREATE UNIQUE INDEX "reference_value_target_label_key" ON "reference_value" ("target_label_id") WHERE (target_label_id IS NOT NULL);
-- Create index "reference_value_target_music_key" to table: "reference_value"
CREATE UNIQUE INDEX "reference_value_target_music_key" ON "reference_value" ("target_music_id") WHERE (target_music_id IS NOT NULL);
-- Create index "reference_value_target_poll_key" to table: "reference_value"
CREATE UNIQUE INDEX "reference_value_target_poll_key" ON "reference_value" ("target_poll_id") WHERE (target_poll_id IS NOT NULL);
-- Create index "reference_value_target_post_key" to table: "reference_value"
CREATE UNIQUE INDEX "reference_value_target_post_key" ON "reference_value" ("target_post_id") WHERE (target_post_id IS NOT NULL);
-- Create index "reference_value_target_program_key" to table: "reference_value"
CREATE UNIQUE INDEX "reference_value_target_program_key" ON "reference_value" ("target_program_id") WHERE (target_program_id IS NOT NULL);
-- Create index "reference_value_target_publishing_key" to table: "reference_value"
CREATE UNIQUE INDEX "reference_value_target_publishing_key" ON "reference_value" ("target_publishing_id") WHERE (target_publishing_id IS NOT NULL);
-- Create index "reference_value_target_realm_key" to table: "reference_value"
CREATE UNIQUE INDEX "reference_value_target_realm_key" ON "reference_value" ("target_realm_id") WHERE (target_realm_id IS NOT NULL);
-- Create index "reference_value_target_realm_rule_key" to table: "reference_value"
CREATE UNIQUE INDEX "reference_value_target_realm_rule_key" ON "reference_value" ("target_realm_rule_id") WHERE (target_realm_rule_id IS NOT NULL);
-- Create index "reference_value_target_reference_key" to table: "reference_value"
CREATE UNIQUE INDEX "reference_value_target_reference_key" ON "reference_value" ("target_reference_id") WHERE (target_reference_id IS NOT NULL);
-- Create index "reference_value_target_software_key" to table: "reference_value"
CREATE UNIQUE INDEX "reference_value_target_software_key" ON "reference_value" ("target_software_id") WHERE (target_software_id IS NOT NULL);
-- Create index "reference_value_target_tag_key" to table: "reference_value"
CREATE UNIQUE INDEX "reference_value_target_tag_key" ON "reference_value" ("target_tag_id") WHERE (target_tag_id IS NOT NULL);
-- Create index "reference_value_target_tag_path_key" to table: "reference_value"
CREATE UNIQUE INDEX "reference_value_target_tag_path_key" ON "reference_value" ("target_tag_path_id") WHERE (target_tag_path_id IS NOT NULL);
-- Create index "reference_value_target_video_key" to table: "reference_value"
CREATE UNIQUE INDEX "reference_value_target_video_key" ON "reference_value" ("target_video_id") WHERE (target_video_id IS NOT NULL);
-- Create index "reference_value_target_zone_key" to table: "reference_value"
CREATE UNIQUE INDEX "reference_value_target_zone_key" ON "reference_value" ("target_zone_id") WHERE (target_zone_id IS NOT NULL);

DROP TRIGGER IF EXISTS reference_value_immutable ON public.reference_value;
CREATE TRIGGER reference_value_immutable
BEFORE UPDATE OR DELETE ON public.reference_value
FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
