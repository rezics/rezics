SET search_path TO public;

-- This stopped-site owner contract is accepted on a fresh target. Existing imported
-- platform rows and private snapshots must be transferred by the separate converter.
DO 'DECLARE relation_name text; has_rows boolean;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[''account_favorite'',''account_favorite_revision'',''video'',''audio'',''post'',''poll'',''zone'',''realm'',''realm_rule'',''custom_theme'',''collection'',''tag'',''tag_path'',''label''] LOOP
    EXECUTE format(''SELECT EXISTS(SELECT 1 FROM public.%I LIMIT 1)'',relation_name) INTO has_rows;
    IF has_rows THEN RAISE EXCEPTION ''Owner-reference target is not fresh: %'',relation_name; END IF;
  END LOOP;
END';

-- Modify "account_erasure" table
ALTER TABLE "account_erasure" DROP CONSTRAINT "account_erasure_stage_check", ADD CONSTRAINT "account_erasure_stage_check" CHECK (stage = ANY (ARRAY['sessions'::text, 'credentials'::text, 'quota_account_leases'::text, 'quota_account_daily'::text, 'quota_account_rates'::text, 'quota_reservations'::text, 'quota_account_binding'::text, 'api_tokens'::text, 'verification'::text, 'auth_mail'::text, 'preferences'::text, 'notifications'::text, 'notification_preferences'::text, 'notification_stats'::text, 'sent_messages'::text, 'conversation_reads'::text, 'conversation_stats'::text, 'account_blocks'::text, 'progress'::text, 'progress_entries'::text, 'progress_nodes'::text, 'progress_stats'::text, 'recommendation_events'::text, 'recommendation_exclusions'::text, 'studio_visits'::text, 'studio_candidates'::text, 'follow_preferences'::text, 'membership_sent_invitations'::text, 'organization_membership_events'::text, 'organization_memberships'::text, 'membership_received_invitations'::text, 'favorite_history'::text, 'favorites'::text, 'favorites_state'::text, 'tag_subscriptions'::text, 'personal_tags'::text, 'private_images'::text, 'complete'::text]));
-- Modify "catalog_unit_locator" table
ALTER TABLE "catalog_unit_locator" DROP CONSTRAINT "catalog_unit_locator_owner_check", ADD CONSTRAINT "catalog_unit_locator_owner_check" CHECK (owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text, 'distribution'::text, 'video'::text, 'audio'::text, 'post'::text, 'poll'::text, 'zone'::text, 'realm'::text, 'realm_rule'::text, 'custom_theme'::text, 'collection'::text, 'tag'::text, 'tag_path'::text, 'label'::text]));
-- Create index "distribution_named_form_preview_idx" to table: "distribution_named_form"
CREATE INDEX "distribution_named_form_preview_idx" ON "distribution_named_form" ("owner_id", "id") WHERE ((state = 'active'::text) AND (spoiler = 0) AND (scope_owner_id IS NULL));
-- Create index "entity_named_form_preview_idx" to table: "entity_named_form"
CREATE INDEX "entity_named_form_preview_idx" ON "entity_named_form" ("owner_id", "id") WHERE ((state = 'active'::text) AND (spoiler = 0) AND (scope_owner_id IS NULL));
-- Create index "grouping_named_form_preview_idx" to table: "grouping_named_form"
CREATE INDEX "grouping_named_form_preview_idx" ON "grouping_named_form" ("owner_id", "id") WHERE ((state = 'active'::text) AND (spoiler = 0) AND (scope_owner_id IS NULL));
-- Create index "music_named_form_preview_idx" to table: "music_named_form"
CREATE INDEX "music_named_form_preview_idx" ON "music_named_form" ("owner_id", "id") WHERE ((state = 'active'::text) AND (spoiler = 0) AND (scope_owner_id IS NULL));
-- Create index "program_named_form_preview_idx" to table: "program_named_form"
CREATE INDEX "program_named_form_preview_idx" ON "program_named_form" ("owner_id", "id") WHERE ((state = 'active'::text) AND (spoiler = 0) AND (scope_owner_id IS NULL));
-- Create index "publishing_named_form_preview_idx" to table: "publishing_named_form"
CREATE INDEX "publishing_named_form_preview_idx" ON "publishing_named_form" ("owner_id", "id") WHERE ((state = 'active'::text) AND (spoiler = 0) AND (scope_owner_id IS NULL));
-- Create index "reference_named_form_preview_idx" to table: "reference_named_form"
CREATE INDEX "reference_named_form_preview_idx" ON "reference_named_form" ("owner_id", "id") WHERE ((state = 'active'::text) AND (spoiler = 0) AND (scope_owner_id IS NULL));
-- Create index "software_named_form_preview_idx" to table: "software_named_form"
CREATE INDEX "software_named_form_preview_idx" ON "software_named_form" ("owner_id", "id") WHERE ((state = 'active'::text) AND (spoiler = 0) AND (scope_owner_id IS NULL));
-- Modify "account_favorite" table
ALTER TABLE "account_favorite" DROP CONSTRAINT "account_favorite_target_unit_id_unit_id_fkey", ADD CONSTRAINT "account_favorite_target_unit_id_check" CHECK (NOT (target_unit_id IS DISTINCT FROM COALESCE(target_unit_publishing_id, target_unit_music_id, target_unit_program_id, target_unit_software_id, target_unit_entity_id, target_unit_grouping_id, target_unit_reference_id, target_unit_distribution_id, target_unit_video_id, target_unit_audio_id, target_unit_post_id, target_unit_poll_id, target_unit_zone_id, target_unit_realm_id, target_unit_realm_rule_id, target_unit_custom_theme_id, target_unit_collection_id, target_unit_tag_id, target_unit_tag_path_id, target_unit_label_id))), ADD CONSTRAINT "account_favorite_target_unit_target_check" CHECK (num_nonnulls(target_unit_publishing_id, target_unit_music_id, target_unit_program_id, target_unit_software_id, target_unit_entity_id, target_unit_grouping_id, target_unit_reference_id, target_unit_distribution_id, target_unit_video_id, target_unit_audio_id, target_unit_post_id, target_unit_poll_id, target_unit_zone_id, target_unit_realm_id, target_unit_realm_rule_id, target_unit_custom_theme_id, target_unit_collection_id, target_unit_tag_id, target_unit_tag_path_id, target_unit_label_id) = 1), ADD COLUMN "target_unit_publishing_id" uuid NULL, ADD COLUMN "target_unit_music_id" uuid NULL, ADD COLUMN "target_unit_program_id" uuid NULL, ADD COLUMN "target_unit_software_id" uuid NULL, ADD COLUMN "target_unit_entity_id" uuid NULL, ADD COLUMN "target_unit_grouping_id" uuid NULL, ADD COLUMN "target_unit_reference_id" uuid NULL, ADD COLUMN "target_unit_distribution_id" uuid NULL, ADD COLUMN "target_unit_video_id" uuid NULL, ADD COLUMN "target_unit_audio_id" uuid NULL, ADD COLUMN "target_unit_post_id" uuid NULL, ADD COLUMN "target_unit_poll_id" uuid NULL, ADD COLUMN "target_unit_zone_id" uuid NULL, ADD COLUMN "target_unit_realm_id" uuid NULL, ADD COLUMN "target_unit_realm_rule_id" uuid NULL, ADD COLUMN "target_unit_custom_theme_id" uuid NULL, ADD COLUMN "target_unit_collection_id" uuid NULL, ADD COLUMN "target_unit_tag_id" uuid NULL, ADD COLUMN "target_unit_tag_path_id" uuid NULL, ADD COLUMN "target_unit_label_id" uuid NULL, ADD COLUMN "target_owner" text NOT NULL GENERATED ALWAYS AS (
CASE
    WHEN (target_unit_publishing_id IS NOT NULL) THEN 'publishing'::text
    WHEN (target_unit_music_id IS NOT NULL) THEN 'music'::text
    WHEN (target_unit_program_id IS NOT NULL) THEN 'program'::text
    WHEN (target_unit_software_id IS NOT NULL) THEN 'software'::text
    WHEN (target_unit_entity_id IS NOT NULL) THEN 'entity'::text
    WHEN (target_unit_grouping_id IS NOT NULL) THEN 'grouping'::text
    WHEN (target_unit_reference_id IS NOT NULL) THEN 'reference'::text
    WHEN (target_unit_distribution_id IS NOT NULL) THEN 'distribution'::text
    WHEN (target_unit_video_id IS NOT NULL) THEN 'video'::text
    WHEN (target_unit_audio_id IS NOT NULL) THEN 'audio'::text
    WHEN (target_unit_post_id IS NOT NULL) THEN 'post'::text
    WHEN (target_unit_poll_id IS NOT NULL) THEN 'poll'::text
    WHEN (target_unit_zone_id IS NOT NULL) THEN 'zone'::text
    WHEN (target_unit_realm_id IS NOT NULL) THEN 'realm'::text
    WHEN (target_unit_realm_rule_id IS NOT NULL) THEN 'realm_rule'::text
    WHEN (target_unit_custom_theme_id IS NOT NULL) THEN 'custom_theme'::text
    WHEN (target_unit_collection_id IS NOT NULL) THEN 'collection'::text
    WHEN (target_unit_tag_id IS NOT NULL) THEN 'tag'::text
    WHEN (target_unit_tag_path_id IS NOT NULL) THEN 'tag_path'::text
    WHEN (target_unit_label_id IS NOT NULL) THEN 'label'::text
    ELSE NULL::text
END) STORED, ADD CONSTRAINT "account_favorite_9Uhg6zzYNvJw_fkey" FOREIGN KEY ("target_unit_distribution_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_O6u26suawQ8S_fkey" FOREIGN KEY ("target_unit_program_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_V5ctZPzcSnXW_fkey" FOREIGN KEY ("target_unit_grouping_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_W1U8XDyOrJ03_fkey" FOREIGN KEY ("target_unit_custom_theme_id") REFERENCES "custom_theme" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_YeDnPP9JqAk4_fkey" FOREIGN KEY ("target_unit_publishing_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_oDaFOLv74qqs_fkey" FOREIGN KEY ("target_unit_software_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_target_unit_audio_id_audio_id_fkey" FOREIGN KEY ("target_unit_audio_id") REFERENCES "audio" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_target_unit_collection_id_collection_id_fkey" FOREIGN KEY ("target_unit_collection_id") REFERENCES "collection" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_target_unit_entity_id_entity_identity_id_fkey" FOREIGN KEY ("target_unit_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_target_unit_label_id_label_id_fkey" FOREIGN KEY ("target_unit_label_id") REFERENCES "label" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_target_unit_music_id_music_identity_id_fkey" FOREIGN KEY ("target_unit_music_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_target_unit_poll_id_poll_id_fkey" FOREIGN KEY ("target_unit_poll_id") REFERENCES "poll" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_target_unit_post_id_post_id_fkey" FOREIGN KEY ("target_unit_post_id") REFERENCES "post" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_target_unit_realm_id_realm_id_fkey" FOREIGN KEY ("target_unit_realm_id") REFERENCES "realm" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_target_unit_realm_rule_id_realm_rule_id_fkey" FOREIGN KEY ("target_unit_realm_rule_id") REFERENCES "realm_rule" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_target_unit_tag_id_tag_id_fkey" FOREIGN KEY ("target_unit_tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_target_unit_tag_path_id_tag_path_id_fkey" FOREIGN KEY ("target_unit_tag_path_id") REFERENCES "tag_path" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_target_unit_video_id_video_id_fkey" FOREIGN KEY ("target_unit_video_id") REFERENCES "video" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_target_unit_zone_id_zone_id_fkey" FOREIGN KEY ("target_unit_zone_id") REFERENCES "zone" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_vhfdAJdji4w0_fkey" FOREIGN KEY ("target_unit_reference_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "account_favorite_target_unit_audio_ref_idx" to table: "account_favorite"
CREATE INDEX "account_favorite_target_unit_audio_ref_idx" ON "account_favorite" ("target_unit_audio_id") WHERE (target_unit_audio_id IS NOT NULL);
-- Create index "account_favorite_target_unit_collection_ref_idx" to table: "account_favorite"
CREATE INDEX "account_favorite_target_unit_collection_ref_idx" ON "account_favorite" ("target_unit_collection_id") WHERE (target_unit_collection_id IS NOT NULL);
-- Create index "account_favorite_target_unit_custom_theme_ref_idx" to table: "account_favorite"
CREATE INDEX "account_favorite_target_unit_custom_theme_ref_idx" ON "account_favorite" ("target_unit_custom_theme_id") WHERE (target_unit_custom_theme_id IS NOT NULL);
-- Create index "account_favorite_target_unit_distribution_ref_idx" to table: "account_favorite"
CREATE INDEX "account_favorite_target_unit_distribution_ref_idx" ON "account_favorite" ("target_unit_distribution_id") WHERE (target_unit_distribution_id IS NOT NULL);
-- Create index "account_favorite_target_unit_entity_ref_idx" to table: "account_favorite"
CREATE INDEX "account_favorite_target_unit_entity_ref_idx" ON "account_favorite" ("target_unit_entity_id") WHERE (target_unit_entity_id IS NOT NULL);
-- Create index "account_favorite_target_unit_grouping_ref_idx" to table: "account_favorite"
CREATE INDEX "account_favorite_target_unit_grouping_ref_idx" ON "account_favorite" ("target_unit_grouping_id") WHERE (target_unit_grouping_id IS NOT NULL);
-- Create index "account_favorite_target_unit_label_ref_idx" to table: "account_favorite"
CREATE INDEX "account_favorite_target_unit_label_ref_idx" ON "account_favorite" ("target_unit_label_id") WHERE (target_unit_label_id IS NOT NULL);
-- Create index "account_favorite_target_unit_music_ref_idx" to table: "account_favorite"
CREATE INDEX "account_favorite_target_unit_music_ref_idx" ON "account_favorite" ("target_unit_music_id") WHERE (target_unit_music_id IS NOT NULL);
-- Create index "account_favorite_target_unit_poll_ref_idx" to table: "account_favorite"
CREATE INDEX "account_favorite_target_unit_poll_ref_idx" ON "account_favorite" ("target_unit_poll_id") WHERE (target_unit_poll_id IS NOT NULL);
-- Create index "account_favorite_target_unit_post_ref_idx" to table: "account_favorite"
CREATE INDEX "account_favorite_target_unit_post_ref_idx" ON "account_favorite" ("target_unit_post_id") WHERE (target_unit_post_id IS NOT NULL);
-- Create index "account_favorite_target_unit_program_ref_idx" to table: "account_favorite"
CREATE INDEX "account_favorite_target_unit_program_ref_idx" ON "account_favorite" ("target_unit_program_id") WHERE (target_unit_program_id IS NOT NULL);
-- Create index "account_favorite_target_unit_publishing_ref_idx" to table: "account_favorite"
CREATE INDEX "account_favorite_target_unit_publishing_ref_idx" ON "account_favorite" ("target_unit_publishing_id") WHERE (target_unit_publishing_id IS NOT NULL);
-- Create index "account_favorite_target_unit_realm_ref_idx" to table: "account_favorite"
CREATE INDEX "account_favorite_target_unit_realm_ref_idx" ON "account_favorite" ("target_unit_realm_id") WHERE (target_unit_realm_id IS NOT NULL);
-- Create index "account_favorite_target_unit_realm_rule_ref_idx" to table: "account_favorite"
CREATE INDEX "account_favorite_target_unit_realm_rule_ref_idx" ON "account_favorite" ("target_unit_realm_rule_id") WHERE (target_unit_realm_rule_id IS NOT NULL);
-- Create index "account_favorite_target_unit_reference_ref_idx" to table: "account_favorite"
CREATE INDEX "account_favorite_target_unit_reference_ref_idx" ON "account_favorite" ("target_unit_reference_id") WHERE (target_unit_reference_id IS NOT NULL);
-- Create index "account_favorite_target_unit_software_ref_idx" to table: "account_favorite"
CREATE INDEX "account_favorite_target_unit_software_ref_idx" ON "account_favorite" ("target_unit_software_id") WHERE (target_unit_software_id IS NOT NULL);
-- Create index "account_favorite_target_unit_tag_path_ref_idx" to table: "account_favorite"
CREATE INDEX "account_favorite_target_unit_tag_path_ref_idx" ON "account_favorite" ("target_unit_tag_path_id") WHERE (target_unit_tag_path_id IS NOT NULL);
-- Create index "account_favorite_target_unit_tag_ref_idx" to table: "account_favorite"
CREATE INDEX "account_favorite_target_unit_tag_ref_idx" ON "account_favorite" ("target_unit_tag_id") WHERE (target_unit_tag_id IS NOT NULL);
-- Create index "account_favorite_target_unit_video_ref_idx" to table: "account_favorite"
CREATE INDEX "account_favorite_target_unit_video_ref_idx" ON "account_favorite" ("target_unit_video_id") WHERE (target_unit_video_id IS NOT NULL);
-- Create index "account_favorite_target_unit_zone_ref_idx" to table: "account_favorite"
CREATE INDEX "account_favorite_target_unit_zone_ref_idx" ON "account_favorite" ("target_unit_zone_id") WHERE (target_unit_zone_id IS NOT NULL);
-- Modify "account_favorite_revision" table
ALTER TABLE "account_favorite_revision" DROP CONSTRAINT "account_favorite_revision_target_unit_id_unit_id_fkey", ADD CONSTRAINT "account_favorite_revision_target_snapshot_check" CHECK ((snapshot IS NULL) OR ((((snapshot #>> '{target,id}'::text[]) = (target_unit_id)::text) AND ((snapshot #>> '{target,owner}'::text[]) = target_owner)) IS TRUE)), ADD CONSTRAINT "account_favorite_revision_target_unit_id_check" CHECK (NOT (target_unit_id IS DISTINCT FROM COALESCE(target_unit_publishing_id, target_unit_music_id, target_unit_program_id, target_unit_software_id, target_unit_entity_id, target_unit_grouping_id, target_unit_reference_id, target_unit_distribution_id, target_unit_video_id, target_unit_audio_id, target_unit_post_id, target_unit_poll_id, target_unit_zone_id, target_unit_realm_id, target_unit_realm_rule_id, target_unit_custom_theme_id, target_unit_collection_id, target_unit_tag_id, target_unit_tag_path_id, target_unit_label_id))), ADD CONSTRAINT "account_favorite_revision_target_unit_target_check" CHECK (num_nonnulls(target_unit_publishing_id, target_unit_music_id, target_unit_program_id, target_unit_software_id, target_unit_entity_id, target_unit_grouping_id, target_unit_reference_id, target_unit_distribution_id, target_unit_video_id, target_unit_audio_id, target_unit_post_id, target_unit_poll_id, target_unit_zone_id, target_unit_realm_id, target_unit_realm_rule_id, target_unit_custom_theme_id, target_unit_collection_id, target_unit_tag_id, target_unit_tag_path_id, target_unit_label_id) = 1), ADD COLUMN "target_unit_publishing_id" uuid NULL, ADD COLUMN "target_unit_music_id" uuid NULL, ADD COLUMN "target_unit_program_id" uuid NULL, ADD COLUMN "target_unit_software_id" uuid NULL, ADD COLUMN "target_unit_entity_id" uuid NULL, ADD COLUMN "target_unit_grouping_id" uuid NULL, ADD COLUMN "target_unit_reference_id" uuid NULL, ADD COLUMN "target_unit_distribution_id" uuid NULL, ADD COLUMN "target_unit_video_id" uuid NULL, ADD COLUMN "target_unit_audio_id" uuid NULL, ADD COLUMN "target_unit_post_id" uuid NULL, ADD COLUMN "target_unit_poll_id" uuid NULL, ADD COLUMN "target_unit_zone_id" uuid NULL, ADD COLUMN "target_unit_realm_id" uuid NULL, ADD COLUMN "target_unit_realm_rule_id" uuid NULL, ADD COLUMN "target_unit_custom_theme_id" uuid NULL, ADD COLUMN "target_unit_collection_id" uuid NULL, ADD COLUMN "target_unit_tag_id" uuid NULL, ADD COLUMN "target_unit_tag_path_id" uuid NULL, ADD COLUMN "target_unit_label_id" uuid NULL, ADD COLUMN "target_owner" text NOT NULL GENERATED ALWAYS AS (
CASE
    WHEN (target_unit_publishing_id IS NOT NULL) THEN 'publishing'::text
    WHEN (target_unit_music_id IS NOT NULL) THEN 'music'::text
    WHEN (target_unit_program_id IS NOT NULL) THEN 'program'::text
    WHEN (target_unit_software_id IS NOT NULL) THEN 'software'::text
    WHEN (target_unit_entity_id IS NOT NULL) THEN 'entity'::text
    WHEN (target_unit_grouping_id IS NOT NULL) THEN 'grouping'::text
    WHEN (target_unit_reference_id IS NOT NULL) THEN 'reference'::text
    WHEN (target_unit_distribution_id IS NOT NULL) THEN 'distribution'::text
    WHEN (target_unit_video_id IS NOT NULL) THEN 'video'::text
    WHEN (target_unit_audio_id IS NOT NULL) THEN 'audio'::text
    WHEN (target_unit_post_id IS NOT NULL) THEN 'post'::text
    WHEN (target_unit_poll_id IS NOT NULL) THEN 'poll'::text
    WHEN (target_unit_zone_id IS NOT NULL) THEN 'zone'::text
    WHEN (target_unit_realm_id IS NOT NULL) THEN 'realm'::text
    WHEN (target_unit_realm_rule_id IS NOT NULL) THEN 'realm_rule'::text
    WHEN (target_unit_custom_theme_id IS NOT NULL) THEN 'custom_theme'::text
    WHEN (target_unit_collection_id IS NOT NULL) THEN 'collection'::text
    WHEN (target_unit_tag_id IS NOT NULL) THEN 'tag'::text
    WHEN (target_unit_tag_path_id IS NOT NULL) THEN 'tag_path'::text
    WHEN (target_unit_label_id IS NOT NULL) THEN 'label'::text
    ELSE NULL::text
END) STORED, ADD CONSTRAINT "account_favorite_revision_4H2csTmkRedN_fkey" FOREIGN KEY ("target_unit_tag_path_id") REFERENCES "tag_path" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_revision_6NXsryNypzXp_fkey" FOREIGN KEY ("target_unit_collection_id") REFERENCES "collection" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_revision_8q9CGfFgLeNI_fkey" FOREIGN KEY ("target_unit_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_revision_9VJOEjWmqjls_fkey" FOREIGN KEY ("target_unit_reference_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_revision_I4tGFFuubR3E_fkey" FOREIGN KEY ("target_unit_software_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_revision_MwcNYnEE7xpw_fkey" FOREIGN KEY ("target_unit_music_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_revision_QzpQh9i7jNNL_fkey" FOREIGN KEY ("target_unit_custom_theme_id") REFERENCES "custom_theme" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_revision_Uxwatva29Iwo_fkey" FOREIGN KEY ("target_unit_distribution_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_revision_cURyZidCbXmf_fkey" FOREIGN KEY ("target_unit_realm_rule_id") REFERENCES "realm_rule" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_revision_fwWoWBeOUdjc_fkey" FOREIGN KEY ("target_unit_publishing_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_revision_target_unit_audio_id_audio_id_fkey" FOREIGN KEY ("target_unit_audio_id") REFERENCES "audio" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_revision_target_unit_label_id_label_id_fkey" FOREIGN KEY ("target_unit_label_id") REFERENCES "label" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_revision_target_unit_poll_id_poll_id_fkey" FOREIGN KEY ("target_unit_poll_id") REFERENCES "poll" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_revision_target_unit_post_id_post_id_fkey" FOREIGN KEY ("target_unit_post_id") REFERENCES "post" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_revision_target_unit_realm_id_realm_id_fkey" FOREIGN KEY ("target_unit_realm_id") REFERENCES "realm" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_revision_target_unit_tag_id_tag_id_fkey" FOREIGN KEY ("target_unit_tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_revision_target_unit_video_id_video_id_fkey" FOREIGN KEY ("target_unit_video_id") REFERENCES "video" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_revision_target_unit_zone_id_zone_id_fkey" FOREIGN KEY ("target_unit_zone_id") REFERENCES "zone" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_revision_wUTwwTkwMNWY_fkey" FOREIGN KEY ("target_unit_program_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_favorite_revision_wyKK0T8bUnlI_fkey" FOREIGN KEY ("target_unit_grouping_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "account_favorite_revision_target_unit_audio_ref_idx" to table: "account_favorite_revision"
CREATE INDEX "account_favorite_revision_target_unit_audio_ref_idx" ON "account_favorite_revision" ("target_unit_audio_id") WHERE (target_unit_audio_id IS NOT NULL);
-- Create index "account_favorite_revision_target_unit_collection_ref_idx" to table: "account_favorite_revision"
CREATE INDEX "account_favorite_revision_target_unit_collection_ref_idx" ON "account_favorite_revision" ("target_unit_collection_id") WHERE (target_unit_collection_id IS NOT NULL);
-- Create index "account_favorite_revision_target_unit_custom_theme_ref_idx" to table: "account_favorite_revision"
CREATE INDEX "account_favorite_revision_target_unit_custom_theme_ref_idx" ON "account_favorite_revision" ("target_unit_custom_theme_id") WHERE (target_unit_custom_theme_id IS NOT NULL);
-- Create index "account_favorite_revision_target_unit_distribution_ref_idx" to table: "account_favorite_revision"
CREATE INDEX "account_favorite_revision_target_unit_distribution_ref_idx" ON "account_favorite_revision" ("target_unit_distribution_id") WHERE (target_unit_distribution_id IS NOT NULL);
-- Create index "account_favorite_revision_target_unit_entity_ref_idx" to table: "account_favorite_revision"
CREATE INDEX "account_favorite_revision_target_unit_entity_ref_idx" ON "account_favorite_revision" ("target_unit_entity_id") WHERE (target_unit_entity_id IS NOT NULL);
-- Create index "account_favorite_revision_target_unit_grouping_ref_idx" to table: "account_favorite_revision"
CREATE INDEX "account_favorite_revision_target_unit_grouping_ref_idx" ON "account_favorite_revision" ("target_unit_grouping_id") WHERE (target_unit_grouping_id IS NOT NULL);
-- Create index "account_favorite_revision_target_unit_label_ref_idx" to table: "account_favorite_revision"
CREATE INDEX "account_favorite_revision_target_unit_label_ref_idx" ON "account_favorite_revision" ("target_unit_label_id") WHERE (target_unit_label_id IS NOT NULL);
-- Create index "account_favorite_revision_target_unit_music_ref_idx" to table: "account_favorite_revision"
CREATE INDEX "account_favorite_revision_target_unit_music_ref_idx" ON "account_favorite_revision" ("target_unit_music_id") WHERE (target_unit_music_id IS NOT NULL);
-- Create index "account_favorite_revision_target_unit_poll_ref_idx" to table: "account_favorite_revision"
CREATE INDEX "account_favorite_revision_target_unit_poll_ref_idx" ON "account_favorite_revision" ("target_unit_poll_id") WHERE (target_unit_poll_id IS NOT NULL);
-- Create index "account_favorite_revision_target_unit_post_ref_idx" to table: "account_favorite_revision"
CREATE INDEX "account_favorite_revision_target_unit_post_ref_idx" ON "account_favorite_revision" ("target_unit_post_id") WHERE (target_unit_post_id IS NOT NULL);
-- Create index "account_favorite_revision_target_unit_program_ref_idx" to table: "account_favorite_revision"
CREATE INDEX "account_favorite_revision_target_unit_program_ref_idx" ON "account_favorite_revision" ("target_unit_program_id") WHERE (target_unit_program_id IS NOT NULL);
-- Create index "account_favorite_revision_target_unit_publishing_ref_idx" to table: "account_favorite_revision"
CREATE INDEX "account_favorite_revision_target_unit_publishing_ref_idx" ON "account_favorite_revision" ("target_unit_publishing_id") WHERE (target_unit_publishing_id IS NOT NULL);
-- Create index "account_favorite_revision_target_unit_realm_ref_idx" to table: "account_favorite_revision"
CREATE INDEX "account_favorite_revision_target_unit_realm_ref_idx" ON "account_favorite_revision" ("target_unit_realm_id") WHERE (target_unit_realm_id IS NOT NULL);
-- Create index "account_favorite_revision_target_unit_realm_rule_ref_idx" to table: "account_favorite_revision"
CREATE INDEX "account_favorite_revision_target_unit_realm_rule_ref_idx" ON "account_favorite_revision" ("target_unit_realm_rule_id") WHERE (target_unit_realm_rule_id IS NOT NULL);
-- Create index "account_favorite_revision_target_unit_reference_ref_idx" to table: "account_favorite_revision"
CREATE INDEX "account_favorite_revision_target_unit_reference_ref_idx" ON "account_favorite_revision" ("target_unit_reference_id") WHERE (target_unit_reference_id IS NOT NULL);
-- Create index "account_favorite_revision_target_unit_software_ref_idx" to table: "account_favorite_revision"
CREATE INDEX "account_favorite_revision_target_unit_software_ref_idx" ON "account_favorite_revision" ("target_unit_software_id") WHERE (target_unit_software_id IS NOT NULL);
-- Create index "account_favorite_revision_target_unit_tag_path_ref_idx" to table: "account_favorite_revision"
CREATE INDEX "account_favorite_revision_target_unit_tag_path_ref_idx" ON "account_favorite_revision" ("target_unit_tag_path_id") WHERE (target_unit_tag_path_id IS NOT NULL);
-- Create index "account_favorite_revision_target_unit_tag_ref_idx" to table: "account_favorite_revision"
CREATE INDEX "account_favorite_revision_target_unit_tag_ref_idx" ON "account_favorite_revision" ("target_unit_tag_id") WHERE (target_unit_tag_id IS NOT NULL);
-- Create index "account_favorite_revision_target_unit_video_ref_idx" to table: "account_favorite_revision"
CREATE INDEX "account_favorite_revision_target_unit_video_ref_idx" ON "account_favorite_revision" ("target_unit_video_id") WHERE (target_unit_video_id IS NOT NULL);
-- Create index "account_favorite_revision_target_unit_zone_ref_idx" to table: "account_favorite_revision"
CREATE INDEX "account_favorite_revision_target_unit_zone_ref_idx" ON "account_favorite_revision" ("target_unit_zone_id") WHERE (target_unit_zone_id IS NOT NULL);
-- Create "organization_membership_invitation" table
CREATE TABLE "organization_membership_invitation" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "organization_entity_id" uuid NOT NULL,
  "organization_revision" bigint NOT NULL,
  "recipient_auth_user_id" uuid NOT NULL,
  "recipient_entity_id" uuid NOT NULL,
  "invited_by_auth_user_id" uuid NOT NULL,
  "inviter_authorization_revision" bigint NOT NULL,
  "authorization_grant_id" uuid NOT NULL,
  "authorization_grant_revision" bigint NOT NULL,
  "state" text NOT NULL DEFAULT 'pending',
  "revision" bigint NOT NULL DEFAULT 1,
  "expires_at" timestamptz(3) NOT NULL,
  "resolved_at" timestamptz(3) NULL,
  "resolved_by_auth_user_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "organization_membership_invitation_7WURxZiZyfMs_fkey" FOREIGN KEY ("organization_entity_id") REFERENCES "entity_participation" ("entity_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "organization_membership_invitation_IABQYsyiLvxn_fkey" FOREIGN KEY ("recipient_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "organization_membership_invitation_OZBf915zI3l1_fkey" FOREIGN KEY ("resolved_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "organization_membership_invitation_QhA7LCuF0dCo_fkey" FOREIGN KEY ("recipient_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "organization_membership_invitation_grant_event_fk" FOREIGN KEY ("authorization_grant_id", "authorization_grant_revision") REFERENCES "participation_grant_event" ("grant_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "organization_membership_invitation_kR7CaukFgdEW_fkey" FOREIGN KEY ("invited_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "organization_membership_invitation_expiry_check" CHECK ((expires_at > created_at) AND (expires_at <= (created_at + '30 days'::interval))),
  CONSTRAINT "organization_membership_invitation_resolution_check" CHECK (((state = 'pending'::text) AND (resolved_at IS NULL) AND (resolved_by_auth_user_id IS NULL)) OR ((state <> 'pending'::text) AND (resolved_at IS NOT NULL) AND (resolved_at >= created_at) AND (((state = ANY (ARRAY['accepted'::text, 'declined'::text])) AND (resolved_by_auth_user_id IS NOT NULL) AND (resolved_by_auth_user_id = recipient_auth_user_id)) OR ((state = 'cancelled'::text) AND (resolved_by_auth_user_id IS NOT NULL)) OR ((state = ANY (ARRAY['expired'::text, 'invalidated'::text])) AND (resolved_by_auth_user_id IS NULL))))),
  CONSTRAINT "organization_membership_invitation_revision_check" CHECK (((revision >= 1) AND (revision <= '9007199254740991'::bigint)) AND ((organization_revision >= 1) AND (organization_revision <= '9007199254740991'::bigint)) AND ((inviter_authorization_revision >= 1) AND (inviter_authorization_revision <= '9007199254740991'::bigint)) AND ((authorization_grant_revision >= 1) AND (authorization_grant_revision <= '9007199254740991'::bigint))),
  CONSTRAINT "organization_membership_invitation_state_check" CHECK (state = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text, 'expired'::text, 'invalidated'::text]))
);
-- Create index "organization_membership_invitation_grant_idx" to table: "organization_membership_invitation"
CREATE INDEX "organization_membership_invitation_grant_idx" ON "organization_membership_invitation" ("authorization_grant_id", "authorization_grant_revision");
-- Create index "organization_membership_invitation_org_page_idx" to table: "organization_membership_invitation"
CREATE INDEX "organization_membership_invitation_org_page_idx" ON "organization_membership_invitation" ("organization_entity_id", "id");
-- Create index "organization_membership_invitation_pending_pair_key" to table: "organization_membership_invitation"
CREATE UNIQUE INDEX "organization_membership_invitation_pending_pair_key" ON "organization_membership_invitation" ("organization_entity_id", "recipient_auth_user_id") WHERE (state = 'pending'::text);
-- Create index "organization_membership_invitation_recipient_entity_idx" to table: "organization_membership_invitation"
CREATE INDEX "organization_membership_invitation_recipient_entity_idx" ON "organization_membership_invitation" ("recipient_entity_id", "id");
-- Create index "organization_membership_invitation_recipient_state_idx" to table: "organization_membership_invitation"
CREATE INDEX "organization_membership_invitation_recipient_state_idx" ON "organization_membership_invitation" ("recipient_auth_user_id", "state", "id");
-- Create index "organization_membership_invitation_resolver_idx" to table: "organization_membership_invitation"
CREATE INDEX "organization_membership_invitation_resolver_idx" ON "organization_membership_invitation" ("resolved_by_auth_user_id", "id") WHERE (resolved_by_auth_user_id IS NOT NULL);
-- Create index "organization_membership_invitation_scope_key" to table: "organization_membership_invitation"
CREATE UNIQUE INDEX "organization_membership_invitation_scope_key" ON "organization_membership_invitation" ("id", "organization_entity_id", "recipient_auth_user_id", "recipient_entity_id");
-- Create index "organization_membership_invitation_sender_state_idx" to table: "organization_membership_invitation"
CREATE INDEX "organization_membership_invitation_sender_state_idx" ON "organization_membership_invitation" ("invited_by_auth_user_id", "state", "id");
-- Create "organization_membership" table
CREATE TABLE "organization_membership" (
  "organization_entity_id" uuid NOT NULL,
  "member_auth_user_id" uuid NOT NULL,
  "member_entity_id" uuid NOT NULL,
  "accepted_invitation_id" uuid NOT NULL,
  "revision" bigint NOT NULL DEFAULT 1,
  "joined_at" timestamptz(3) NOT NULL,
  "removed_at" timestamptz(3) NULL,
  "removed_by_auth_user_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("organization_entity_id", "member_auth_user_id"),
  CONSTRAINT "organization_membership_GMjtotFUUDp0_fkey" FOREIGN KEY ("member_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "organization_membership_YzA9PJiKqayg_fkey" FOREIGN KEY ("organization_entity_id") REFERENCES "entity_participation" ("entity_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "organization_membership_accepted_invitation_fk" FOREIGN KEY ("accepted_invitation_id", "organization_entity_id", "member_auth_user_id", "member_entity_id") REFERENCES "organization_membership_invitation" ("id", "organization_entity_id", "recipient_auth_user_id", "recipient_entity_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "organization_membership_member_auth_user_id_users_id_fkey" FOREIGN KEY ("member_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "organization_membership_removed_by_auth_user_id_users_id_fkey" FOREIGN KEY ("removed_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "organization_membership_removal_check" CHECK (((removed_at IS NULL) AND (removed_by_auth_user_id IS NULL)) OR ((removed_at IS NOT NULL) AND (removed_by_auth_user_id IS NOT NULL) AND (removed_at >= joined_at))),
  CONSTRAINT "organization_membership_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "organization_membership_time_check" CHECK ((updated_at >= created_at) AND (updated_at >= joined_at) AND ((removed_at IS NULL) OR (updated_at >= removed_at)))
);
-- Create index "organization_membership_active_roster_idx" to table: "organization_membership"
CREATE INDEX "organization_membership_active_roster_idx" ON "organization_membership" ("organization_entity_id", "member_entity_id") WHERE (removed_at IS NULL);
-- Create index "organization_membership_auth_state_idx" to table: "organization_membership"
CREATE INDEX "organization_membership_auth_state_idx" ON "organization_membership" ("member_auth_user_id", "removed_at", "organization_entity_id");
-- Create index "organization_membership_entity_idx" to table: "organization_membership"
CREATE INDEX "organization_membership_entity_idx" ON "organization_membership" ("member_entity_id", "organization_entity_id");
-- Create index "organization_membership_invitation_idx" to table: "organization_membership"
CREATE INDEX "organization_membership_invitation_idx" ON "organization_membership" ("accepted_invitation_id");
-- Create index "organization_membership_public_member_key" to table: "organization_membership"
CREATE UNIQUE INDEX "organization_membership_public_member_key" ON "organization_membership" ("organization_entity_id", "member_entity_id");
-- Create index "organization_membership_removed_by_idx" to table: "organization_membership"
CREATE INDEX "organization_membership_removed_by_idx" ON "organization_membership" ("removed_by_auth_user_id") WHERE (removed_by_auth_user_id IS NOT NULL);
-- Create "organization_membership_event" table
CREATE TABLE "organization_membership_event" (
  "organization_entity_id" uuid NOT NULL,
  "member_auth_user_id" uuid NOT NULL,
  "member_entity_id" uuid NOT NULL,
  "revision" bigint NOT NULL,
  "operation" text NOT NULL,
  "operator_auth_user_id" uuid NOT NULL,
  "accepted_invitation_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("organization_entity_id", "member_auth_user_id", "revision"),
  CONSTRAINT "organization_membership_event_LnjIvqHYdGS3_fkey" FOREIGN KEY ("member_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "organization_membership_event_XB6qHzSruMoa_fkey" FOREIGN KEY ("accepted_invitation_id") REFERENCES "organization_membership_invitation" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "organization_membership_event_fRQtfDUAYAjY_fkey" FOREIGN KEY ("operator_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "organization_membership_event_member_auth_user_id_users_id_fkey" FOREIGN KEY ("member_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "organization_membership_event_member_fk" FOREIGN KEY ("organization_entity_id", "member_auth_user_id") REFERENCES "organization_membership" ("organization_entity_id", "member_auth_user_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "organization_membership_event_operation_check" CHECK (operation = ANY (ARRAY['join'::text, 'remove'::text, 'leave'::text])),
  CONSTRAINT "organization_membership_event_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint))
);
-- Create index "organization_membership_event_account_idx" to table: "organization_membership_event"
CREATE INDEX "organization_membership_event_account_idx" ON "organization_membership_event" ("member_auth_user_id", "organization_entity_id", "revision");
-- Create index "organization_membership_event_entity_idx" to table: "organization_membership_event"
CREATE INDEX "organization_membership_event_entity_idx" ON "organization_membership_event" ("member_entity_id", "organization_entity_id", "revision");
-- Create index "organization_membership_event_invitation_idx" to table: "organization_membership_event"
CREATE INDEX "organization_membership_event_invitation_idx" ON "organization_membership_event" ("accepted_invitation_id");
-- Create index "organization_membership_event_operator_idx" to table: "organization_membership_event"
CREATE INDEX "organization_membership_event_operator_idx" ON "organization_membership_event" ("operator_auth_user_id", "organization_entity_id", "revision");
-- Create "program_structure_source_application_change" table
CREATE TABLE "program_structure_source_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component" text NOT NULL,
  "component_key" text NOT NULL,
  "before_revision_id" uuid NOT NULL,
  "after_revision_id" uuid NOT NULL,
  PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "program_structure_application_after_fk" FOREIGN KEY ("owner_id", "after_revision_id") REFERENCES "program_component_revision" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_structure_application_before_fk" FOREIGN KEY ("owner_id", "before_revision_id") REFERENCES "program_component_revision" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_structure_application_journal_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_structure_application_components" CHECK (component = ANY (ARRAY['program_work'::text, 'program_season'::text, 'program_version'::text, 'program_episode'::text])),
  CONSTRAINT "program_structure_application_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND (action = ANY (ARRAY['apply'::text, 'withdraw'::text])) AND ((octet_length(component) >= 1) AND (octet_length(component) <= 96)) AND (component_key = (owner_id)::text) AND ((before_revision_id IS NULL) OR (before_revision_id <> after_revision_id)))
) PARTITION BY HASH ("source_record_id");
-- Create "program_structure_source_occurrence" table
CREATE TABLE "program_structure_source_occurrence" (
  "source_record_id" uuid NOT NULL,
  "mapping_key" uuid NOT NULL,
  "correspondence_revision" bigint NOT NULL,
  "mapping_owner" text NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "component" text NOT NULL,
  "component_key" text NOT NULL,
  "source_path" text NOT NULL,
  "history_id" uuid NOT NULL,
  "source_value" jsonb NOT NULL,
  "observed_fields" text[] NOT NULL,
  "source_parent_id" uuid NULL GENERATED ALWAYS AS ((((source_value -> 'fields'::text) ->> 'programId'::text))::uuid) STORED,
  "source_secondary_parent_id" uuid NULL GENERATED ALWAYS AS ((((source_value -> 'fields'::text) ->> 'seasonId'::text))::uuid) STORED,
  "source_type_revision_id" uuid NULL GENERATED ALWAYS AS ((((source_value -> 'fields'::text) ->> 'typeRevisionId'::text))::uuid) STORED,
  "source_method_revision_id" uuid NULL GENERATED ALWAYS AS ((((source_value -> 'fields'::text) ->> 'versionTypeRevisionId'::text))::uuid) STORED,
  PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id", "owner_id", "component", "component_key"),
  CONSTRAINT "program_structure_source_epoch_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_structure_source_history_fk" FOREIGN KEY ("owner_id", "history_id") REFERENCES "program_component_revision" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_structure_source_occurrence_ARUp9uc8yKHO_fkey" FOREIGN KEY ("source_method_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_structure_source_occurrence_CVMEwaokflmj_fkey" FOREIGN KEY ("source_parent_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_structure_source_occurrence_VgmRif1cnH1U_fkey" FOREIGN KEY ("source_secondary_parent_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_structure_source_occurrence_cnerKMZgjWnb_fkey" FOREIGN KEY ("source_type_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_structure_source_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_structure_source_components" CHECK (component = ANY (ARRAY['program_work'::text, 'program_season'::text, 'program_version'::text, 'program_episode'::text])),
  CONSTRAINT "program_structure_source_owner" CHECK (mapping_owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text, 'distribution'::text])),
  CONSTRAINT "program_structure_source_values" CHECK (((correspondence_revision >= 1) AND (correspondence_revision <= '9007199254740991'::bigint)) AND ((octet_length(component) >= 1) AND (octet_length(component) <= 96)) AND (component_key = (owner_id)::text) AND ("left"(source_path, 1) = '/'::text) AND ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)) AND (jsonb_typeof(source_value) = 'object'::text) AND (source_value ?& ARRAY['shape'::text, 'fields'::text]) AND (((source_value - 'shape'::text) - 'fields'::text) = '{}'::jsonb) AND (jsonb_typeof((source_value -> 'shape'::text)) = 'string'::text) AND (jsonb_typeof((source_value -> 'fields'::text)) = 'object'::text) AND (octet_length((source_value)::text) <= 1048576) AND ((cardinality(observed_fields) >= 0) AND (cardinality(observed_fields) <= 32)))
) PARTITION BY HASH ("source_record_id");
-- Create index "program_structure_source_method_idx" to table: "program_structure_source_occurrence"
CREATE INDEX "program_structure_source_method_idx" ON "program_structure_source_occurrence" ("source_method_revision_id") WHERE (source_method_revision_id IS NOT NULL);
-- Create index "program_structure_source_native_idx" to table: "program_structure_source_occurrence"
CREATE INDEX "program_structure_source_native_idx" ON "program_structure_source_occurrence" ("owner_id", "history_id", "source_record_id");
-- Create index "program_structure_source_parent_idx" to table: "program_structure_source_occurrence"
CREATE INDEX "program_structure_source_parent_idx" ON "program_structure_source_occurrence" ("source_parent_id") WHERE (source_parent_id IS NOT NULL);
-- Create index "program_structure_source_secondary_idx" to table: "program_structure_source_occurrence"
CREATE INDEX "program_structure_source_secondary_idx" ON "program_structure_source_occurrence" ("source_secondary_parent_id") WHERE (source_secondary_parent_id IS NOT NULL);
-- Create index "program_structure_source_type_idx" to table: "program_structure_source_occurrence"
CREATE INDEX "program_structure_source_type_idx" ON "program_structure_source_occurrence" ("source_type_revision_id") WHERE (source_type_revision_id IS NOT NULL);
-- Create "program_structure_source_baseline" table
CREATE TABLE "program_structure_source_baseline" (
  "source_record_id" uuid NOT NULL,
  "mapping_key" uuid NOT NULL,
  "correspondence_revision" bigint NOT NULL,
  "mapping_owner" text NOT NULL,
  "owner_id" uuid NOT NULL,
  "component" text NOT NULL,
  "component_key" text NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "source_history_id" uuid NOT NULL,
  "current_history_id" uuid NOT NULL,
  "absent" boolean NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "component", "component_key"),
  CONSTRAINT "program_structure_baseline_application_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_structure_baseline_current_fk" FOREIGN KEY ("owner_id", "current_history_id") REFERENCES "program_component_revision" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_structure_baseline_epoch_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_structure_baseline_occurrence_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id", "owner_id", "component", "component_key") REFERENCES "program_structure_source_occurrence" ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id", "owner_id", "component", "component_key") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_structure_baseline_original_fk" FOREIGN KEY ("owner_id", "source_history_id") REFERENCES "program_component_revision" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_structure_baseline_components" CHECK (component = ANY (ARRAY['program_work'::text, 'program_season'::text, 'program_version'::text, 'program_episode'::text])),
  CONSTRAINT "program_structure_baseline_owner" CHECK (mapping_owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text, 'distribution'::text])),
  CONSTRAINT "program_structure_baseline_values" CHECK ((action = ANY (ARRAY['apply'::text, 'withdraw'::text])) AND ((correspondence_revision >= 1) AND (correspondence_revision <= '9007199254740991'::bigint)) AND ((octet_length(component) >= 1) AND (octet_length(component) <= 96)) AND (component_key = (owner_id)::text) AND ("left"(source_path, 1) = '/'::text) AND ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)))
) PARTITION BY HASH ("source_record_id");
-- Create index "program_structure_baseline_current_idx" to table: "program_structure_source_baseline"
CREATE INDEX "program_structure_baseline_current_idx" ON "program_structure_source_baseline" ("owner_id", "current_history_id");
-- Create "publishing_structure_source_application_change" table
CREATE TABLE "publishing_structure_source_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component" text NOT NULL,
  "component_key" text NOT NULL,
  "before_revision_id" uuid NOT NULL,
  "after_revision_id" uuid NOT NULL,
  PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "publishing_structure_application_after_fk" FOREIGN KEY ("owner_id", "after_revision_id") REFERENCES "publishing_component_revision" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_structure_application_before_fk" FOREIGN KEY ("owner_id", "before_revision_id") REFERENCES "publishing_component_revision" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_structure_application_journal_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_structure_application_components" CHECK (component = ANY (ARRAY['publishing_work'::text, 'publishing_text_version'::text, 'publishing_publication'::text, 'publishing_serialization'::text])),
  CONSTRAINT "publishing_structure_application_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND (action = ANY (ARRAY['apply'::text, 'withdraw'::text])) AND ((octet_length(component) >= 1) AND (octet_length(component) <= 96)) AND (component_key = (owner_id)::text) AND ((before_revision_id IS NULL) OR (before_revision_id <> after_revision_id)))
) PARTITION BY HASH ("source_record_id");
-- Create "publishing_structure_source_occurrence" table
CREATE TABLE "publishing_structure_source_occurrence" (
  "source_record_id" uuid NOT NULL,
  "mapping_key" uuid NOT NULL,
  "correspondence_revision" bigint NOT NULL,
  "mapping_owner" text NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "component" text NOT NULL,
  "component_key" text NOT NULL,
  "source_path" text NOT NULL,
  "history_id" uuid NOT NULL,
  "source_value" jsonb NOT NULL,
  "observed_fields" text[] NOT NULL,
  "source_parent_id" uuid NULL GENERATED ALWAYS AS ((((source_value -> 'fields'::text) ->> 'textVersionId'::text))::uuid) STORED,
  "source_secondary_parent_id" uuid NULL GENERATED ALWAYS AS (NULL::uuid) STORED,
  "source_type_revision_id" uuid NULL GENERATED ALWAYS AS ((((source_value -> 'fields'::text) ->> 'statusRevisionId'::text))::uuid) STORED,
  "source_method_revision_id" uuid NULL GENERATED ALWAYS AS ((((source_value -> 'fields'::text) ->> 'methodRevisionId'::text))::uuid) STORED,
  PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id", "owner_id", "component", "component_key"),
  CONSTRAINT "publishing_structure_source_epoch_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_structure_source_history_fk" FOREIGN KEY ("owner_id", "history_id") REFERENCES "publishing_component_revision" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_structure_source_occurrence_CoH4Db7BVoFj_fkey" FOREIGN KEY ("source_method_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_structure_source_occurrence_I7iip8yTalmS_fkey" FOREIGN KEY ("source_type_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_structure_source_occurrence_WGupaRq8BzdK_fkey" FOREIGN KEY ("source_secondary_parent_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_structure_source_occurrence_prOM4bvWnVwp_fkey" FOREIGN KEY ("source_parent_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_structure_source_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_structure_source_components" CHECK (component = ANY (ARRAY['publishing_work'::text, 'publishing_text_version'::text, 'publishing_publication'::text, 'publishing_serialization'::text])),
  CONSTRAINT "publishing_structure_source_owner" CHECK (mapping_owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text, 'distribution'::text])),
  CONSTRAINT "publishing_structure_source_values" CHECK (((correspondence_revision >= 1) AND (correspondence_revision <= '9007199254740991'::bigint)) AND ((octet_length(component) >= 1) AND (octet_length(component) <= 96)) AND (component_key = (owner_id)::text) AND ("left"(source_path, 1) = '/'::text) AND ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)) AND (jsonb_typeof(source_value) = 'object'::text) AND (source_value ?& ARRAY['shape'::text, 'fields'::text]) AND (((source_value - 'shape'::text) - 'fields'::text) = '{}'::jsonb) AND (jsonb_typeof((source_value -> 'shape'::text)) = 'string'::text) AND (jsonb_typeof((source_value -> 'fields'::text)) = 'object'::text) AND (octet_length((source_value)::text) <= 1048576) AND ((cardinality(observed_fields) >= 0) AND (cardinality(observed_fields) <= 32)))
) PARTITION BY HASH ("source_record_id");
-- Create index "publishing_structure_source_method_idx" to table: "publishing_structure_source_occurrence"
CREATE INDEX "publishing_structure_source_method_idx" ON "publishing_structure_source_occurrence" ("source_method_revision_id") WHERE (source_method_revision_id IS NOT NULL);
-- Create index "publishing_structure_source_native_idx" to table: "publishing_structure_source_occurrence"
CREATE INDEX "publishing_structure_source_native_idx" ON "publishing_structure_source_occurrence" ("owner_id", "history_id", "source_record_id");
-- Create index "publishing_structure_source_parent_idx" to table: "publishing_structure_source_occurrence"
CREATE INDEX "publishing_structure_source_parent_idx" ON "publishing_structure_source_occurrence" ("source_parent_id") WHERE (source_parent_id IS NOT NULL);
-- Create index "publishing_structure_source_secondary_idx" to table: "publishing_structure_source_occurrence"
CREATE INDEX "publishing_structure_source_secondary_idx" ON "publishing_structure_source_occurrence" ("source_secondary_parent_id") WHERE (source_secondary_parent_id IS NOT NULL);
-- Create index "publishing_structure_source_type_idx" to table: "publishing_structure_source_occurrence"
CREATE INDEX "publishing_structure_source_type_idx" ON "publishing_structure_source_occurrence" ("source_type_revision_id") WHERE (source_type_revision_id IS NOT NULL);
-- Create "publishing_structure_source_baseline" table
CREATE TABLE "publishing_structure_source_baseline" (
  "source_record_id" uuid NOT NULL,
  "mapping_key" uuid NOT NULL,
  "correspondence_revision" bigint NOT NULL,
  "mapping_owner" text NOT NULL,
  "owner_id" uuid NOT NULL,
  "component" text NOT NULL,
  "component_key" text NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "source_history_id" uuid NOT NULL,
  "current_history_id" uuid NOT NULL,
  "absent" boolean NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "component", "component_key"),
  CONSTRAINT "publishing_structure_baseline_application_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_structure_baseline_current_fk" FOREIGN KEY ("owner_id", "current_history_id") REFERENCES "publishing_component_revision" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_structure_baseline_epoch_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_structure_baseline_occurrence_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id", "owner_id", "component", "component_key") REFERENCES "publishing_structure_source_occurrence" ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id", "owner_id", "component", "component_key") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_structure_baseline_original_fk" FOREIGN KEY ("owner_id", "source_history_id") REFERENCES "publishing_component_revision" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_structure_baseline_components" CHECK (component = ANY (ARRAY['publishing_work'::text, 'publishing_text_version'::text, 'publishing_publication'::text, 'publishing_serialization'::text])),
  CONSTRAINT "publishing_structure_baseline_owner" CHECK (mapping_owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text, 'distribution'::text])),
  CONSTRAINT "publishing_structure_baseline_values" CHECK ((action = ANY (ARRAY['apply'::text, 'withdraw'::text])) AND ((correspondence_revision >= 1) AND (correspondence_revision <= '9007199254740991'::bigint)) AND ((octet_length(component) >= 1) AND (octet_length(component) <= 96)) AND (component_key = (owner_id)::text) AND ("left"(source_path, 1) = '/'::text) AND ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)))
) PARTITION BY HASH ("source_record_id");
-- Create index "publishing_structure_baseline_current_idx" to table: "publishing_structure_source_baseline"
CREATE INDEX "publishing_structure_baseline_current_idx" ON "publishing_structure_source_baseline" ("owner_id", "current_history_id");

DO $$
DECLARE owner_name text; kind text; parent_name text; partition_number integer;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['program','publishing'] LOOP
    FOREACH kind IN ARRAY ARRAY['occurrence','application_change','baseline'] LOOP
      parent_name:=owner_name || '_structure_source_' || kind;
      FOR partition_number IN 0..63 LOOP
        EXECUTE format('CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES WITH (MODULUS 64, REMAINDER %s)', parent_name || '_p' || lpad(partition_number::text, 2, '0'), parent_name, partition_number);
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.unit_publish_platform_route()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE ready boolean; affected integer;
BEGIN
  SELECT c.ready INTO ready FROM public.catalog_routing_control c WHERE singleton FOR SHARE;
  IF ready IS DISTINCT FROM true THEN RAISE EXCEPTION 'Identity routing is fenced for repair' USING ERRCODE='55000'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('catalog-identity:' || NEW.id::text,0));
  IF TG_OP='UPDATE' AND NEW.id<>OLD.id THEN RAISE EXCEPTION 'Unit identity is immutable' USING ERRCODE='23514'; END IF;
  INSERT INTO public.catalog_unit_locator(id,owner,generation) VALUES(NEW.id,TG_ARGV[0],1)
    ON CONFLICT(id) DO UPDATE SET generation=EXCLUDED.generation WHERE catalog_unit_locator.owner=EXCLUDED.owner AND catalog_unit_locator.generation=1;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'Identity belongs to another physical owner' USING ERRCODE='23505'; END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.unit_remove_platform_route()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  DELETE FROM public.catalog_unit_locator WHERE id=OLD.id AND owner=TG_ARGV[0] AND generation=1;
  RETURN OLD;
END $$;

/** Resolve a logical input ID once; concrete FKs and the row check remain the persisted authority. */
CREATE OR REPLACE FUNCTION public.unit_populate_reference()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE value jsonb; previous jsonb; raw_id uuid; selected_owner text; owner_name text; column_name text;
  present_count integer:=0; supplied_owner text; supplied_id uuid; routing_ready boolean; alternatives_unchanged boolean:=true;
  owners text[]:=ARRAY['publishing','music','program','software','entity','grouping','reference','distribution','video','audio','post','poll','zone','realm','realm_rule','custom_theme','collection','tag','tag_path','label'];
BEGIN
  value:=to_jsonb(NEW); raw_id:=(value->>TG_ARGV[0])::uuid;
  IF TG_OP='UPDATE' THEN previous:=to_jsonb(OLD); END IF;
  FOREACH owner_name IN ARRAY owners LOOP
    column_name:=TG_ARGV[1] || '_' || owner_name || '_id';
    IF NOT value ? column_name THEN RAISE EXCEPTION 'Registered reference column is missing' USING ERRCODE='23514'; END IF;
    IF TG_OP='UPDATE' AND value->column_name IS DISTINCT FROM previous->column_name THEN alternatives_unchanged:=false; END IF;
    IF value->>column_name IS NOT NULL THEN present_count:=present_count+1; supplied_owner:=owner_name; supplied_id:=(value->>column_name)::uuid; END IF;
  END LOOP;
  IF TG_OP='UPDATE' AND alternatives_unchanged AND (previous->>TG_ARGV[0])::uuid IS DISTINCT FROM raw_id THEN
    FOREACH owner_name IN ARRAY owners LOOP value:=jsonb_set(value,ARRAY[TG_ARGV[1] || '_' || owner_name || '_id'],'null'::jsonb); END LOOP;
    present_count:=0;
  END IF;
  IF TG_OP='UPDATE' AND TG_ARGV[2]='optional' AND raw_id IS NOT NULL AND present_count=0 THEN
    IF previous->>TG_ARGV[0]=raw_id::text THEN
      -- A concrete FK SET NULL clears its derived logical input in the same row mutation.
      value:=jsonb_set(value,ARRAY[TG_ARGV[0]],'null'::jsonb); raw_id:=NULL;
    END IF;
  END IF;
  IF raw_id IS NULL THEN
    IF TG_ARGV[2]<>'optional' OR present_count<>0 THEN RAISE EXCEPTION 'Unit reference requires exactly one target' USING ERRCODE='23514'; END IF;
  ELSE
    IF present_count=1 AND supplied_id=raw_id THEN
      -- Explicit checked references are validated by their concrete FK, independently of routing-cache availability.
      NEW:=jsonb_populate_record(NEW,value); RETURN NEW;
    END IF;
    IF present_count<>0 THEN RAISE EXCEPTION 'Unit reference alternatives disagree with its logical identity' USING ERRCODE='23514'; END IF;
    SELECT ready INTO routing_ready FROM public.catalog_routing_control WHERE singleton FOR SHARE;
    IF routing_ready IS DISTINCT FROM true THEN RAISE EXCEPTION 'Identity routing is fenced for repair' USING ERRCODE='55000'; END IF;
    SELECT owner INTO selected_owner FROM public.catalog_unit_locator WHERE id=raw_id FOR KEY SHARE;
    IF NOT FOUND OR NOT selected_owner=ANY(owners) THEN RAISE EXCEPTION 'Unit reference routing is unavailable' USING ERRCODE='23503'; END IF;
    IF present_count>1 OR (present_count=1 AND (supplied_owner<>selected_owner OR supplied_id<>raw_id)) THEN RAISE EXCEPTION 'Unit reference alternatives disagree with its routed identity' USING ERRCODE='23514'; END IF;
    FOREACH owner_name IN ARRAY owners LOOP
      column_name:=TG_ARGV[1] || '_' || owner_name || '_id';
      value:=jsonb_set(value,ARRAY[column_name],CASE WHEN owner_name=selected_owner THEN to_jsonb(raw_id) ELSE 'null'::jsonb END);
    END LOOP;
  END IF;
  NEW:=jsonb_populate_record(NEW,value);
  RETURN NEW;
END $$;

DO $$ DECLARE owner_name text;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['video','audio','post','poll','zone','realm','realm_rule','custom_theme','collection','tag','tag_path','label'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS unit_platform_route_publish ON public.%I',owner_name);
    EXECUTE format('CREATE TRIGGER unit_platform_route_publish AFTER INSERT OR UPDATE OF id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.unit_publish_platform_route(%L)',owner_name,owner_name);
    EXECUTE format('DROP TRIGGER IF EXISTS unit_platform_route_remove ON public.%I',owner_name);
    EXECUTE format('CREATE TRIGGER unit_platform_route_remove AFTER DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.unit_remove_platform_route(%L)',owner_name,owner_name);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS favorite_target_reference ON public.account_favorite;
CREATE TRIGGER favorite_target_reference BEFORE INSERT OR UPDATE ON public.account_favorite
FOR EACH ROW EXECUTE FUNCTION public.unit_populate_reference('target_unit_id','target_unit','required');
DROP TRIGGER IF EXISTS favorite_history_target_reference ON public.account_favorite_revision;
CREATE TRIGGER favorite_history_target_reference BEFORE INSERT OR UPDATE ON public.account_favorite_revision
FOR EACH ROW EXECUTE FUNCTION public.unit_populate_reference('target_unit_id','target_unit','required');


-- Private history is append-only during account lifetime and physically removable by account erasure.
CREATE OR REPLACE FUNCTION public.participation_guard_private_history()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' AND EXISTS(SELECT 1 FROM public.users WHERE id = OLD.auth_user_id AND erased_at IS NOT NULL) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Private Favorites history is retained until account erasure' USING ERRCODE = '23514';
END $$;
DROP TRIGGER IF EXISTS participation_private_history_guard ON public.account_favorite_revision;
CREATE TRIGGER participation_private_history_guard BEFORE UPDATE OR DELETE ON public.account_favorite_revision
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_private_history();

CREATE OR REPLACE FUNCTION public.participation_guard_favorite_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF (to_jsonb(NEW)-ARRAY['position','note','snapshot','revision','updated_at','target_owner']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['position','note','snapshot','revision','updated_at','target_owner']) OR NEW.revision <= OLD.revision THEN
    RAISE EXCEPTION 'Favorite ownership and target are immutable; revisions must advance' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_favorite_identity_guard ON public.account_favorite;
CREATE TRIGGER participation_favorite_identity_guard BEFORE UPDATE ON public.account_favorite
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_favorite_identity();

CREATE OR REPLACE FUNCTION public.participation_guard_image_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE erased timestamptz;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.id, NEW.owner_auth_user_id, NEW.uploader_auth_user_id, NEW.access, NEW.created_at) IS DISTINCT FROM
    (OLD.id, OLD.owner_auth_user_id, OLD.uploader_auth_user_id, OLD.access, OLD.created_at) THEN
    RAISE EXCEPTION 'Image identity, account ownership and access are immutable' USING ERRCODE = '23514';
  END IF;
  SELECT erased_at INTO erased FROM public.users WHERE id = NEW.owner_auth_user_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Image requires an Auth owner' USING ERRCODE = '23514'; END IF;
  IF erased IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.deleted_at IS NULL OR
    (to_jsonb(NEW) - ARRAY['deleted_at','content_erased_at','erasure_fence_version_id','updated_at']) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['deleted_at','content_erased_at','erasure_fence_version_id','updated_at'])) THEN
    RAISE EXCEPTION 'Erased accounts cannot write image content' USING ERRCODE = '23514', CONSTRAINT = 'active_account_required';
  END IF;
  IF TG_OP = 'UPDATE' AND (OLD.content_erased_at IS NOT NULL AND NEW.content_erased_at IS DISTINCT FROM OLD.content_erased_at OR
    OLD.erasure_fence_version_id IS NOT NULL AND NEW.erasure_fence_version_id IS DISTINCT FROM OLD.erasure_fence_version_id) THEN
    RAISE EXCEPTION 'Private image erasure is irreversible' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_image_owner_guard ON public.image_asset;
CREATE TRIGGER participation_image_owner_guard BEFORE INSERT OR UPDATE ON public.image_asset
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_image_owner();

CREATE OR REPLACE FUNCTION public.participation_guard_image_child()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM 1 FROM public.image_asset asset JOIN public.users account ON account.id = asset.owner_auth_user_id
    WHERE asset.id = NEW.asset_id AND asset.deleted_at IS NULL AND account.erased_at IS NULL FOR SHARE OF account, asset;
  IF NOT FOUND THEN RAISE EXCEPTION 'Image content requires an active Auth owner' USING ERRCODE = '23514', CONSTRAINT = 'active_account_required'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_image_child_guard ON public.image_object;
CREATE TRIGGER participation_image_child_guard BEFORE INSERT OR UPDATE ON public.image_object
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_image_child();
DROP TRIGGER IF EXISTS participation_image_child_guard ON public.image_asset_presentation;
CREATE TRIGGER participation_image_child_guard BEFORE INSERT OR UPDATE ON public.image_asset_presentation
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_image_child();

CREATE OR REPLACE FUNCTION public.participation_guard_quota_subject()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE subject_id uuid;
BEGIN
  subject_id := coalesce(to_jsonb(NEW) ->> 'account_user_id', to_jsonb(NEW) ->> 'user_id')::uuid;
  IF subject_id IS NULL THEN
    SELECT reference_id INTO subject_id FROM public.apikeys WHERE id = (to_jsonb(NEW) ->> 'token_id')::uuid;
  END IF;
  PERFORM 1 FROM public.users WHERE id = subject_id AND erased_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quota state requires an active Auth account' USING ERRCODE = '23514', CONSTRAINT = 'active_account_required'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.participation_guard_conversation_member()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE marker_id uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.conversation WHERE id = NEW.conversation_id AND NEW.auth_user_id IN (participant_low_auth_user_id, participant_high_auth_user_id)) THEN
    RAISE EXCEPTION 'Private conversation state requires an admitted participant' USING ERRCODE = '23514';
  END IF;
  marker_id := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
  IF marker_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.message WHERE id = marker_id AND conversation_id = NEW.conversation_id) THEN
    RAISE EXCEPTION 'Conversation marker must belong to the same conversation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS participation_conversation_member_guard ON public.conversation_read;
CREATE TRIGGER participation_conversation_member_guard BEFORE INSERT OR UPDATE ON public.conversation_read
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_conversation_member('last_read_message_id');
DROP TRIGGER IF EXISTS participation_conversation_member_guard ON public.conversation_participant_stat;
CREATE TRIGGER participation_conversation_member_guard BEFORE INSERT OR UPDATE ON public.conversation_participant_stat
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_conversation_member('last_message_id');

-- Favorites engagement is derived from the private relation without exposing the owning account.
DROP TRIGGER IF EXISTS favorite_item_stats_maintain ON public.collection_item;
DROP FUNCTION IF EXISTS public.maintain_favorite_item_stats();
CREATE OR REPLACE FUNCTION public.maintain_account_favorite_stats()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE row_data public.account_favorite%ROWTYPE; direction bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN row_data := NEW; direction := 1;
  ELSE row_data := OLD; direction := -1; END IF;
  PERFORM public.apply_unit_engagement_stat(row_data.target_unit_id, p_favorites => direction);
  PERFORM public.apply_recommendation_unit_signal(row_data.target_unit_id, row_data.created_at, 'favorite', direction, direction * 5);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS account_favorite_stats_maintain ON public.account_favorite;
CREATE TRIGGER account_favorite_stats_maintain AFTER INSERT OR DELETE ON public.account_favorite
FOR EACH ROW EXECUTE FUNCTION public.maintain_account_favorite_stats();

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.recommendation_event;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.recommendation_event
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.recommendation_exclusion;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.recommendation_exclusion
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.studio_resource_visit;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.studio_resource_visit
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.studio_auth_editor_candidate;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.studio_auth_editor_candidate
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.account_favorites_state;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.account_favorites_state
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.account_favorite;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.account_favorite
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.account_favorite_revision;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.account_favorite_revision
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.account_realm_tag_subscription;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.account_realm_tag_subscription
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.account_unit_tag;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.account_unit_tag
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.book_chapter_progress_stat;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.book_chapter_progress_stat
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.conversation_participant_stat;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.conversation_participant_stat
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.api_token_creation_reservation;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF account_user_id ON public.api_token_creation_reservation
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('account_user_id');

DROP TRIGGER IF EXISTS participation_quota_subject_guard ON public.api_account_quota_binding;
CREATE TRIGGER participation_quota_subject_guard BEFORE INSERT OR UPDATE ON public.api_account_quota_binding
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_quota_subject();

DROP TRIGGER IF EXISTS participation_quota_subject_guard ON public.api_token_quota_binding;
CREATE TRIGGER participation_quota_subject_guard BEFORE INSERT OR UPDATE ON public.api_token_quota_binding
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_quota_subject();

DROP TRIGGER IF EXISTS participation_quota_subject_guard ON public.api_token_quota_override;
CREATE TRIGGER participation_quota_subject_guard BEFORE INSERT OR UPDATE ON public.api_token_quota_override
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_quota_subject();

DROP TRIGGER IF EXISTS participation_quota_subject_guard ON public.api_quota_rate_state;
CREATE TRIGGER participation_quota_subject_guard BEFORE INSERT OR UPDATE ON public.api_quota_rate_state
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_quota_subject();

DROP TRIGGER IF EXISTS participation_quota_subject_guard ON public.api_quota_daily_usage;
CREATE TRIGGER participation_quota_subject_guard BEFORE INSERT OR UPDATE ON public.api_quota_daily_usage
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_quota_subject();

DROP TRIGGER IF EXISTS participation_quota_subject_guard ON public.api_quota_request_lease;
CREATE TRIGGER participation_quota_subject_guard BEFORE INSERT OR UPDATE ON public.api_quota_request_lease
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_quota_subject();

-- Aggregate recommendation signals outlive event-log retention; event erasure removes private attribution only.
CREATE OR REPLACE FUNCTION public.maintain_recommendation_event_signals() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
DECLARE row_data recommendation_event%ROWTYPE; direction bigint;
unit_weight double precision;
change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    IF row_data.auth_user_id IS NOT NULL
      AND row_data.type IN ('impression', 'open', 'dwell_30s', 'not_interested') THEN
      unit_weight := CASE row_data.type WHEN 'open' THEN 1 WHEN 'dwell_30s' THEN 2 ELSE 0 END;
      PERFORM apply_recommendation_unit_signal(
        row_data.target_unit_id, row_data.occurred_at,
        row_data.type::text, direction, direction * unit_weight
      );
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS recommendation_event_signals_maintain ON public.recommendation_event;
CREATE TRIGGER recommendation_event_signals_maintain AFTER INSERT OR UPDATE ON public.recommendation_event
FOR EACH ROW EXECUTE FUNCTION public.maintain_recommendation_event_signals();


-- Operational membership is separate from sourced catalog affiliations and capability grants.
CREATE OR REPLACE FUNCTION public.organization_membership_lock_admission(organization_id uuid, recipient_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  -- All invitation admissions acquire the inbox lock before the organization lock.
  PERFORM pg_advisory_xact_lock(hashtextextended('organization-membership-inbox:' || recipient_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('organization-membership-organization:' || organization_id::text, 0));
END $$;

CREATE OR REPLACE FUNCTION public.organization_membership_assert_invitation_authority(
  organization_id uuid, organization_revision bigint, issuer_id uuid, issuer_revision bigint,
  grant_id uuid, grant_revision bigint)
RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM 1 FROM public.users WHERE id = issuer_id AND principal_kind = 'human' AND erased_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership invitation issuer is unavailable' USING ERRCODE = '23514'; END IF;
  PERFORM 1 FROM public.entity_participation WHERE entity_id = organization_id AND state = 'active' AND revision = organization_revision FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership organization generation is unavailable' USING ERRCODE = '23514'; END IF;
  PERFORM 1 FROM public.entity_identity WHERE id = organization_id AND shape = 'organization' AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Operational membership requires a controlled organization' USING ERRCODE = '23514'; END IF;
  PERFORM 1 FROM public.auth_entity WHERE auth_user_id = issuer_id AND state = 'active' AND revision = issuer_revision FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership invitation issuer binding changed' USING ERRCODE = '23514'; END IF;
  PERFORM 1 FROM public.participation_grant WHERE id = grant_id AND revision = grant_revision
    AND auth_user_id = issuer_id AND service_principal_id IS NULL
    AND acting_entity_id = organization_id AND entity_id = organization_id
    AND capability = 'entity.membership' AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > clock_timestamp()) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership invitation authority changed' USING ERRCODE = '23514'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.organization_membership_guard_invitation()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE pending_count integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.users WHERE id = OLD.recipient_auth_user_id AND erased_at IS NOT NULL) THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Membership invitations are retained until recipient account erasure' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.id, NEW.organization_entity_id, NEW.organization_revision, NEW.recipient_auth_user_id,
      NEW.recipient_entity_id, NEW.invited_by_auth_user_id, NEW.inviter_authorization_revision,
      NEW.authorization_grant_id, NEW.authorization_grant_revision, NEW.expires_at, NEW.created_at)
      IS DISTINCT FROM (OLD.id, OLD.organization_entity_id, OLD.organization_revision, OLD.recipient_auth_user_id,
      OLD.recipient_entity_id, OLD.invited_by_auth_user_id, OLD.inviter_authorization_revision,
      OLD.authorization_grant_id, OLD.authorization_grant_revision, OLD.expires_at, OLD.created_at)
      OR OLD.state <> 'pending' OR NEW.state = 'pending' OR NEW.revision <> OLD.revision + 1 THEN
      RAISE EXCEPTION 'Membership invitation identity and terminal state are immutable' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.state <> 'pending' OR NEW.revision <> 1 THEN
      RAISE EXCEPTION 'Membership invitations start pending at revision one' USING ERRCODE = '23514';
    END IF;
    PERFORM public.organization_membership_lock_admission(NEW.organization_entity_id, NEW.recipient_auth_user_id);
    IF EXISTS (SELECT 1 FROM public.organization_membership WHERE organization_entity_id = NEW.organization_entity_id
      AND member_auth_user_id = NEW.recipient_auth_user_id AND removed_at IS NULL) THEN
      RAISE EXCEPTION 'An active member does not need a new invitation' USING ERRCODE = '23514';
    END IF;
    SELECT count(*)::integer INTO pending_count FROM (
      SELECT id FROM public.organization_membership_invitation
      WHERE organization_entity_id = NEW.organization_entity_id AND state = 'pending' LIMIT 1001
    ) bounded;
    IF pending_count >= 1000 THEN RAISE EXCEPTION 'Organization pending invitation capacity reached' USING ERRCODE = '23514'; END IF;
    SELECT count(*)::integer INTO pending_count FROM (
      SELECT id FROM public.organization_membership_invitation
      WHERE recipient_auth_user_id = NEW.recipient_auth_user_id AND state = 'pending' LIMIT 1001
    ) bounded;
    IF pending_count >= 1000 THEN RAISE EXCEPTION 'Recipient pending invitation capacity reached' USING ERRCODE = '23514'; END IF;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.state = 'accepted' THEN
    PERFORM public.organization_membership_lock_admission(NEW.organization_entity_id, NEW.recipient_auth_user_id);
    PERFORM public.organization_membership_assert_invitation_authority(
      NEW.organization_entity_id, NEW.organization_revision, NEW.invited_by_auth_user_id,
      NEW.inviter_authorization_revision, NEW.authorization_grant_id, NEW.authorization_grant_revision);
    PERFORM 1 FROM public.users WHERE id = NEW.recipient_auth_user_id AND principal_kind = 'human' AND erased_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Membership recipient is unavailable' USING ERRCODE = '23514', CONSTRAINT = 'active_account_required'; END IF;
    PERFORM 1 FROM public.auth_entity WHERE auth_user_id = NEW.recipient_auth_user_id
      AND entity_id = NEW.recipient_entity_id AND state = 'active' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Membership recipient is not this account self identity' USING ERRCODE = '23514'; END IF;
    IF NEW.expires_at <= clock_timestamp() THEN RAISE EXCEPTION 'Membership invitation expired' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS organization_membership_invitation_guard ON public.organization_membership_invitation;
CREATE TRIGGER organization_membership_invitation_guard BEFORE INSERT OR UPDATE OR DELETE ON public.organization_membership_invitation
FOR EACH ROW EXECUTE FUNCTION public.organization_membership_guard_invitation();

CREATE OR REPLACE FUNCTION public.organization_membership_guard_member()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE invitation public.organization_membership_invitation%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.users WHERE id = OLD.member_auth_user_id AND erased_at IS NOT NULL) THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Membership removal retains its account-owned record until erasure' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.organization_entity_id, NEW.member_auth_user_id, NEW.member_entity_id, NEW.created_at)
      IS DISTINCT FROM (OLD.organization_entity_id, OLD.member_auth_user_id, OLD.member_entity_id, OLD.created_at)
      OR NEW.revision <> OLD.revision + 1 THEN
      RAISE EXCEPTION 'Membership identity is immutable and revisions advance exactly once' USING ERRCODE = '23514';
    END IF;
    IF NEW.removed_at IS NOT NULL THEN
      IF OLD.removed_at IS NOT NULL OR NEW.accepted_invitation_id <> OLD.accepted_invitation_id OR NEW.joined_at <> OLD.joined_at THEN
        RAISE EXCEPTION 'Only an active membership can be removed' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END IF;
    IF OLD.removed_at IS NULL OR NEW.accepted_invitation_id = OLD.accepted_invitation_id THEN
      RAISE EXCEPTION 'Rejoining requires a different accepted invitation' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.revision <> 1 OR NEW.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Membership begins active at revision one' USING ERRCODE = '23514';
  END IF;
  PERFORM public.organization_membership_lock_admission(NEW.organization_entity_id, NEW.member_auth_user_id);
  SELECT * INTO invitation FROM public.organization_membership_invitation WHERE id = NEW.accepted_invitation_id FOR SHARE;
  IF NOT FOUND OR invitation.state <> 'accepted' OR invitation.organization_entity_id <> NEW.organization_entity_id
    OR invitation.recipient_auth_user_id <> NEW.member_auth_user_id OR invitation.recipient_entity_id <> NEW.member_entity_id
    OR invitation.resolved_by_auth_user_id IS DISTINCT FROM NEW.member_auth_user_id OR invitation.resolved_at IS DISTINCT FROM NEW.joined_at THEN
    RAISE EXCEPTION 'Membership requires the exact recipient accepted invitation' USING ERRCODE = '23514';
  END IF;
  PERFORM public.organization_membership_assert_invitation_authority(
    invitation.organization_entity_id, invitation.organization_revision, invitation.invited_by_auth_user_id,
    invitation.inviter_authorization_revision, invitation.authorization_grant_id, invitation.authorization_grant_revision);
  PERFORM 1 FROM public.users WHERE id = NEW.member_auth_user_id AND principal_kind = 'human' AND erased_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership account is unavailable' USING ERRCODE = '23514', CONSTRAINT = 'active_account_required'; END IF;
  PERFORM 1 FROM public.auth_entity WHERE auth_user_id = NEW.member_auth_user_id AND entity_id = NEW.member_entity_id AND state = 'active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership belongs to another self identity' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS organization_membership_guard ON public.organization_membership;
CREATE TRIGGER organization_membership_guard BEFORE INSERT OR UPDATE OR DELETE ON public.organization_membership
FOR EACH ROW EXECUTE FUNCTION public.organization_membership_guard_member();

CREATE OR REPLACE FUNCTION public.organization_membership_guard_event()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE member public.organization_membership%ROWTYPE;
DECLARE expected_operation text;
DECLARE expected_operator uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.users WHERE id = OLD.member_auth_user_id AND erased_at IS NOT NULL) THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Membership events are retained until member account erasure' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'Membership events are immutable' USING ERRCODE = '23514'; END IF;
  SELECT * INTO member FROM public.organization_membership WHERE organization_entity_id = NEW.organization_entity_id
    AND member_auth_user_id = NEW.member_auth_user_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership event requires its current owner' USING ERRCODE = '23514'; END IF;
  expected_operation := CASE WHEN member.removed_at IS NULL THEN 'join'
    WHEN member.removed_by_auth_user_id = member.member_auth_user_id THEN 'leave' ELSE 'remove' END;
  expected_operator := coalesce(member.removed_by_auth_user_id, member.member_auth_user_id);
  IF (NEW.member_entity_id, NEW.revision, NEW.accepted_invitation_id, NEW.created_at, NEW.operation, NEW.operator_auth_user_id)
    IS DISTINCT FROM (member.member_entity_id, member.revision, member.accepted_invitation_id, member.updated_at, expected_operation, expected_operator) THEN
    RAISE EXCEPTION 'Membership event must capture its exact validated transition' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.organization_membership_record_event()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  INSERT INTO public.organization_membership_event (
    organization_entity_id, member_auth_user_id, member_entity_id, revision, operation,
    operator_auth_user_id, accepted_invitation_id, created_at)
  VALUES (NEW.organization_entity_id, NEW.member_auth_user_id, NEW.member_entity_id, NEW.revision,
    CASE WHEN NEW.removed_at IS NULL THEN 'join' WHEN NEW.removed_by_auth_user_id = NEW.member_auth_user_id THEN 'leave' ELSE 'remove' END,
    coalesce(NEW.removed_by_auth_user_id, NEW.member_auth_user_id), NEW.accepted_invitation_id, NEW.updated_at);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS organization_membership_event_guard ON public.organization_membership_event;
CREATE TRIGGER organization_membership_event_guard BEFORE INSERT OR UPDATE OR DELETE ON public.organization_membership_event
FOR EACH ROW EXECUTE FUNCTION public.organization_membership_guard_event();
DROP TRIGGER IF EXISTS organization_membership_event_record ON public.organization_membership;
CREATE TRIGGER organization_membership_event_record AFTER INSERT OR UPDATE ON public.organization_membership
FOR EACH ROW EXECUTE FUNCTION public.organization_membership_record_event();


CREATE OR REPLACE FUNCTION public.catalog_source_application_includes_epoch(source_id uuid, requested_proposal_id uuid, mapping_id uuid, epoch_revision bigint)
RETURNS boolean LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.catalog_source_adoption_proposal p
    JOIN public.catalog_source_binding_revision r ON r.source_record_id=p.source_record_id AND r.mapping_key=p.mapping_key AND r.revision=p.expected_binding_revision
    WHERE p.source_record_id=source_id AND p.id=requested_proposal_id AND p.mapping_key=mapping_id AND r.correspondence_revision=epoch_revision
    UNION ALL
    SELECT 1 FROM public.catalog_source_application a
    WHERE a.source_record_id=source_id AND a.proposal_id=requested_proposal_id
      AND a.mapping_key=mapping_id AND a.action='apply' AND a.previous_correspondence_revision=epoch_revision
      AND a.previous_observed_snapshot_id IS NOT NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.catalog_source_validate_application_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE history public.music_component_revision%ROWTYPE; application public.catalog_source_application%ROWTYPE; proposal_state text; after_sequence bigint;
BEGIN
  SELECT * INTO STRICT application FROM public.catalog_source_application WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action;
  SELECT state INTO STRICT proposal_state FROM public.catalog_source_adoption_proposal WHERE source_record_id=NEW.source_record_id AND id=NEW.proposal_id;
  IF NEW.position >= application.change_count OR (NEW.action='apply' AND proposal_state <> 'pending') OR (NEW.action='withdraw' AND proposal_state <> 'applied') THEN
    RAISE EXCEPTION 'Native change must belong to its in-progress application' USING ERRCODE = '23514';
  END IF;
  IF TG_ARGV[0] = 'music' THEN
    SELECT * INTO STRICT history FROM public.music_component_revision WHERE owner_id = NEW.owner_id AND id = NEW.after_revision_id;
    IF history.component <> NEW.component OR history.component_key <> NEW.component_key THEN
      RAISE EXCEPTION 'Music application history has a different component key' USING ERRCODE = '23514';
    END IF;
    after_sequence := history.component_sequence;
    IF NEW.before_revision_id IS NOT NULL THEN
      SELECT * INTO STRICT history FROM public.music_component_revision WHERE owner_id = NEW.owner_id AND id = NEW.before_revision_id;
      IF history.component <> NEW.component OR history.component_key <> NEW.component_key OR history.component_sequence >= after_sequence THEN
        RAISE EXCEPTION 'Music application before history has a different component or order' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_source_require_application_complete()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE application public.catalog_source_application%ROWTYPE; proposal public.catalog_source_adoption_proposal%ROWTYPE;
  actual_count integer; unique_positions integer; first_position integer; last_position integer;
BEGIN
  SELECT * INTO STRICT application FROM public.catalog_source_application
    WHERE source_record_id = NEW.source_record_id AND proposal_id = NEW.proposal_id AND action = NEW.action;
  SELECT * INTO STRICT proposal FROM public.catalog_source_adoption_proposal
    WHERE source_record_id = NEW.source_record_id AND id = NEW.proposal_id;
  IF application.mapping_key <> proposal.mapping_key THEN RAISE EXCEPTION 'Native application must retain the exact proposal mapping' USING ERRCODE='23514'; END IF;
  IF application.previous_correspondence_revision IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.catalog_source_binding_revision b WHERE b.source_record_id=application.source_record_id AND b.mapping_key=application.mapping_key AND b.revision=application.previous_correspondence_revision AND b.correspondence_revision=b.revision
  ) THEN RAISE EXCEPTION 'Previous native source correspondence must reference an epoch anchor' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.catalog_source_binding_revision b WHERE b.source_record_id=proposal.source_record_id AND b.mapping_key=proposal.mapping_key AND b.revision=proposal.expected_binding_revision AND
    application.previous_snapshot_id IS NOT DISTINCT FROM CASE WHEN application.previous_correspondence_revision=b.correspondence_revision THEN application.previous_observed_snapshot_id ELSE NULL END
  ) THEN RAISE EXCEPTION 'Effective previous source snapshot must match the proposal correspondence epoch' USING ERRCODE='23514'; END IF;
  IF (application.action = 'apply' AND proposal.state NOT IN ('applied','withdrawn'))
    OR (application.action = 'withdraw' AND proposal.state <> 'withdrawn') THEN
    RAISE EXCEPTION 'Native application must commit its corresponding proposal decision' USING ERRCODE = '23514';
  END IF;
  SELECT count(*), count(DISTINCT position), min(position), max(position)
    INTO actual_count, unique_positions, first_position, last_position FROM (
      SELECT position FROM public.music_source_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.program_structure_source_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.publishing_structure_source_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_component_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_record_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.publishing_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.publishing_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.publishing_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.music_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.music_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.music_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.program_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.program_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.program_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.entity_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.entity_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.entity_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.grouping_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.grouping_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.grouping_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.reference_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.reference_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.reference_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.distribution_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.distribution_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.distribution_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_context_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_participation_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.entity_source_profile_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.reference_source_profile_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.publishing_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.music_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.program_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.entity_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.grouping_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.reference_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.distribution_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
    ) changes;
  IF actual_count <> application.change_count OR unique_positions <> actual_count
    OR (actual_count > 0 AND (first_position <> 0 OR last_position <> actual_count - 1)) THEN
    RAISE EXCEPTION 'Native application requires a complete contiguous change manifest' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;

DO $$
DECLARE relation_name text; physical record;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['catalog_source_application','music_source_application_change','software_source_component_application_change','software_source_record_application_change','publishing_source_semantic_application_change','publishing_source_name_application_change','publishing_source_authority_application_change','publishing_source_identifier_application_change','music_source_semantic_application_change','music_source_name_application_change','music_source_authority_application_change','music_source_identifier_application_change','program_source_semantic_application_change','program_source_name_application_change','program_source_authority_application_change','program_source_identifier_application_change','software_source_semantic_application_change','software_source_name_application_change','software_source_authority_application_change','software_source_identifier_application_change','entity_source_semantic_application_change','entity_source_name_application_change','entity_source_authority_application_change','entity_source_identifier_application_change','grouping_source_semantic_application_change','grouping_source_name_application_change','grouping_source_authority_application_change','grouping_source_identifier_application_change','reference_source_semantic_application_change','reference_source_name_application_change','reference_source_authority_application_change','reference_source_identifier_application_change','distribution_source_semantic_application_change','distribution_source_name_application_change','distribution_source_authority_application_change','distribution_source_identifier_application_change','software_source_context_application_change','software_source_participation_application_change','entity_source_profile_application_change','reference_source_profile_application_change'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_application_immutable ON public.%I', relation_name);
    EXECUTE format('CREATE TRIGGER catalog_source_application_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_immutable_evidence()', relation_name);
    IF relation_name NOT IN ('catalog_source_application','music_source_application_change') THEN
      EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_application_change_guard ON public.%I', relation_name);
      EXECUTE format('CREATE TRIGGER catalog_source_application_change_guard BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_validate_application_change()', relation_name);
    END IF;
  END LOOP;
  FOR physical IN
    WITH RECURSIVE roots AS (
      SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('catalog_source_application','music_source_application_change','software_source_component_application_change','software_source_record_application_change','publishing_source_semantic_application_change','publishing_source_name_application_change','publishing_source_authority_application_change','publishing_source_identifier_application_change','music_source_semantic_application_change','music_source_name_application_change','music_source_authority_application_change','music_source_identifier_application_change','program_source_semantic_application_change','program_source_name_application_change','program_source_authority_application_change','program_source_identifier_application_change','software_source_semantic_application_change','software_source_name_application_change','software_source_authority_application_change','software_source_identifier_application_change','entity_source_semantic_application_change','entity_source_name_application_change','entity_source_authority_application_change','entity_source_identifier_application_change','grouping_source_semantic_application_change','grouping_source_name_application_change','grouping_source_authority_application_change','grouping_source_identifier_application_change','reference_source_semantic_application_change','reference_source_name_application_change','reference_source_authority_application_change','reference_source_identifier_application_change','distribution_source_semantic_application_change','distribution_source_name_application_change','distribution_source_authority_application_change','distribution_source_identifier_application_change','software_source_context_application_change','software_source_participation_application_change','entity_source_profile_application_change','reference_source_profile_application_change')
      UNION ALL SELECT i.inhrelid FROM pg_inherits i JOIN roots r ON r.oid=i.inhparent
    ) SELECT c.oid::regclass AS name, c.relname AS local_name FROM roots r JOIN pg_class c ON c.oid=r.oid WHERE c.relkind='r'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_application_complete ON %s', physical.name);
    IF physical.local_name LIKE 'catalog_source_application%' THEN
      EXECUTE format('CREATE CONSTRAINT TRIGGER catalog_source_application_complete AFTER INSERT ON %s DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_source_require_application_complete()', physical.name);
    END IF;
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS music_source_application_exact_component ON public.music_source_application_change;
CREATE TRIGGER music_source_application_exact_component BEFORE INSERT ON public.music_source_application_change
  FOR EACH ROW EXECUTE FUNCTION public.catalog_source_validate_application_change('music');

CREATE OR REPLACE FUNCTION public.catalog_source_guard_proposal()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Source proposal decisions are retained evidence' USING ERRCODE='23514'; END IF;
  IF (NEW.source_record_id,NEW.id,NEW.snapshot_id,NEW.mapping_key,NEW.mapping_owner,NEW.mapping_version,NEW.expected_target_revision,NEW.expected_binding_revision,NEW.expected_policy_revision,NEW.created_at)
    IS DISTINCT FROM (OLD.source_record_id,OLD.id,OLD.snapshot_id,OLD.mapping_key,OLD.mapping_owner,OLD.mapping_version,OLD.expected_target_revision,OLD.expected_binding_revision,OLD.expected_policy_revision,OLD.created_at)
    OR (NEW.proposer_auth_user_id IS DISTINCT FROM OLD.proposer_auth_user_id AND NEW.proposer_auth_user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Source proposal scope and preconditions are immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.state = OLD.state THEN
    IF (NEW.decided_at,NEW.decision_reason,NEW.applied_target_revision) IS DISTINCT FROM (OLD.decided_at,OLD.decision_reason,OLD.applied_target_revision) THEN
      RAISE EXCEPTION 'Source proposal decisions are immutable without an allowed transition' USING ERRCODE='23514';
    END IF;
  ELSIF NOT ((OLD.state='pending' AND NEW.state IN ('applied','rejected','superseded')) OR (OLD.state='applied' AND NEW.state='withdrawn')) THEN
    RAISE EXCEPTION 'Source proposal transition is not allowed' USING ERRCODE='23514';
  END IF;
  IF NEW.state IN ('applied','withdrawn') AND NOT EXISTS (
    SELECT 1 FROM public.catalog_source_application WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.id
      AND action=CASE WHEN NEW.state='applied' THEN 'apply' ELSE 'withdraw' END AND after_revision=NEW.applied_target_revision
  ) THEN
    RAISE EXCEPTION 'Source proposal decision requires its exact native application' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS catalog_source_proposal_guard ON public.catalog_source_adoption_proposal;
CREATE TRIGGER catalog_source_proposal_guard BEFORE UPDATE OR DELETE ON public.catalog_source_adoption_proposal
  FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_proposal();


CREATE OR REPLACE FUNCTION public.catalog_structure_source_projection_valid(component_name text, source_value jsonb, observed_fields text[])
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public AS $$
DECLARE shape_name text; allowed text[]; uuids text[] := '{}'; integers text[] := '{}'; numbers text[] := '{}'; strings text[] := '{}'; fields jsonb; field_name text; scalar jsonb; numeric_value numeric; yr numeric; mon numeric; dy numeric; maximum_day integer;
BEGIN
  CASE component_name
    WHEN 'program_work' THEN shape_name:='program'; uuids:=ARRAY['typeRevisionId']; integers:=ARRAY['declaredMainEpisodeCount','declaredTotalEpisodeCount'];
    WHEN 'program_season' THEN shape_name:='season'; uuids:=ARRAY['programId']; strings:=ARRAY['number'];
    WHEN 'program_version' THEN shape_name:='program_version'; uuids:=ARRAY['programId','versionTypeRevisionId']; integers:=ARRAY['lengthMilliseconds'];
    WHEN 'program_episode' THEN shape_name:='episode'; uuids:=ARRAY['programId','seasonId','typeRevisionId']; integers:=ARRAY['discNumber','lengthMilliseconds']; numbers:=ARRAY['sortNumber','episodeNumber']; strings:=ARRAY['durationText','dateText'];
    WHEN 'publishing_work' THEN shape_name:='work';
    WHEN 'publishing_text_version' THEN shape_name:='text_version'; uuids:=ARRAY['methodRevisionId']; strings:=ARRAY['languageTag'];
    WHEN 'publishing_publication' THEN shape_name:='publication'; integers:=ARRAY['pageCount']; strings:=ARRAY['paginationText'];
    WHEN 'publishing_serialization' THEN shape_name:='serialization'; uuids:=ARRAY['textVersionId','statusRevisionId'];
    ELSE RETURN false;
  END CASE;
  IF source_value IS NULL OR jsonb_typeof(source_value) IS DISTINCT FROM 'object' OR source_value->>'shape' IS DISTINCT FROM shape_name
    OR source_value-'shape'-'fields'<>'{}'::jsonb OR jsonb_typeof(source_value->'fields') IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  fields:=source_value->'fields'; allowed:=uuids||integers||numbers||strings;
  IF component_name='program_episode' THEN allowed:=allowed||ARRAY['date']; END IF;
  IF NOT fields ?& allowed OR fields-allowed<>'{}'::jsonb OR observed_fields IS NULL OR cardinality(observed_fields)>32
    OR NOT observed_fields<@allowed OR (SELECT count(*)<>count(DISTINCT k) FROM unnest(observed_fields) k) THEN RETURN false; END IF;
  IF component_name='program_episode' AND fields->'seasonId'<>'null'::jsonb AND fields->'programId'='null'::jsonb THEN RETURN false; END IF;
  FOREACH field_name IN ARRAY allowed LOOP
    scalar:=fields->field_name;
    IF NOT field_name=ANY(observed_fields) THEN
      IF field_name='date' THEN
        IF scalar<>'{"year":null,"month":null,"day":null}'::jsonb THEN RETURN false; END IF;
      ELSIF scalar<>'null'::jsonb THEN RETURN false; END IF;
    END IF;
    IF scalar='null'::jsonb THEN
      IF field_name='date' THEN RETURN false; END IF;
      CONTINUE;
    END IF;
    IF field_name=ANY(uuids) THEN
      IF jsonb_typeof(scalar)<>'string' OR fields->>field_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
    ELSIF field_name=ANY(integers) OR field_name=ANY(numbers) THEN
      IF jsonb_typeof(scalar)<>'number' THEN RETURN false; END IF;
      numeric_value:=(fields->>field_name)::numeric;
      IF field_name=ANY(integers) AND (numeric_value<0 OR numeric_value>9007199254740991 OR trunc(numeric_value)<>numeric_value) THEN RETURN false; END IF;
      IF field_name='discNumber' AND numeric_value>2147483647 THEN RETURN false; END IF;
      IF abs(numeric_value)>1.7976931348623157e308::numeric THEN RETURN false; END IF;
    ELSIF field_name=ANY(strings) THEN
      IF jsonb_typeof(scalar)<>'string' OR char_length(fields->>field_name)>(CASE WHEN field_name IN('number','durationText','dateText') THEN 4096 WHEN field_name='languageTag' THEN 255 ELSE 131072 END) THEN RETURN false; END IF;
    ELSE
      IF jsonb_typeof(scalar)<>'object' OR NOT scalar ?& ARRAY['year','month','day'] OR scalar-'year'-'month'-'day'<>'{}'::jsonb THEN RETURN false; END IF;
      IF EXISTS(SELECT 1 FROM jsonb_each(scalar) f WHERE jsonb_typeof(f.value) NOT IN ('number','null')) THEN RETURN false; END IF;
      yr:=(scalar->>'year')::numeric; mon:=(scalar->>'month')::numeric; dy:=(scalar->>'day')::numeric;
      IF yr IS NOT NULL AND (yr<>trunc(yr) OR yr NOT BETWEEN -2147483648 AND 2147483647) THEN RETURN false; END IF;
      IF mon IS NOT NULL AND (mon<>trunc(mon) OR mon NOT BETWEEN 1 AND 12) THEN RETURN false; END IF;
      IF dy IS NOT NULL AND (dy<>trunc(dy) OR dy NOT BETWEEN 1 AND 31) THEN RETURN false; END IF;
      IF mon IS NOT NULL AND dy IS NOT NULL THEN
        maximum_day:=CASE WHEN mon=2 THEN CASE WHEN yr IS NULL OR mod(yr,400)=0 OR (mod(yr,4)=0 AND mod(yr,100)<>0) THEN 29 ELSE 28 END WHEN mon IN(4,6,9,11) THEN 30 ELSE 31 END;
        IF dy>maximum_day THEN RETURN false; END IF;
      END IF;
    END IF;
  END LOOP;
  RETURN true;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_structure_source_guard_occurrence()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE root public.catalog_source_binding_revision%ROWTYPE; native record; shape_name text; parent_id uuid; definition_id uuid; field_name text; expected_shape text;
BEGIN
  IF TG_ARGV[0] NOT IN ('program','publishing') OR NEW.component NOT LIKE TG_ARGV[0]||'_%' OR NEW.component_key<>NEW.owner_id::text
    OR NOT public.catalog_structure_source_projection_valid(NEW.component,NEW.source_value,NEW.observed_fields) THEN
    RAISE EXCEPTION 'Structure source projection must contain only typed observed values' USING ERRCODE='23514';
  END IF;
  SELECT * INTO STRICT root FROM public.catalog_source_binding_revision WHERE source_record_id=NEW.source_record_id AND mapping_key=NEW.mapping_key AND revision=NEW.correspondence_revision;
  IF root.correspondence_revision<>root.revision OR root.owner<>NEW.mapping_owner THEN RAISE EXCEPTION 'Structure source requires its exact root correspondence epoch' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT component,component_key,operation FROM public.%I WHERE owner_id=$1 AND id=$2',TG_ARGV[0]||'_component_revision') INTO STRICT native USING NEW.owner_id,NEW.history_id;
  IF native.component<>NEW.component OR native.component_key<>NEW.component_key OR native.operation='DELETE' THEN RAISE EXCEPTION 'Structure source history belongs to another native component' USING ERRCODE='23514'; END IF;
  FOREACH field_name IN ARRAY (CASE WHEN TG_ARGV[0]='program' THEN ARRAY['programId','seasonId'] ELSE ARRAY['textVersionId'] END) LOOP
    parent_id:=(NEW.source_value->'fields'->>field_name)::uuid;
    IF parent_id IS NULL THEN CONTINUE; END IF;
    expected_shape:=CASE field_name WHEN 'programId' THEN 'program' WHEN 'seasonId' THEN 'season' ELSE 'text_version' END;
    EXECUTE format('SELECT shape FROM public.%I WHERE id=$1',TG_ARGV[0]||'_identity') INTO STRICT shape_name USING parent_id;
    IF shape_name<>expected_shape THEN RAISE EXCEPTION 'Structure source parent has another native shape' USING ERRCODE='23514'; END IF;
  END LOOP;
  FOREACH field_name IN ARRAY ARRAY['typeRevisionId','versionTypeRevisionId','methodRevisionId','statusRevisionId'] LOOP
    definition_id:=(NEW.source_value->'fields'->>field_name)::uuid;
    IF definition_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.catalog_definition_revision r JOIN public.catalog_definition d ON d.id=r.definition_id WHERE r.id=definition_id AND d.kind='vocabulary') THEN
      RAISE EXCEPTION 'Structure source type or method requires an exact vocabulary revision' USING ERRCODE='23514';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_structure_source_guard_application()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE application public.catalog_source_application%ROWTYPE; proposal_state text; before_row record; after_row record; current_id uuid;
BEGIN
  IF TG_ARGV[0] NOT IN ('program','publishing') OR NEW.component NOT LIKE TG_ARGV[0]||'_%' OR NEW.component_key<>NEW.owner_id::text THEN RAISE EXCEPTION 'Structure application owner differs' USING ERRCODE='23514'; END IF;
  SELECT * INTO STRICT application FROM public.catalog_source_application WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action;
  SELECT state INTO STRICT proposal_state FROM public.catalog_source_adoption_proposal WHERE source_record_id=NEW.source_record_id AND id=NEW.proposal_id;
  IF NEW.position>=application.change_count OR (NEW.action='apply' AND proposal_state<>'pending') OR (NEW.action='withdraw' AND proposal_state<>'applied') THEN RAISE EXCEPTION 'Structure change requires its in-progress source application' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT component,component_key,component_sequence FROM public.%I WHERE owner_id=$1 AND id=$2',TG_ARGV[0]||'_component_revision') INTO STRICT after_row USING NEW.owner_id,NEW.after_revision_id;
  IF after_row.component<>NEW.component OR after_row.component_key<>NEW.component_key THEN RAISE EXCEPTION 'Structure application after history differs' USING ERRCODE='23514'; END IF;
  IF NEW.before_revision_id IS NOT NULL THEN
    EXECUTE format('SELECT component,component_key,component_sequence FROM public.%I WHERE owner_id=$1 AND id=$2',TG_ARGV[0]||'_component_revision') INTO STRICT before_row USING NEW.owner_id,NEW.before_revision_id;
    IF before_row.component<>NEW.component OR before_row.component_key<>NEW.component_key OR before_row.component_sequence>=after_row.component_sequence THEN RAISE EXCEPTION 'Structure application history order differs' USING ERRCODE='23514'; END IF;
  END IF;
  EXECUTE format('SELECT history_id FROM public.%I WHERE owner_id=$1 AND component=$2 AND component_key=$3',TG_ARGV[0]||'_component_head') INTO STRICT current_id USING NEW.owner_id,NEW.component,NEW.component_key;
  IF current_id<>NEW.after_revision_id THEN RAISE EXCEPTION 'Structure application does not identify the current child head' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_structure_source_guard_baseline()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE source_row record; native record; previous_sequence bigint; root public.catalog_source_binding_revision%ROWTYPE; matched boolean;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Structure source baselines are retained evidence' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (NEW.source_record_id,NEW.mapping_key,NEW.correspondence_revision,NEW.mapping_owner,NEW.owner_id,NEW.component,NEW.component_key) IS DISTINCT FROM (OLD.source_record_id,OLD.mapping_key,OLD.correspondence_revision,OLD.mapping_owner,OLD.owner_id,OLD.component,OLD.component_key) THEN RAISE EXCEPTION 'Structure baseline identity is immutable' USING ERRCODE='23514'; END IF;
  SELECT * INTO STRICT root FROM public.catalog_source_binding_revision WHERE source_record_id=NEW.source_record_id AND mapping_key=NEW.mapping_key AND revision=NEW.correspondence_revision;
  IF root.correspondence_revision<>root.revision OR root.owner<>NEW.mapping_owner OR NOT public.catalog_source_application_includes_epoch(NEW.source_record_id,NEW.proposal_id,NEW.mapping_key,NEW.correspondence_revision) THEN RAISE EXCEPTION 'Structure baseline requires an admitted application epoch' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT history_id,source_path FROM public.%I WHERE source_record_id=$1 AND mapping_key=$2 AND correspondence_revision=$3 AND snapshot_id=$4 AND owner_id=$5 AND component=$6 AND component_key=$7',TG_ARGV[0]||'_structure_source_occurrence') INTO STRICT source_row USING NEW.source_record_id,NEW.mapping_key,NEW.correspondence_revision,NEW.snapshot_id,NEW.owner_id,NEW.component,NEW.component_key;
  IF source_row.history_id<>NEW.source_history_id OR source_row.source_path<>NEW.source_path THEN RAISE EXCEPTION 'Structure baseline source occurrence differs' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT h.id,h.component,h.component_key,h.component_sequence FROM public.%I head JOIN public.%I h ON h.owner_id=head.owner_id AND h.id=head.history_id WHERE head.owner_id=$1 AND head.component=$2 AND head.component_key=$3',TG_ARGV[0]||'_component_head',TG_ARGV[0]||'_component_revision') INTO STRICT native USING NEW.owner_id,NEW.component,NEW.component_key;
  IF native.id<>NEW.current_history_id THEN RAISE EXCEPTION 'Structure baseline current history is stale' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' THEN
    EXECUTE format('SELECT component_sequence FROM public.%I WHERE owner_id=$1 AND id=$2',TG_ARGV[0]||'_component_revision') INTO STRICT previous_sequence USING OLD.owner_id,OLD.current_history_id;
    IF native.component_sequence<=previous_sequence THEN RAISE EXCEPTION 'Structure baseline history must advance' USING ERRCODE='23514'; END IF;
  END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE source_record_id=$1 AND proposal_id=$2 AND action=$3 AND owner_id=$4 AND component=$5 AND component_key=$6 AND after_revision_id=$7)',TG_ARGV[0]||'_structure_source_application_change') INTO matched USING NEW.source_record_id,NEW.proposal_id,NEW.action,NEW.owner_id,NEW.component,NEW.component_key,NEW.current_history_id;
  IF NOT matched THEN RAISE EXCEPTION 'Structure baseline current history lacks its exact application' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE owner_name text; table_name text;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['program','publishing'] LOOP
    FOREACH table_name IN ARRAY ARRAY[owner_name||'_structure_source_occurrence',owner_name||'_structure_source_application_change'] LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS catalog_structure_source_immutable ON public.%I',table_name);
      EXECUTE format('CREATE TRIGGER catalog_structure_source_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_immutable_evidence()',table_name);
    END LOOP;
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_structure_source_occurrence_guard ON public.%I',owner_name||'_structure_source_occurrence');
    EXECUTE format('CREATE TRIGGER catalog_structure_source_occurrence_guard BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_structure_source_guard_occurrence(%L)',owner_name||'_structure_source_occurrence',owner_name);
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_structure_source_application_guard ON public.%I',owner_name||'_structure_source_application_change');
    EXECUTE format('CREATE TRIGGER catalog_structure_source_application_guard BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_structure_source_guard_application(%L)',owner_name||'_structure_source_application_change',owner_name);
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_structure_source_baseline_guard ON public.%I',owner_name||'_structure_source_baseline');
    EXECUTE format('CREATE TRIGGER catalog_structure_source_baseline_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_structure_source_guard_baseline(%L)',owner_name||'_structure_source_baseline',owner_name);
  END LOOP;
END $$;
