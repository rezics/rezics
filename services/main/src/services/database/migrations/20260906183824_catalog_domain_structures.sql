SET search_path TO public;

-- Modify "grouping_identity" table
ALTER TABLE "grouping_identity" ADD CONSTRAINT "grouping_identity_shape_key" UNIQUE ("id", "shape");
-- Modify "reference_identity" table
ALTER TABLE "reference_identity" ADD CONSTRAINT "reference_identity_shape_key" UNIQUE ("id", "shape");
-- Create "reference_area" table
CREATE TABLE "reference_area" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL DEFAULT 'area',
  "type_revision_id" uuid NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "reference_area_fswCGZ3EBDaQ_fkey" FOREIGN KEY ("type_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_area_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "reference_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_area_shape_check" CHECK (identity_shape = 'area'::text)
);
-- Create index "reference_area_type_idx" to table: "reference_area"
CREATE INDEX "reference_area_type_idx" ON "reference_area" ("type_revision_id", "id");
-- Modify "entity_identity" table
ALTER TABLE "entity_identity" ADD CONSTRAINT "entity_identity_shape_key" UNIQUE ("id", "shape");
-- Create "entity_catalog_profile" table
CREATE TABLE "entity_catalog_profile" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL,
  "type_revision_id" uuid NULL,
  "gender_revision_id" uuid NULL,
  "area_id" uuid NULL,
  "begin_area_id" uuid NULL,
  "end_area_id" uuid NULL,
  "begin_year" integer NULL,
  "begin_month" smallint NULL,
  "begin_day" smallint NULL,
  "begin_text" text NULL,
  "end_year" integer NULL,
  "end_month" smallint NULL,
  "end_day" smallint NULL,
  "end_text" text NULL,
  "ended" boolean NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "entity_catalog_profile_1Jz7TnUF9Ixi_fkey" FOREIGN KEY ("type_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_catalog_profile_Sx82xOizlvw7_fkey" FOREIGN KEY ("gender_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_catalog_profile_area_id_reference_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "reference_area" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_catalog_profile_begin_area_id_reference_area_id_fkey" FOREIGN KEY ("begin_area_id") REFERENCES "reference_area" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_catalog_profile_end_area_id_reference_area_id_fkey" FOREIGN KEY ("end_area_id") REFERENCES "reference_area" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_catalog_profile_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "entity_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_catalog_profile_begin_check" CHECK (((begin_month IS NULL) OR ((begin_month >= 1) AND (begin_month <= 12))) AND ((begin_day IS NULL) OR ((begin_day >= 1) AND (begin_day <= 31))) AND ((begin_month IS NULL) OR (begin_day IS NULL) OR (begin_day <=
CASE
    WHEN (begin_month = ANY (ARRAY[4, 6, 9, 11])) THEN 30
    WHEN (begin_month = 2) THEN
    CASE
        WHEN ((begin_year IS NULL) OR (mod(begin_year, 400) = 0) OR ((mod(begin_year, 4) = 0) AND (mod(begin_year, 100) <> 0))) THEN 29
        ELSE 28
    END
    ELSE 31
END))),
  CONSTRAINT "entity_catalog_profile_end_check" CHECK (((end_month IS NULL) OR ((end_month >= 1) AND (end_month <= 12))) AND ((end_day IS NULL) OR ((end_day >= 1) AND (end_day <= 31))) AND ((end_month IS NULL) OR (end_day IS NULL) OR (end_day <=
CASE
    WHEN (end_month = ANY (ARRAY[4, 6, 9, 11])) THEN 30
    WHEN (end_month = 2) THEN
    CASE
        WHEN ((end_year IS NULL) OR (mod(end_year, 400) = 0) OR ((mod(end_year, 4) = 0) AND (mod(end_year, 100) <> 0))) THEN 29
        ELSE 28
    END
    ELSE 31
END))),
  CONSTRAINT "entity_catalog_profile_shape_check" CHECK (identity_shape = ANY (ARRAY['person'::text, 'organization'::text, 'character'::text, 'label'::text, 'collective'::text, 'unresolved'::text]))
);
-- Create index "entity_catalog_profile_area_idx" to table: "entity_catalog_profile"
CREATE INDEX "entity_catalog_profile_area_idx" ON "entity_catalog_profile" ("area_id", "id");
-- Create index "entity_catalog_profile_begin_area_idx" to table: "entity_catalog_profile"
CREATE INDEX "entity_catalog_profile_begin_area_idx" ON "entity_catalog_profile" ("begin_area_id", "id");
-- Create index "entity_catalog_profile_end_area_idx" to table: "entity_catalog_profile"
CREATE INDEX "entity_catalog_profile_end_area_idx" ON "entity_catalog_profile" ("end_area_id", "id");
-- Create index "entity_catalog_profile_gender_idx" to table: "entity_catalog_profile"
CREATE INDEX "entity_catalog_profile_gender_idx" ON "entity_catalog_profile" ("gender_revision_id", "id");
-- Create index "entity_catalog_profile_type_idx" to table: "entity_catalog_profile"
CREATE INDEX "entity_catalog_profile_type_idx" ON "entity_catalog_profile" ("type_revision_id", "id");
-- Create "music_artist_credit" table
CREATE TABLE "music_artist_credit" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "rendered_name" text NULL,
  "created_by_auth_user_id" uuid NULL,
  "publicly_reusable" boolean NOT NULL DEFAULT false,
  PRIMARY KEY ("id"),
  CONSTRAINT "music_artist_credit_created_by_auth_user_id_users_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL
);
-- Create index "music_artist_credit_creator_idx" to table: "music_artist_credit"
CREATE INDEX "music_artist_credit_creator_idx" ON "music_artist_credit" ("created_by_auth_user_id", "id");
-- Create "music_alternative_track" table
CREATE TABLE "music_alternative_track" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "name" text NULL,
  "artist_credit_id" uuid NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "music_alternative_track_2vlPAdHDnrfP_fkey" FOREIGN KEY ("artist_credit_id") REFERENCES "music_artist_credit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_alternative_track_value_check" CHECK (((name IS NOT NULL) OR (artist_credit_id IS NOT NULL)) AND ((name IS NULL) OR (length(name) > 0)))
);
-- Create index "music_alternative_track_credit_idx" to table: "music_alternative_track"
CREATE INDEX "music_alternative_track_credit_idx" ON "music_alternative_track" ("artist_credit_id", "id");
-- Create "music_artist_credit_name" table
CREATE TABLE "music_artist_credit_name" (
  "credit_id" uuid NOT NULL,
  "position" bigint NOT NULL,
  "artist_id" uuid NULL,
  "credited_name" text NOT NULL,
  "join_phrase" text NOT NULL DEFAULT '',
  PRIMARY KEY ("credit_id", "position"),
  CONSTRAINT "music_artist_credit_name_artist_id_entity_identity_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_artist_credit_name_credit_id_music_artist_credit_id_fkey" FOREIGN KEY ("credit_id") REFERENCES "music_artist_credit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_credit_name_check" CHECK (length(credited_name) > 0),
  CONSTRAINT "music_credit_position_check" CHECK (("position" >= 0) AND ("position" <= '9007199254740991'::bigint))
);
-- Create index "music_credit_artist_idx" to table: "music_artist_credit_name"
CREATE INDEX "music_credit_artist_idx" ON "music_artist_credit_name" ("artist_id", "credit_id", "position");
-- Create "music_credit_identifier" table
CREATE TABLE "music_credit_identifier" (
  "credit_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "value" text NOT NULL,
  PRIMARY KEY ("credit_id", "namespace", "value"),
  CONSTRAINT "music_credit_identifier_credit_id_music_artist_credit_id_fkey" FOREIGN KEY ("credit_id") REFERENCES "music_artist_credit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_credit_identifier_size_check" CHECK (((octet_length(namespace) >= 1) AND (octet_length(namespace) <= 96)) AND ((octet_length(value) >= 1) AND (octet_length(value) <= 512)))
);
-- Create index "music_credit_identifier_lookup_idx" to table: "music_credit_identifier"
CREATE INDEX "music_credit_identifier_lookup_idx" ON "music_credit_identifier" ("namespace", "value", "credit_id");
-- Create "music_disc_toc" table
CREATE TABLE "music_disc_toc" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "disc_id" text NULL,
  "free_db_id" text NULL,
  "track_count" integer NOT NULL,
  "leadout_offset" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "music_disc_toc_count_check" CHECK ((track_count >= 0) AND ((leadout_offset >= 0) AND (leadout_offset <= '9007199254740991'::bigint)))
);
-- Create index "music_disc_toc_disc_id_idx" to table: "music_disc_toc"
CREATE INDEX "music_disc_toc_disc_id_idx" ON "music_disc_toc" ("disc_id", "id");
-- Create "music_disc_toc_offset" table
CREATE TABLE "music_disc_toc_offset" (
  "toc_id" uuid NOT NULL,
  "position" integer NOT NULL,
  "offset" bigint NOT NULL,
  PRIMARY KEY ("toc_id", "position"),
  CONSTRAINT "music_disc_toc_offset_toc_id_music_disc_toc_id_fkey" FOREIGN KEY ("toc_id") REFERENCES "music_disc_toc" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_disc_toc_offset_check" CHECK (("position" >= 0) AND (("offset" >= 0) AND ("offset" <= '9007199254740991'::bigint)))
);
-- Modify "music_identity" table
ALTER TABLE "music_identity" ADD CONSTRAINT "music_identity_shape_key" UNIQUE ("id", "shape");
-- Create "music_release_group" table
CREATE TABLE "music_release_group" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL DEFAULT 'release_group',
  "artist_credit_id" uuid NULL,
  "primary_type_revision_id" uuid NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "music_release_group_4DjRPXC96Xyx_fkey" FOREIGN KEY ("primary_type_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_release_group_Jqm2XUojRtnB_fkey" FOREIGN KEY ("artist_credit_id") REFERENCES "music_artist_credit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_release_group_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "music_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_release_group_shape_check" CHECK (identity_shape = 'release_group'::text)
);
-- Create index "music_release_group_credit_idx" to table: "music_release_group"
CREATE INDEX "music_release_group_credit_idx" ON "music_release_group" ("artist_credit_id", "id");
-- Create index "music_release_group_type_idx" to table: "music_release_group"
CREATE INDEX "music_release_group_type_idx" ON "music_release_group" ("primary_type_revision_id", "id");
-- Create "music_release" table
CREATE TABLE "music_release" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL DEFAULT 'release',
  "release_group_id" uuid NULL,
  "artist_credit_id" uuid NULL,
  "status_revision_id" uuid NULL,
  "packaging_revision_id" uuid NULL,
  "language_tag" text NULL,
  "script_code" text NULL,
  "barcode" text NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "music_release_1Z5foKBRZYkp_fkey" FOREIGN KEY ("packaging_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_release_artist_credit_id_music_artist_credit_id_fkey" FOREIGN KEY ("artist_credit_id") REFERENCES "music_artist_credit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_release_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "music_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_release_release_group_id_music_release_group_id_fkey" FOREIGN KEY ("release_group_id") REFERENCES "music_release_group" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_release_t4GBP5tfA9ra_fkey" FOREIGN KEY ("status_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_release_language_check" CHECK ((language_tag IS NULL) OR ((octet_length(language_tag) >= 1) AND (octet_length(language_tag) <= 255))),
  CONSTRAINT "music_release_script_check" CHECK ((script_code IS NULL) OR (script_code ~ '^[A-Z][a-z]{3}$'::text)),
  CONSTRAINT "music_release_shape_check" CHECK (identity_shape = 'release'::text)
);
-- Create index "music_release_credit_idx" to table: "music_release"
CREATE INDEX "music_release_credit_idx" ON "music_release" ("artist_credit_id", "id");
-- Create index "music_release_group_idx" to table: "music_release"
CREATE INDEX "music_release_group_idx" ON "music_release" ("release_group_id", "id");
-- Create index "music_release_packaging_idx" to table: "music_release"
CREATE INDEX "music_release_packaging_idx" ON "music_release" ("packaging_revision_id", "id");
-- Create index "music_release_status_idx" to table: "music_release"
CREATE INDEX "music_release_status_idx" ON "music_release" ("status_revision_id", "id");
-- Create "music_medium" table
CREATE TABLE "music_medium" (
  "release_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "position" bigint NOT NULL,
  "name" text NULL,
  "format_revision_id" uuid NULL,
  "source_track_count" bigint NULL,
  PRIMARY KEY ("release_id", "id"),
  CONSTRAINT "music_medium_position_key" UNIQUE ("release_id", "position"),
  CONSTRAINT "music_medium_E27q7Ysj2h05_fkey" FOREIGN KEY ("format_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_medium_release_id_music_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "music_release" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_medium_position_check" CHECK (("position" >= 0) AND ("position" <= '9007199254740991'::bigint)),
  CONSTRAINT "music_medium_track_count_check" CHECK ((source_track_count IS NULL) OR ((source_track_count >= 0) AND (source_track_count <= '9007199254740991'::bigint)))
);
-- Create index "music_medium_format_idx" to table: "music_medium"
CREATE INDEX "music_medium_format_idx" ON "music_medium" ("format_revision_id", "release_id", "id");
-- Create "music_medium_identifier" table
CREATE TABLE "music_medium_identifier" (
  "release_id" uuid NOT NULL,
  "medium_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "value" text NOT NULL,
  PRIMARY KEY ("release_id", "medium_id", "namespace", "value"),
  CONSTRAINT "music_medium_identifier_medium_fk" FOREIGN KEY ("release_id", "medium_id") REFERENCES "music_medium" ("release_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_medium_identifier_size_check" CHECK (((octet_length(namespace) >= 1) AND (octet_length(namespace) <= 96)) AND ((octet_length(value) >= 1) AND (octet_length(value) <= 512)))
);
-- Create index "music_medium_identifier_lookup_idx" to table: "music_medium_identifier"
CREATE INDEX "music_medium_identifier_lookup_idx" ON "music_medium_identifier" ("namespace", "value", "release_id", "medium_id");
-- Create "music_release_presentation" table
CREATE TABLE "music_release_presentation" (
  "release_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "name" text NULL,
  "artist_credit_id" uuid NULL,
  "language_tag" text NULL,
  "script_code" text NULL,
  "type_revision_id" uuid NULL,
  "comment" text NULL,
  PRIMARY KEY ("release_id", "id"),
  CONSTRAINT "music_release_presentation_jy0uBxwutB8t_fkey" FOREIGN KEY ("type_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_release_presentation_ltQq07S8oN22_fkey" FOREIGN KEY ("artist_credit_id") REFERENCES "music_artist_credit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_release_presentation_release_id_music_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "music_release" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_release_presentation_language_check" CHECK ((language_tag IS NULL) OR ((octet_length(language_tag) >= 1) AND (octet_length(language_tag) <= 255))),
  CONSTRAINT "music_release_presentation_script_check" CHECK ((script_code IS NULL) OR (script_code ~ '^[A-Z][a-z]{3}$'::text))
);
-- Create index "music_release_presentation_credit_idx" to table: "music_release_presentation"
CREATE INDEX "music_release_presentation_credit_idx" ON "music_release_presentation" ("artist_credit_id", "release_id", "id");
-- Create index "music_release_presentation_type_idx" to table: "music_release_presentation"
CREATE INDEX "music_release_presentation_type_idx" ON "music_release_presentation" ("type_revision_id", "release_id", "id");
-- Create "music_medium_presentation" table
CREATE TABLE "music_medium_presentation" (
  "release_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "release_presentation_id" uuid NOT NULL,
  "medium_id" uuid NOT NULL,
  "name" text NULL,
  PRIMARY KEY ("release_id", "id"),
  CONSTRAINT "music_medium_presentation_medium_key" UNIQUE ("release_id", "id", "medium_id"),
  CONSTRAINT "music_medium_presentation_medium_fk" FOREIGN KEY ("release_id", "medium_id") REFERENCES "music_medium" ("release_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_medium_presentation_release_fk" FOREIGN KEY ("release_id", "release_presentation_id") REFERENCES "music_release_presentation" ("release_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "music_medium_presentation_medium_idx" to table: "music_medium_presentation"
CREATE INDEX "music_medium_presentation_medium_idx" ON "music_medium_presentation" ("release_id", "medium_id", "id");
-- Create index "music_medium_presentation_release_idx" to table: "music_medium_presentation"
CREATE INDEX "music_medium_presentation_release_idx" ON "music_medium_presentation" ("release_id", "release_presentation_id", "id");
-- Create "music_medium_toc" table
CREATE TABLE "music_medium_toc" (
  "release_id" uuid NOT NULL,
  "medium_id" uuid NOT NULL,
  "toc_id" uuid NOT NULL,
  PRIMARY KEY ("release_id", "medium_id", "toc_id"),
  CONSTRAINT "music_medium_toc_medium_fk" FOREIGN KEY ("release_id", "medium_id") REFERENCES "music_medium" ("release_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_medium_toc_toc_id_music_disc_toc_id_fkey" FOREIGN KEY ("toc_id") REFERENCES "music_disc_toc" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "music_medium_toc_reverse_idx" to table: "music_medium_toc"
CREATE INDEX "music_medium_toc_reverse_idx" ON "music_medium_toc" ("toc_id", "release_id", "medium_id");
-- Create "music_recording" table
CREATE TABLE "music_recording" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL DEFAULT 'recording',
  "artist_credit_id" uuid NULL,
  "length_milliseconds" bigint NULL,
  "video" boolean NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "music_recording_artist_credit_id_music_artist_credit_id_fkey" FOREIGN KEY ("artist_credit_id") REFERENCES "music_artist_credit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_recording_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "music_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_recording_length_check" CHECK ((length_milliseconds IS NULL) OR ((length_milliseconds >= 0) AND (length_milliseconds <= '9007199254740991'::bigint))),
  CONSTRAINT "music_recording_shape_check" CHECK (identity_shape = 'recording'::text)
);
-- Create index "music_recording_credit_idx" to table: "music_recording"
CREATE INDEX "music_recording_credit_idx" ON "music_recording" ("artist_credit_id", "id");
-- Create "music_release_event" table
CREATE TABLE "music_release_event" (
  "release_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "area_id" uuid NULL,
  "date_year" integer NULL,
  "date_month" smallint NULL,
  "date_day" smallint NULL,
  "date_text" text NULL,
  PRIMARY KEY ("release_id", "id"),
  CONSTRAINT "music_release_event_area_id_reference_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "reference_area" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_release_event_release_id_music_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "music_release" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_release_event_date_check" CHECK (((date_month IS NULL) OR ((date_month >= 1) AND (date_month <= 12))) AND ((date_day IS NULL) OR ((date_day >= 1) AND (date_day <= 31))) AND ((date_month IS NULL) OR (date_day IS NULL) OR (date_day <=
CASE
    WHEN (date_month = ANY (ARRAY[4, 6, 9, 11])) THEN 30
    WHEN (date_month = 2) THEN
    CASE
        WHEN ((date_year IS NULL) OR (mod(date_year, 400) = 0) OR ((mod(date_year, 4) = 0) AND (mod(date_year, 100) <> 0))) THEN 29
        ELSE 28
    END
    ELSE 31
END)))
);
-- Create index "music_release_event_area_idx" to table: "music_release_event"
CREATE INDEX "music_release_event_area_idx" ON "music_release_event" ("area_id", "release_id", "id");
-- Create "music_release_group_secondary_type" table
CREATE TABLE "music_release_group_secondary_type" (
  "release_group_id" uuid NOT NULL,
  "type_revision_id" uuid NOT NULL,
  PRIMARY KEY ("release_group_id", "type_revision_id"),
  CONSTRAINT "music_release_group_secondary_type_c4EZjxeVrn5M_fkey" FOREIGN KEY ("type_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_release_group_secondary_type_ezqrXWOLziN5_fkey" FOREIGN KEY ("release_group_id") REFERENCES "music_release_group" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "music_release_group_secondary_type_reverse_idx" to table: "music_release_group_secondary_type"
CREATE INDEX "music_release_group_secondary_type_reverse_idx" ON "music_release_group_secondary_type" ("type_revision_id", "release_group_id");
-- Create "music_release_label" table
CREATE TABLE "music_release_label" (
  "release_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "label_id" uuid NULL,
  "catalog_number" text NULL,
  PRIMARY KEY ("release_id", "id"),
  CONSTRAINT "music_release_label_label_id_entity_identity_id_fkey" FOREIGN KEY ("label_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_release_label_release_id_music_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "music_release" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "music_release_label_reverse_idx" to table: "music_release_label"
CREATE INDEX "music_release_label_reverse_idx" ON "music_release_label" ("label_id", "release_id", "id");
-- Create "music_track_occurrence" table
CREATE TABLE "music_track_occurrence" (
  "release_id" uuid NOT NULL,
  "medium_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "position" bigint NOT NULL,
  "number" text NOT NULL,
  "name" text NULL,
  "recording_id" uuid NULL,
  "artist_credit_id" uuid NULL,
  "length_milliseconds" bigint NULL,
  "is_data_track" boolean NULL,
  PRIMARY KEY ("release_id", "id"),
  CONSTRAINT "music_track_occurrence_medium_key" UNIQUE ("release_id", "id", "medium_id"),
  CONSTRAINT "music_track_occurrence_position_key" UNIQUE ("release_id", "medium_id", "position"),
  CONSTRAINT "music_track_occurrence_FbQaZ6B8aMGf_fkey" FOREIGN KEY ("artist_credit_id") REFERENCES "music_artist_credit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_track_occurrence_medium_fk" FOREIGN KEY ("release_id", "medium_id") REFERENCES "music_medium" ("release_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_track_occurrence_recording_id_music_recording_id_fkey" FOREIGN KEY ("recording_id") REFERENCES "music_recording" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_track_length_check" CHECK ((length_milliseconds IS NULL) OR ((length_milliseconds >= 0) AND (length_milliseconds <= '9007199254740991'::bigint))),
  CONSTRAINT "music_track_position_check" CHECK (("position" >= 0) AND ("position" <= '9007199254740991'::bigint))
);
-- Create index "music_track_credit_idx" to table: "music_track_occurrence"
CREATE INDEX "music_track_credit_idx" ON "music_track_occurrence" ("artist_credit_id", "release_id", "id");
-- Create index "music_track_recording_idx" to table: "music_track_occurrence"
CREATE INDEX "music_track_recording_idx" ON "music_track_occurrence" ("recording_id", "release_id", "id");
-- Create "music_track_identifier" table
CREATE TABLE "music_track_identifier" (
  "release_id" uuid NOT NULL,
  "track_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "value" text NOT NULL,
  PRIMARY KEY ("release_id", "track_id", "namespace", "value"),
  CONSTRAINT "music_track_identifier_track_fk" FOREIGN KEY ("release_id", "track_id") REFERENCES "music_track_occurrence" ("release_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_track_identifier_size_check" CHECK (((octet_length(namespace) >= 1) AND (octet_length(namespace) <= 96)) AND ((octet_length(value) >= 1) AND (octet_length(value) <= 512)))
);
-- Create index "music_track_identifier_lookup_idx" to table: "music_track_identifier"
CREATE INDEX "music_track_identifier_lookup_idx" ON "music_track_identifier" ("namespace", "value", "release_id", "track_id");
-- Create "music_track_presentation" table
CREATE TABLE "music_track_presentation" (
  "release_id" uuid NOT NULL,
  "medium_presentation_id" uuid NOT NULL,
  "medium_id" uuid NOT NULL,
  "track_id" uuid NOT NULL,
  "alternative_track_id" uuid NOT NULL,
  PRIMARY KEY ("release_id", "medium_presentation_id", "track_id"),
  CONSTRAINT "music_track_presentation_JVDbMSa5LN8C_fkey" FOREIGN KEY ("alternative_track_id") REFERENCES "music_alternative_track" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_track_presentation_medium_fk" FOREIGN KEY ("release_id", "medium_presentation_id", "medium_id") REFERENCES "music_medium_presentation" ("release_id", "id", "medium_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_track_presentation_track_fk" FOREIGN KEY ("release_id", "track_id", "medium_id") REFERENCES "music_track_occurrence" ("release_id", "id", "medium_id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "music_track_presentation_alternative_idx" to table: "music_track_presentation"
CREATE INDEX "music_track_presentation_alternative_idx" ON "music_track_presentation" ("alternative_track_id", "release_id", "track_id");
-- Create index "music_track_presentation_track_idx" to table: "music_track_presentation"
CREATE INDEX "music_track_presentation_track_idx" ON "music_track_presentation" ("release_id", "track_id", "medium_id");
-- Create "music_work" table
CREATE TABLE "music_work" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL DEFAULT 'work',
  "type_revision_id" uuid NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "music_work_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "music_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_work_type_revision_id_catalog_definition_revision_id_fkey" FOREIGN KEY ("type_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_work_shape_check" CHECK (identity_shape = 'work'::text)
);
-- Create index "music_work_type_idx" to table: "music_work"
CREATE INDEX "music_work_type_idx" ON "music_work" ("type_revision_id", "id");
-- Create "music_work_language" table
CREATE TABLE "music_work_language" (
  "work_id" uuid NOT NULL,
  "language_tag" text NOT NULL,
  PRIMARY KEY ("work_id", "language_tag"),
  CONSTRAINT "music_work_language_work_id_music_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "music_work" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_work_language_size_check" CHECK ((octet_length(language_tag) >= 1) AND (octet_length(language_tag) <= 255))
);
-- Create index "music_work_language_reverse_idx" to table: "music_work_language"
CREATE INDEX "music_work_language_reverse_idx" ON "music_work_language" ("language_tag", "work_id");
-- Modify "program_identity" table
ALTER TABLE "program_identity" ADD CONSTRAINT "program_identity_shape_key" UNIQUE ("id", "shape");
-- Create "program_work" table
CREATE TABLE "program_work" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL DEFAULT 'program',
  "type_revision_id" uuid NULL,
  "declared_main_episode_count" bigint NULL,
  "declared_total_episode_count" bigint NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "program_work_cVOmDQmX9dhN_fkey" FOREIGN KEY ("type_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_work_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "program_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_work_counts_check" CHECK (((declared_main_episode_count IS NULL) OR ((declared_main_episode_count >= 0) AND (declared_main_episode_count <= '9007199254740991'::bigint))) AND ((declared_total_episode_count IS NULL) OR ((declared_total_episode_count >= 0) AND (declared_total_episode_count <= '9007199254740991'::bigint)))),
  CONSTRAINT "program_work_shape_check" CHECK (identity_shape = 'program'::text)
);
-- Create index "program_work_type_idx" to table: "program_work"
CREATE INDEX "program_work_type_idx" ON "program_work" ("type_revision_id", "id");
-- Create "program_season" table
CREATE TABLE "program_season" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL DEFAULT 'season',
  "program_id" uuid NULL,
  "number" text NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "program_season_program_key" UNIQUE ("id", "program_id"),
  CONSTRAINT "program_season_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "program_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_season_program_id_program_work_id_fkey" FOREIGN KEY ("program_id") REFERENCES "program_work" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_season_shape_check" CHECK (identity_shape = 'season'::text)
);
-- Create index "program_season_program_idx" to table: "program_season"
CREATE INDEX "program_season_program_idx" ON "program_season" ("program_id", "id");
-- Create "program_episode" table
CREATE TABLE "program_episode" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL DEFAULT 'episode',
  "program_id" uuid NULL,
  "season_id" uuid NULL,
  "type_revision_id" uuid NULL,
  "sort_number" numeric NULL,
  "episode_number" numeric NULL,
  "disc_number" integer NULL,
  "duration_text" text NULL,
  "length_milliseconds" bigint NULL,
  "date_year" integer NULL,
  "date_month" smallint NULL,
  "date_day" smallint NULL,
  "date_text" text NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "program_episode_D53InDOH4kY9_fkey" FOREIGN KEY ("type_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_episode_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "program_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_episode_program_id_program_work_id_fkey" FOREIGN KEY ("program_id") REFERENCES "program_work" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_episode_season_id_program_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "program_season" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_episode_season_program_fk" FOREIGN KEY ("season_id", "program_id") REFERENCES "program_season" ("id", "program_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_episode_date_check" CHECK (((date_month IS NULL) OR ((date_month >= 1) AND (date_month <= 12))) AND ((date_day IS NULL) OR ((date_day >= 1) AND (date_day <= 31))) AND ((date_month IS NULL) OR (date_day IS NULL) OR (date_day <=
CASE
    WHEN (date_month = ANY (ARRAY[4, 6, 9, 11])) THEN 30
    WHEN (date_month = 2) THEN
    CASE
        WHEN ((date_year IS NULL) OR (mod(date_year, 400) = 0) OR ((mod(date_year, 4) = 0) AND (mod(date_year, 100) <> 0))) THEN 29
        ELSE 28
    END
    ELSE 31
END))),
  CONSTRAINT "program_episode_length_check" CHECK ((length_milliseconds IS NULL) OR ((length_milliseconds >= 0) AND (length_milliseconds <= '9007199254740991'::bigint))),
  CONSTRAINT "program_episode_numbers_check" CHECK (((sort_number IS NULL) OR ((sort_number)::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text]))) AND ((episode_number IS NULL) OR ((episode_number)::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])))),
  CONSTRAINT "program_episode_shape_check" CHECK (identity_shape = 'episode'::text)
);
-- Create index "program_episode_program_idx" to table: "program_episode"
CREATE INDEX "program_episode_program_idx" ON "program_episode" ("program_id", "sort_number", "id");
-- Create index "program_episode_season_idx" to table: "program_episode"
CREATE INDEX "program_episode_season_idx" ON "program_episode" ("season_id", "program_id", "id");
-- Create index "program_episode_type_idx" to table: "program_episode"
CREATE INDEX "program_episode_type_idx" ON "program_episode" ("type_revision_id", "id");
-- Create "program_episode_occurrence" table
CREATE TABLE "program_episode_occurrence" (
  "owner_id" uuid NOT NULL,
  "owner_shape" text NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "episode_id" uuid NOT NULL,
  "position" text NOT NULL COLLATE "C",
  "source_number" text NULL,
  PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "program_episode_occurrence_episode_id_program_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "program_episode" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_occurrence_owner_shape_fk" FOREIGN KEY ("owner_id", "owner_shape") REFERENCES "program_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_occurrence_owner_shape_check" CHECK (owner_shape = ANY (ARRAY['program'::text, 'season'::text, 'program_version'::text])),
  CONSTRAINT "program_occurrence_position_check" CHECK (octet_length("position") <= 1024)
);
-- Create index "program_occurrence_episode_idx" to table: "program_episode_occurrence"
CREATE INDEX "program_occurrence_episode_idx" ON "program_episode_occurrence" ("episode_id", "owner_id", "id");
-- Create index "program_occurrence_position_idx" to table: "program_episode_occurrence"
CREATE INDEX "program_occurrence_position_idx" ON "program_episode_occurrence" ("owner_id", "position", "id");
-- Create "program_version" table
CREATE TABLE "program_version" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL DEFAULT 'program_version',
  "program_id" uuid NULL,
  "version_type_revision_id" uuid NULL,
  "length_milliseconds" bigint NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "program_version_Xwk6P7td9Ozh_fkey" FOREIGN KEY ("version_type_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_version_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "program_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_version_program_id_program_work_id_fkey" FOREIGN KEY ("program_id") REFERENCES "program_work" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_version_length_check" CHECK ((length_milliseconds IS NULL) OR ((length_milliseconds >= 0) AND (length_milliseconds <= '9007199254740991'::bigint))),
  CONSTRAINT "program_version_shape_check" CHECK (identity_shape = 'program_version'::text)
);
-- Create index "program_version_program_idx" to table: "program_version"
CREATE INDEX "program_version_program_idx" ON "program_version" ("program_id", "id");
-- Create index "program_version_type_idx" to table: "program_version"
CREATE INDEX "program_version_type_idx" ON "program_version" ("version_type_revision_id", "id");
-- Modify "publishing_identity" table
ALTER TABLE "publishing_identity" ADD CONSTRAINT "publishing_identity_shape_key" UNIQUE ("id", "shape");
-- Create "publishing_text_version" table
CREATE TABLE "publishing_text_version" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL DEFAULT 'text_version',
  "language_tag" text NULL,
  "method_revision_id" uuid NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "publishing_text_version_YsFG50RsjinM_fkey" FOREIGN KEY ("method_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_text_version_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "publishing_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_text_language_check" CHECK ((language_tag IS NULL) OR ((octet_length(language_tag) >= 1) AND (octet_length(language_tag) <= 255))),
  CONSTRAINT "publishing_text_version_shape_check" CHECK (identity_shape = 'text_version'::text)
);
-- Create index "publishing_text_method_idx" to table: "publishing_text_version"
CREATE INDEX "publishing_text_method_idx" ON "publishing_text_version" ("method_revision_id", "id");
-- Create "publishing_serialization" table
CREATE TABLE "publishing_serialization" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL DEFAULT 'serialization',
  "text_version_id" uuid NULL,
  "status_revision_id" uuid NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "publishing_serialization_8hebCe6rWOch_fkey" FOREIGN KEY ("status_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_serialization_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "publishing_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_serialization_p6dp9wHao0R0_fkey" FOREIGN KEY ("text_version_id") REFERENCES "publishing_text_version" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_serialization_shape_check" CHECK (identity_shape = 'serialization'::text)
);
-- Create index "publishing_serialization_status_idx" to table: "publishing_serialization"
CREATE INDEX "publishing_serialization_status_idx" ON "publishing_serialization" ("status_revision_id", "id");
-- Create index "publishing_serialization_text_idx" to table: "publishing_serialization"
CREATE INDEX "publishing_serialization_text_idx" ON "publishing_serialization" ("text_version_id", "id");
-- Create "publishing_installment" table
CREATE TABLE "publishing_installment" (
  "serialization_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "parent_id" uuid NULL,
  "position" text NOT NULL COLLATE "C",
  "label" text NULL,
  "kind_revision_id" uuid NOT NULL,
  "date_year" integer NULL,
  "date_month" smallint NULL,
  "date_day" smallint NULL,
  "date_text" text NULL,
  PRIMARY KEY ("serialization_id", "id"),
  CONSTRAINT "publishing_installment_c4blnpTIwcf2_fkey" FOREIGN KEY ("kind_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_installment_parent_fk" FOREIGN KEY ("serialization_id", "parent_id") REFERENCES "publishing_installment" ("serialization_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_installment_xZJA36yoEl1V_fkey" FOREIGN KEY ("serialization_id") REFERENCES "publishing_serialization" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_installment_date_check" CHECK (((date_month IS NULL) OR ((date_month >= 1) AND (date_month <= 12))) AND ((date_day IS NULL) OR ((date_day >= 1) AND (date_day <= 31))) AND ((date_month IS NULL) OR (date_day IS NULL) OR (date_day <=
CASE
    WHEN (date_month = ANY (ARRAY[4, 6, 9, 11])) THEN 30
    WHEN (date_month = 2) THEN
    CASE
        WHEN ((date_year IS NULL) OR (mod(date_year, 400) = 0) OR ((mod(date_year, 4) = 0) AND (mod(date_year, 100) <> 0))) THEN 29
        ELSE 28
    END
    ELSE 31
END))),
  CONSTRAINT "publishing_installment_parent_check" CHECK ((parent_id IS NULL) OR (parent_id <> id)),
  CONSTRAINT "publishing_installment_position_check" CHECK (octet_length("position") <= 1024)
);
-- Create index "publishing_installment_kind_idx" to table: "publishing_installment"
CREATE INDEX "publishing_installment_kind_idx" ON "publishing_installment" ("kind_revision_id", "serialization_id", "id");
-- Create index "publishing_installment_parent_idx" to table: "publishing_installment"
CREATE INDEX "publishing_installment_parent_idx" ON "publishing_installment" ("serialization_id", "parent_id", "position", "id");
-- Create "publishing_publication" table
CREATE TABLE "publishing_publication" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL DEFAULT 'publication',
  "page_count" bigint NULL,
  "pagination_text" text NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "publishing_publication_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "publishing_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_publication_pages_check" CHECK ((page_count IS NULL) OR ((page_count >= 0) AND (page_count <= '9007199254740991'::bigint))),
  CONSTRAINT "publishing_publication_shape_check" CHECK (identity_shape = 'publication'::text)
);
-- Create "publishing_publication_facet" table
CREATE TABLE "publishing_publication_facet" (
  "publication_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  PRIMARY KEY ("publication_id", "definition_revision_id"),
  CONSTRAINT "publishing_publication_facet_aV1Av2KZGFza_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_publication_facet_eUVeTvyD0YsY_fkey" FOREIGN KEY ("publication_id") REFERENCES "publishing_publication" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "publishing_publication_facet_reverse_idx" to table: "publishing_publication_facet"
CREATE INDEX "publishing_publication_facet_reverse_idx" ON "publishing_publication_facet" ("definition_revision_id", "publication_id");
-- Create "publishing_publication_text" table
CREATE TABLE "publishing_publication_text" (
  "publication_id" uuid NOT NULL,
  "text_version_id" uuid NOT NULL,
  "position" bigint NOT NULL,
  "coverage_text" text NULL,
  PRIMARY KEY ("publication_id", "text_version_id"),
  CONSTRAINT "publishing_publication_text_5Ki4iLYISD5A_fkey" FOREIGN KEY ("text_version_id") REFERENCES "publishing_text_version" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_publication_text_dHRlBv55saiC_fkey" FOREIGN KEY ("publication_id") REFERENCES "publishing_publication" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_publication_text_position_check" CHECK (("position" >= 0) AND ("position" <= '9007199254740991'::bigint))
);
-- Create index "publishing_publication_text_position_idx" to table: "publishing_publication_text"
CREATE INDEX "publishing_publication_text_position_idx" ON "publishing_publication_text" ("publication_id", "position", "text_version_id");
-- Create index "publishing_publication_text_reverse_idx" to table: "publishing_publication_text"
CREATE INDEX "publishing_publication_text_reverse_idx" ON "publishing_publication_text" ("text_version_id", "publication_id");
-- Create "publishing_release_event" table
CREATE TABLE "publishing_release_event" (
  "publication_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "publisher_entity_id" uuid NULL,
  "publisher_credit" text NULL,
  "area_id" uuid NULL,
  "date_year" integer NULL,
  "date_month" smallint NULL,
  "date_day" smallint NULL,
  "date_text" text NULL,
  PRIMARY KEY ("publication_id", "id"),
  CONSTRAINT "publishing_release_event_area_id_reference_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "reference_area" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_release_event_o6pUMaedNNMy_fkey" FOREIGN KEY ("publisher_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_release_event_zQChRmc09vlo_fkey" FOREIGN KEY ("publication_id") REFERENCES "publishing_publication" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_release_event_date_check" CHECK (((date_month IS NULL) OR ((date_month >= 1) AND (date_month <= 12))) AND ((date_day IS NULL) OR ((date_day >= 1) AND (date_day <= 31))) AND ((date_month IS NULL) OR (date_day IS NULL) OR (date_day <=
CASE
    WHEN (date_month = ANY (ARRAY[4, 6, 9, 11])) THEN 30
    WHEN (date_month = 2) THEN
    CASE
        WHEN ((date_year IS NULL) OR (mod(date_year, 400) = 0) OR ((mod(date_year, 4) = 0) AND (mod(date_year, 100) <> 0))) THEN 29
        ELSE 28
    END
    ELSE 31
END)))
);
-- Create index "publishing_release_event_area_idx" to table: "publishing_release_event"
CREATE INDEX "publishing_release_event_area_idx" ON "publishing_release_event" ("area_id", "publication_id", "id");
-- Create index "publishing_release_event_publisher_idx" to table: "publishing_release_event"
CREATE INDEX "publishing_release_event_publisher_idx" ON "publishing_release_event" ("publisher_entity_id", "publication_id", "id");
-- Create "publishing_work" table
CREATE TABLE "publishing_work" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL DEFAULT 'work',
  PRIMARY KEY ("id"),
  CONSTRAINT "publishing_work_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "publishing_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_work_shape_check" CHECK (identity_shape = 'work'::text)
);
-- Create "publishing_text_work" table
CREATE TABLE "publishing_text_work" (
  "text_version_id" uuid NOT NULL,
  "work_id" uuid NOT NULL,
  "position" bigint NOT NULL,
  "coverage_text" text NULL,
  PRIMARY KEY ("text_version_id", "work_id"),
  CONSTRAINT "publishing_text_work_CnDyyZIaRRg3_fkey" FOREIGN KEY ("text_version_id") REFERENCES "publishing_text_version" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_text_work_work_id_publishing_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "publishing_work" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_text_work_position_check" CHECK (("position" >= 0) AND ("position" <= '9007199254740991'::bigint))
);
-- Create index "publishing_text_work_position_idx" to table: "publishing_text_work"
CREATE INDEX "publishing_text_work_position_idx" ON "publishing_text_work" ("text_version_id", "position", "work_id");
-- Create index "publishing_text_work_reverse_idx" to table: "publishing_text_work"
CREATE INDEX "publishing_text_work_reverse_idx" ON "publishing_text_work" ("work_id", "text_version_id");
-- Create "reference_area_code" table
CREATE TABLE "reference_area_code" (
  "area_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "code" text NOT NULL,
  PRIMARY KEY ("area_id", "namespace", "code"),
  CONSTRAINT "reference_area_code_area_id_reference_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "reference_area" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_area_code_size_check" CHECK (((octet_length(namespace) >= 1) AND (octet_length(namespace) <= 64)) AND ((octet_length(code) >= 1) AND (octet_length(code) <= 128)))
);
-- Create index "reference_area_code_lookup_idx" to table: "reference_area_code"
CREATE INDEX "reference_area_code_lookup_idx" ON "reference_area_code" ("namespace", "code", "area_id");
-- Create "reference_place" table
CREATE TABLE "reference_place" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL DEFAULT 'place',
  "area_id" uuid NULL,
  "type_revision_id" uuid NULL,
  "address" text NULL,
  "latitude" numeric NULL,
  "longitude" numeric NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "reference_place_area_id_reference_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "reference_area" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_place_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "reference_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_place_pkGJQNvsvhQM_fkey" FOREIGN KEY ("type_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_place_coordinates_check" CHECK (((latitude IS NULL) OR ((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric))) AND ((longitude IS NULL) OR ((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric))) AND ((latitude IS NULL) = (longitude IS NULL))),
  CONSTRAINT "reference_place_shape_check" CHECK (identity_shape = 'place'::text)
);
-- Create index "reference_place_area_idx" to table: "reference_place"
CREATE INDEX "reference_place_area_idx" ON "reference_place" ("area_id", "id");
-- Create index "reference_place_type_idx" to table: "reference_place"
CREATE INDEX "reference_place_type_idx" ON "reference_place" ("type_revision_id", "id");
-- Create "reference_event" table
CREATE TABLE "reference_event" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL DEFAULT 'event',
  "type_revision_id" uuid NULL,
  "place_id" uuid NULL,
  "date_year" integer NULL,
  "date_month" smallint NULL,
  "date_day" smallint NULL,
  "date_text" text NULL,
  "end_year" integer NULL,
  "end_month" smallint NULL,
  "end_day" smallint NULL,
  "end_text" text NULL,
  "local_time" time NULL,
  "cancelled" boolean NULL,
  "ended" boolean NULL,
  "setlist" text NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "reference_event_Eu1CQHkn0KpL_fkey" FOREIGN KEY ("type_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_event_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "reference_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_event_place_id_reference_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "reference_place" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_event_date_check" CHECK (((date_month IS NULL) OR ((date_month >= 1) AND (date_month <= 12))) AND ((date_day IS NULL) OR ((date_day >= 1) AND (date_day <= 31))) AND ((date_month IS NULL) OR (date_day IS NULL) OR (date_day <=
CASE
    WHEN (date_month = ANY (ARRAY[4, 6, 9, 11])) THEN 30
    WHEN (date_month = 2) THEN
    CASE
        WHEN ((date_year IS NULL) OR (mod(date_year, 400) = 0) OR ((mod(date_year, 4) = 0) AND (mod(date_year, 100) <> 0))) THEN 29
        ELSE 28
    END
    ELSE 31
END))),
  CONSTRAINT "reference_event_end_check" CHECK (((end_month IS NULL) OR ((end_month >= 1) AND (end_month <= 12))) AND ((end_day IS NULL) OR ((end_day >= 1) AND (end_day <= 31))) AND ((end_month IS NULL) OR (end_day IS NULL) OR (end_day <=
CASE
    WHEN (end_month = ANY (ARRAY[4, 6, 9, 11])) THEN 30
    WHEN (end_month = 2) THEN
    CASE
        WHEN ((end_year IS NULL) OR (mod(end_year, 400) = 0) OR ((mod(end_year, 4) = 0) AND (mod(end_year, 100) <> 0))) THEN 29
        ELSE 28
    END
    ELSE 31
END))),
  CONSTRAINT "reference_event_shape_check" CHECK (identity_shape = 'event'::text)
);
-- Create index "reference_event_place_idx" to table: "reference_event"
CREATE INDEX "reference_event_place_idx" ON "reference_event" ("place_id", "id");
-- Create index "reference_event_type_idx" to table: "reference_event"
CREATE INDEX "reference_event_type_idx" ON "reference_event" ("type_revision_id", "id");
-- Create "reference_instrument" table
CREATE TABLE "reference_instrument" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL DEFAULT 'instrument',
  "type_revision_id" uuid NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "reference_instrument_JAaR47E942HS_fkey" FOREIGN KEY ("type_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_instrument_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "reference_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_instrument_shape_check" CHECK (identity_shape = 'instrument'::text)
);
-- Create index "reference_instrument_type_idx" to table: "reference_instrument"
CREATE INDEX "reference_instrument_type_idx" ON "reference_instrument" ("type_revision_id", "id");
-- Modify "software_identity" table
ALTER TABLE "software_identity" ADD CONSTRAINT "software_identity_shape_key" UNIQUE ("id", "shape");
-- Create "software_content" table
CREATE TABLE "software_content" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL DEFAULT 'content',
  PRIMARY KEY ("id"),
  CONSTRAINT "software_content_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "software_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_content_shape_check" CHECK (identity_shape = 'content'::text)
);
-- Create "software_edition" table
CREATE TABLE "software_edition" (
  "content_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "source_namespace" text NULL,
  "source_local_id" text NULL,
  "name" text NULL,
  PRIMARY KEY ("content_id", "id"),
  CONSTRAINT "software_edition_content_id_software_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "software_content" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_edition_source_local_check" CHECK (((source_namespace IS NULL) AND (source_local_id IS NULL)) OR ((source_namespace IS NOT NULL) AND (source_local_id IS NOT NULL) AND ((octet_length(source_namespace) >= 1) AND (octet_length(source_namespace) <= 96)) AND ((octet_length(source_local_id) >= 1) AND (octet_length(source_local_id) <= 128))))
);
-- Create index "software_edition_source_local_key" to table: "software_edition"
CREATE UNIQUE INDEX "software_edition_source_local_key" ON "software_edition" ("content_id", "source_namespace", "source_local_id") WHERE ((source_namespace IS NOT NULL) AND (source_local_id IS NOT NULL));
-- Create "software_release" table
CREATE TABLE "software_release" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL DEFAULT 'release',
  "type_revision_id" uuid NULL,
  "is_patch" boolean NULL,
  "freeware" boolean NULL,
  "uncensored" boolean NULL,
  "has_erotic_content" boolean NULL,
  "minimum_age" integer NULL,
  "date_year" integer NULL,
  "date_month" smallint NULL,
  "date_day" smallint NULL,
  "date_text" text NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "software_release_8rb5yayysw68_fkey" FOREIGN KEY ("type_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_release_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "software_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_release_age_check" CHECK ((minimum_age IS NULL) OR ((minimum_age >= 0) AND (minimum_age <= 255))),
  CONSTRAINT "software_release_date_check" CHECK (((date_month IS NULL) OR ((date_month >= 1) AND (date_month <= 12))) AND ((date_day IS NULL) OR ((date_day >= 1) AND (date_day <= 31))) AND ((date_month IS NULL) OR (date_day IS NULL) OR (date_day <=
CASE
    WHEN (date_month = ANY (ARRAY[4, 6, 9, 11])) THEN 30
    WHEN (date_month = 2) THEN
    CASE
        WHEN ((date_year IS NULL) OR (mod(date_year, 400) = 0) OR ((mod(date_year, 4) = 0) AND (mod(date_year, 100) <> 0))) THEN 29
        ELSE 28
    END
    ELSE 31
END))),
  CONSTRAINT "software_release_shape_check" CHECK (identity_shape = 'release'::text)
);
-- Create index "software_release_type_idx" to table: "software_release"
CREATE INDEX "software_release_type_idx" ON "software_release" ("type_revision_id", "id");
-- Create "software_release_content" table
CREATE TABLE "software_release_content" (
  "release_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "content_id" uuid NOT NULL,
  "edition_id" uuid NULL,
  "release_type_revision_id" uuid NULL,
  PRIMARY KEY ("release_id", "id"),
  CONSTRAINT "software_release_content_2l5JDrrTg1d4_fkey" FOREIGN KEY ("release_type_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_release_content_content_id_software_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "software_content" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_release_content_edition_fk" FOREIGN KEY ("content_id", "edition_id") REFERENCES "software_edition" ("content_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_release_content_release_id_software_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "software_release" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "software_release_content_reverse_idx" to table: "software_release_content"
CREATE INDEX "software_release_content_reverse_idx" ON "software_release_content" ("content_id", "edition_id", "release_id", "id");
-- Create index "software_release_content_type_idx" to table: "software_release_content"
CREATE INDEX "software_release_content_type_idx" ON "software_release_content" ("release_type_revision_id", "release_id", "id");
-- Create "software_release_language" table
CREATE TABLE "software_release_language" (
  "release_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "language_tag" text NOT NULL,
  "channel_revision_id" uuid NULL,
  "machine_translated" boolean NULL,
  "main" boolean NULL,
  PRIMARY KEY ("release_id", "id"),
  CONSTRAINT "software_release_language_pkMPhdd0Vice_fkey" FOREIGN KEY ("channel_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_release_language_release_id_software_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "software_release" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_release_language_tag_check" CHECK ((octet_length(language_tag) >= 1) AND (octet_length(language_tag) <= 255))
);
-- Create index "software_release_language_channel_idx" to table: "software_release_language"
CREATE INDEX "software_release_language_channel_idx" ON "software_release_language" ("channel_revision_id", "release_id", "id");
-- Create index "software_release_language_idx" to table: "software_release_language"
CREATE INDEX "software_release_language_idx" ON "software_release_language" ("language_tag", "release_id", "id");
-- Create "software_release_medium" table
CREATE TABLE "software_release_medium" (
  "release_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "medium_type_revision_id" uuid NOT NULL,
  "quantity" bigint NULL,
  PRIMARY KEY ("release_id", "id"),
  CONSTRAINT "software_release_medium_56OlTN91xaja_fkey" FOREIGN KEY ("medium_type_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_release_medium_release_id_software_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "software_release" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_release_medium_quantity_check" CHECK ((quantity IS NULL) OR ((quantity >= 0) AND (quantity <= '9007199254740991'::bigint)))
);
-- Create index "software_release_medium_type_idx" to table: "software_release_medium"
CREATE INDEX "software_release_medium_type_idx" ON "software_release_medium" ("medium_type_revision_id", "release_id", "id");
-- Create "software_release_platform" table
CREATE TABLE "software_release_platform" (
  "release_id" uuid NOT NULL,
  "platform_revision_id" uuid NOT NULL,
  PRIMARY KEY ("release_id", "platform_revision_id"),
  CONSTRAINT "software_release_platform_release_id_software_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "software_release" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_release_platform_vqUJo6bZ8y4j_fkey" FOREIGN KEY ("platform_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "software_release_platform_reverse_idx" to table: "software_release_platform"
CREATE INDEX "software_release_platform_reverse_idx" ON "software_release_platform" ("platform_revision_id", "release_id");
-- Create "software_visual_novel" table
CREATE TABLE "software_visual_novel" (
  "id" uuid NOT NULL,
  "length_type_revision_id" uuid NULL,
  "length_minutes" bigint NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "software_visual_novel_JuU78cxFMWBB_fkey" FOREIGN KEY ("length_type_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_visual_novel_id_software_content_id_fkey" FOREIGN KEY ("id") REFERENCES "software_content" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_vn_length_check" CHECK ((length_minutes IS NULL) OR ((length_minutes >= 0) AND (length_minutes <= '9007199254740991'::bigint)))
);
-- Create index "software_vn_length_type_idx" to table: "software_visual_novel"
CREATE INDEX "software_vn_length_type_idx" ON "software_visual_novel" ("length_type_revision_id", "id");

CREATE OR REPLACE FUNCTION public.catalog_publish_identity_route()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE affected integer; legacy_exists boolean; routing_ready boolean;
BEGIN
  SELECT ready INTO routing_ready FROM public.catalog_routing_control WHERE singleton FOR SHARE;
  IF routing_ready IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Catalog identity routing is fenced for repair'
      USING ERRCODE = '55000';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('catalog-identity:' || NEW.id::text, 0));
  IF TG_OP = 'UPDATE' AND (NEW.id <> OLD.id OR NEW.routing_generation < OLD.routing_generation) THEN
    RAISE EXCEPTION 'Catalog identity or routing generation cannot move backwards'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_identity_immutable_id';
  END IF;
  -- Transitional collision fence. P11 removes it with the legacy INSERT guard.
  IF TG_OP = 'INSERT' AND to_regclass('public.unit') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.unit WHERE id = $1)' INTO legacy_exists USING NEW.id;
    IF legacy_exists THEN
      RAISE EXCEPTION 'Catalog ID is still owned by the legacy identity store'
        USING ERRCODE = '23505', CONSTRAINT = 'catalog_identity_owner_conflict';
    END IF;
  END IF;
  INSERT INTO public.catalog_unit_locator(id, owner, generation)
    VALUES (NEW.id, TG_ARGV[0], NEW.routing_generation)
    ON CONFLICT (id) DO UPDATE SET generation = EXCLUDED.generation
      WHERE catalog_unit_locator.owner = EXCLUDED.owner
        AND catalog_unit_locator.generation <= EXCLUDED.generation;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'Catalog ID already belongs to another owner or routing generation'
      USING ERRCODE = '23505', CONSTRAINT = 'catalog_identity_owner_conflict';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_legacy_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('catalog-identity:' || NEW.id::text, 0));
  IF EXISTS(SELECT 1 FROM public.catalog_unit_locator WHERE id = NEW.id) THEN
    RAISE EXCEPTION 'Legacy insert conflicts with a native catalog identity'
      USING ERRCODE = '23505', CONSTRAINT = 'catalog_identity_owner_conflict';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_remove_identity_route()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  DELETE FROM public.catalog_unit_locator
    WHERE id = OLD.id AND owner = TG_ARGV[0] AND generation = OLD.routing_generation;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_require_definition_kind()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE actual_kind text; definition_revision uuid;
BEGIN
  definition_revision := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
  IF definition_revision IS NULL AND coalesce(TG_ARGV[2], '') = 'optional' THEN
    RETURN NEW;
  END IF;
  SELECT d.kind INTO actual_kind
    FROM public.catalog_definition_revision AS r
    JOIN public.catalog_definition AS d ON d.id = r.definition_id
    WHERE r.id = definition_revision;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catalog definition revision does not exist'
      USING ERRCODE = '23503', CONSTRAINT = 'catalog_definition_revision_exists';
  END IF;
  IF actual_kind <> TG_ARGV[1] THEN
    RAISE EXCEPTION 'Catalog definition kind does not match its use'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_definition_kind_matches_use';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_definition_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE actual_kind text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Catalog definition meanings are immutable; append a new revision'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_definition_revision_immutable';
  END IF;
  SELECT kind INTO actual_kind FROM public.catalog_definition WHERE id = NEW.definition_id;
  IF (actual_kind = 'property') <> (NEW.value_kind IS NOT NULL) THEN
    RAISE EXCEPTION 'Only a property definition has a scalar or structured value kind'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_definition_revision_value_kind';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_definition_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'Catalog definition identity is immutable'
    USING ERRCODE = '23514', CONSTRAINT = 'catalog_definition_identity_immutable';
END;
$$;

DROP TRIGGER IF EXISTS catalog_definition_identity_guard ON public.catalog_definition;
CREATE TRIGGER catalog_definition_identity_guard
BEFORE UPDATE OR DELETE ON public.catalog_definition
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_definition_identity();

DROP TRIGGER IF EXISTS catalog_definition_revision_guard ON public.catalog_definition_revision;
CREATE TRIGGER catalog_definition_revision_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.catalog_definition_revision
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_definition_revision();

DROP TRIGGER IF EXISTS grouping_class_definition_guard ON public.grouping_class_assignment;
CREATE TRIGGER grouping_class_definition_guard
BEFORE INSERT OR UPDATE ON public.grouping_class_assignment
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('class_revision_id', 'class');

DROP TRIGGER IF EXISTS catalog_legacy_identity_guard ON public.unit;
CREATE TRIGGER catalog_legacy_identity_guard
BEFORE INSERT ON public.unit
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_legacy_identity();

DROP TRIGGER IF EXISTS publishing_identity_route_publish ON public.publishing_identity;
CREATE TRIGGER publishing_identity_route_publish
AFTER INSERT OR UPDATE OF id, routing_generation ON public.publishing_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_publish_identity_route('publishing');

DROP TRIGGER IF EXISTS publishing_identity_route_remove ON public.publishing_identity;
CREATE TRIGGER publishing_identity_route_remove
AFTER DELETE ON public.publishing_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_remove_identity_route('publishing');

DROP TRIGGER IF EXISTS publishing_fact_definition_guard ON public.publishing_fact;
CREATE TRIGGER publishing_fact_definition_guard
BEFORE INSERT OR UPDATE ON public.publishing_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS publishing_catalog_relation_definition_guard ON public.publishing_catalog_relation;
CREATE TRIGGER publishing_catalog_relation_definition_guard
BEFORE INSERT OR UPDATE ON public.publishing_catalog_relation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'predicate');

DROP TRIGGER IF EXISTS publishing_relation_participant_definition_guard ON public.publishing_relation_participant;
CREATE TRIGGER publishing_relation_participant_definition_guard
BEFORE INSERT OR UPDATE ON public.publishing_relation_participant
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('role_revision_id', 'role');

DROP TRIGGER IF EXISTS publishing_relation_scope_definition_guard ON public.publishing_relation_scope;
CREATE TRIGGER publishing_relation_scope_definition_guard
BEFORE INSERT OR UPDATE ON public.publishing_relation_scope
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS music_identity_route_publish ON public.music_identity;
CREATE TRIGGER music_identity_route_publish
AFTER INSERT OR UPDATE OF id, routing_generation ON public.music_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_publish_identity_route('music');

DROP TRIGGER IF EXISTS music_identity_route_remove ON public.music_identity;
CREATE TRIGGER music_identity_route_remove
AFTER DELETE ON public.music_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_remove_identity_route('music');

DROP TRIGGER IF EXISTS music_fact_definition_guard ON public.music_fact;
CREATE TRIGGER music_fact_definition_guard
BEFORE INSERT OR UPDATE ON public.music_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS music_catalog_relation_definition_guard ON public.music_catalog_relation;
CREATE TRIGGER music_catalog_relation_definition_guard
BEFORE INSERT OR UPDATE ON public.music_catalog_relation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'predicate');

DROP TRIGGER IF EXISTS music_relation_participant_definition_guard ON public.music_relation_participant;
CREATE TRIGGER music_relation_participant_definition_guard
BEFORE INSERT OR UPDATE ON public.music_relation_participant
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('role_revision_id', 'role');

DROP TRIGGER IF EXISTS music_relation_scope_definition_guard ON public.music_relation_scope;
CREATE TRIGGER music_relation_scope_definition_guard
BEFORE INSERT OR UPDATE ON public.music_relation_scope
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS program_identity_route_publish ON public.program_identity;
CREATE TRIGGER program_identity_route_publish
AFTER INSERT OR UPDATE OF id, routing_generation ON public.program_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_publish_identity_route('program');

DROP TRIGGER IF EXISTS program_identity_route_remove ON public.program_identity;
CREATE TRIGGER program_identity_route_remove
AFTER DELETE ON public.program_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_remove_identity_route('program');

DROP TRIGGER IF EXISTS program_fact_definition_guard ON public.program_fact;
CREATE TRIGGER program_fact_definition_guard
BEFORE INSERT OR UPDATE ON public.program_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS program_catalog_relation_definition_guard ON public.program_catalog_relation;
CREATE TRIGGER program_catalog_relation_definition_guard
BEFORE INSERT OR UPDATE ON public.program_catalog_relation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'predicate');

DROP TRIGGER IF EXISTS program_relation_participant_definition_guard ON public.program_relation_participant;
CREATE TRIGGER program_relation_participant_definition_guard
BEFORE INSERT OR UPDATE ON public.program_relation_participant
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('role_revision_id', 'role');

DROP TRIGGER IF EXISTS program_relation_scope_definition_guard ON public.program_relation_scope;
CREATE TRIGGER program_relation_scope_definition_guard
BEFORE INSERT OR UPDATE ON public.program_relation_scope
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS software_identity_route_publish ON public.software_identity;
CREATE TRIGGER software_identity_route_publish
AFTER INSERT OR UPDATE OF id, routing_generation ON public.software_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_publish_identity_route('software');

DROP TRIGGER IF EXISTS software_identity_route_remove ON public.software_identity;
CREATE TRIGGER software_identity_route_remove
AFTER DELETE ON public.software_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_remove_identity_route('software');

DROP TRIGGER IF EXISTS software_fact_definition_guard ON public.software_fact;
CREATE TRIGGER software_fact_definition_guard
BEFORE INSERT OR UPDATE ON public.software_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS software_catalog_relation_definition_guard ON public.software_catalog_relation;
CREATE TRIGGER software_catalog_relation_definition_guard
BEFORE INSERT OR UPDATE ON public.software_catalog_relation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'predicate');

DROP TRIGGER IF EXISTS software_relation_participant_definition_guard ON public.software_relation_participant;
CREATE TRIGGER software_relation_participant_definition_guard
BEFORE INSERT OR UPDATE ON public.software_relation_participant
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('role_revision_id', 'role');

DROP TRIGGER IF EXISTS software_relation_scope_definition_guard ON public.software_relation_scope;
CREATE TRIGGER software_relation_scope_definition_guard
BEFORE INSERT OR UPDATE ON public.software_relation_scope
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS entity_identity_route_publish ON public.entity_identity;
CREATE TRIGGER entity_identity_route_publish
AFTER INSERT OR UPDATE OF id, routing_generation ON public.entity_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_publish_identity_route('entity');

DROP TRIGGER IF EXISTS entity_identity_route_remove ON public.entity_identity;
CREATE TRIGGER entity_identity_route_remove
AFTER DELETE ON public.entity_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_remove_identity_route('entity');

DROP TRIGGER IF EXISTS entity_fact_definition_guard ON public.entity_fact;
CREATE TRIGGER entity_fact_definition_guard
BEFORE INSERT OR UPDATE ON public.entity_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS entity_catalog_relation_definition_guard ON public.entity_catalog_relation;
CREATE TRIGGER entity_catalog_relation_definition_guard
BEFORE INSERT OR UPDATE ON public.entity_catalog_relation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'predicate');

DROP TRIGGER IF EXISTS entity_relation_participant_definition_guard ON public.entity_relation_participant;
CREATE TRIGGER entity_relation_participant_definition_guard
BEFORE INSERT OR UPDATE ON public.entity_relation_participant
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('role_revision_id', 'role');

DROP TRIGGER IF EXISTS entity_relation_scope_definition_guard ON public.entity_relation_scope;
CREATE TRIGGER entity_relation_scope_definition_guard
BEFORE INSERT OR UPDATE ON public.entity_relation_scope
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS grouping_identity_route_publish ON public.grouping_identity;
CREATE TRIGGER grouping_identity_route_publish
AFTER INSERT OR UPDATE OF id, routing_generation ON public.grouping_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_publish_identity_route('grouping');

DROP TRIGGER IF EXISTS grouping_identity_route_remove ON public.grouping_identity;
CREATE TRIGGER grouping_identity_route_remove
AFTER DELETE ON public.grouping_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_remove_identity_route('grouping');

DROP TRIGGER IF EXISTS grouping_fact_definition_guard ON public.grouping_fact;
CREATE TRIGGER grouping_fact_definition_guard
BEFORE INSERT OR UPDATE ON public.grouping_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS grouping_catalog_relation_definition_guard ON public.grouping_catalog_relation;
CREATE TRIGGER grouping_catalog_relation_definition_guard
BEFORE INSERT OR UPDATE ON public.grouping_catalog_relation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'predicate');

DROP TRIGGER IF EXISTS grouping_relation_participant_definition_guard ON public.grouping_relation_participant;
CREATE TRIGGER grouping_relation_participant_definition_guard
BEFORE INSERT OR UPDATE ON public.grouping_relation_participant
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('role_revision_id', 'role');

DROP TRIGGER IF EXISTS grouping_relation_scope_definition_guard ON public.grouping_relation_scope;
CREATE TRIGGER grouping_relation_scope_definition_guard
BEFORE INSERT OR UPDATE ON public.grouping_relation_scope
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS reference_identity_route_publish ON public.reference_identity;
CREATE TRIGGER reference_identity_route_publish
AFTER INSERT OR UPDATE OF id, routing_generation ON public.reference_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_publish_identity_route('reference');

DROP TRIGGER IF EXISTS reference_identity_route_remove ON public.reference_identity;
CREATE TRIGGER reference_identity_route_remove
AFTER DELETE ON public.reference_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_remove_identity_route('reference');

DROP TRIGGER IF EXISTS reference_fact_definition_guard ON public.reference_fact;
CREATE TRIGGER reference_fact_definition_guard
BEFORE INSERT OR UPDATE ON public.reference_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS reference_catalog_relation_definition_guard ON public.reference_catalog_relation;
CREATE TRIGGER reference_catalog_relation_definition_guard
BEFORE INSERT OR UPDATE ON public.reference_catalog_relation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'predicate');

DROP TRIGGER IF EXISTS reference_relation_participant_definition_guard ON public.reference_relation_participant;
CREATE TRIGGER reference_relation_participant_definition_guard
BEFORE INSERT OR UPDATE ON public.reference_relation_participant
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('role_revision_id', 'role');

DROP TRIGGER IF EXISTS reference_relation_scope_definition_guard ON public.reference_relation_scope;
CREATE TRIGGER reference_relation_scope_definition_guard
BEFORE INSERT OR UPDATE ON public.reference_relation_scope
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

CREATE OR REPLACE FUNCTION public.catalog_guard_fact_value()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE target_owner uuid; target_fact uuid; fact_state text; sealed_time timestamptz;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Fact value nodes are append-only'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_fact_value_immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN target_owner := OLD.owner_id; target_fact := OLD.fact_id;
  ELSE target_owner := NEW.owner_id; target_fact := NEW.fact_id; END IF;
  CASE TG_ARGV[0]
    WHEN 'publishing' THEN SELECT state, sealed_at INTO fact_state, sealed_time FROM public.publishing_fact WHERE owner_id = target_owner AND id = target_fact FOR SHARE;
    WHEN 'music' THEN SELECT state, sealed_at INTO fact_state, sealed_time FROM public.music_fact WHERE owner_id = target_owner AND id = target_fact FOR SHARE;
    WHEN 'program' THEN SELECT state, sealed_at INTO fact_state, sealed_time FROM public.program_fact WHERE owner_id = target_owner AND id = target_fact FOR SHARE;
    WHEN 'software' THEN SELECT state, sealed_at INTO fact_state, sealed_time FROM public.software_fact WHERE owner_id = target_owner AND id = target_fact FOR SHARE;
    WHEN 'entity' THEN SELECT state, sealed_at INTO fact_state, sealed_time FROM public.entity_fact WHERE owner_id = target_owner AND id = target_fact FOR SHARE;
    WHEN 'grouping' THEN SELECT state, sealed_at INTO fact_state, sealed_time FROM public.grouping_fact WHERE owner_id = target_owner AND id = target_fact FOR SHARE;
    WHEN 'reference' THEN SELECT state, sealed_at INTO fact_state, sealed_time FROM public.reference_fact WHERE owner_id = target_owner AND id = target_fact FOR SHARE;
    ELSE RAISE EXCEPTION 'Unregistered catalog owner';
  END CASE;
  IF fact_state IS NULL THEN
    RAISE EXCEPTION 'Fact value owner does not exist' USING ERRCODE = '23503';
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF fact_state <> 'withdrawn' THEN
      RAISE EXCEPTION 'Withdraw a fact before erasing its value'
        USING ERRCODE = '23514', CONSTRAINT = 'catalog_fact_value_immutable';
    END IF;
    RETURN OLD;
  END IF;
  IF sealed_time IS NOT NULL OR fact_state <> 'active' THEN
    RAISE EXCEPTION 'Fact is sealed or no longer accepts value nodes'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_fact_value_immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_fact_header()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE root_kind text; expected_kind text; last_position bigint;
BEGIN
  IF NEW.id <> OLD.id OR NEW.owner_id <> OLD.owner_id OR NEW.definition_revision_id <> OLD.definition_revision_id THEN
    RAISE EXCEPTION 'Fact identity and definition revision are immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_fact_identity_immutable';
  END IF;
  IF OLD.sealed_at IS NOT NULL THEN
    IF NEW.sealed_at IS DISTINCT FROM OLD.sealed_at OR NEW.last_node_position <> OLD.last_node_position THEN
      RAISE EXCEPTION 'Sealed fact value cannot be reopened'
        USING ERRCODE = '23514', CONSTRAINT = 'catalog_fact_value_immutable';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.sealed_at IS NULL THEN RETURN NEW; END IF;
  IF NEW.state <> 'active' THEN
    RAISE EXCEPTION 'Only an active draft fact can be sealed' USING ERRCODE = '23514';
  END IF;
  CASE TG_ARGV[0]
    WHEN 'publishing' THEN
      SELECT kind INTO root_kind FROM public.publishing_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id AND position = 0;
      SELECT position INTO last_position FROM public.publishing_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id ORDER BY position DESC LIMIT 1;
    WHEN 'music' THEN
      SELECT kind INTO root_kind FROM public.music_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id AND position = 0;
      SELECT position INTO last_position FROM public.music_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id ORDER BY position DESC LIMIT 1;
    WHEN 'program' THEN
      SELECT kind INTO root_kind FROM public.program_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id AND position = 0;
      SELECT position INTO last_position FROM public.program_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id ORDER BY position DESC LIMIT 1;
    WHEN 'software' THEN
      SELECT kind INTO root_kind FROM public.software_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id AND position = 0;
      SELECT position INTO last_position FROM public.software_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id ORDER BY position DESC LIMIT 1;
    WHEN 'entity' THEN
      SELECT kind INTO root_kind FROM public.entity_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id AND position = 0;
      SELECT position INTO last_position FROM public.entity_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id ORDER BY position DESC LIMIT 1;
    WHEN 'grouping' THEN
      SELECT kind INTO root_kind FROM public.grouping_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id AND position = 0;
      SELECT position INTO last_position FROM public.grouping_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id ORDER BY position DESC LIMIT 1;
    WHEN 'reference' THEN
      SELECT kind INTO root_kind FROM public.reference_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id AND position = 0;
      SELECT position INTO last_position FROM public.reference_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id ORDER BY position DESC LIMIT 1;
    ELSE RAISE EXCEPTION 'Unregistered catalog owner';
  END CASE;
  SELECT value_kind INTO expected_kind FROM public.catalog_definition_revision WHERE id = NEW.definition_revision_id;
  IF root_kind IS NULL OR last_position IS DISTINCT FROM NEW.last_node_position
      OR (root_kind <> 'null' AND root_kind <> expected_kind) THEN
    RAISE EXCEPTION 'Fact prefix or root type does not match the declared value'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_fact_seal_integrity';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_source_snapshot()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'Source snapshot evidence is immutable'
    USING ERRCODE = '23514', CONSTRAINT = 'catalog_source_snapshot_immutable';
END;
$$;

DROP TRIGGER IF EXISTS publishing_fact_value_node_value_guard ON public.publishing_fact_value_node;
CREATE TRIGGER publishing_fact_value_node_value_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.publishing_fact_value_node
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_value('publishing');

DROP TRIGGER IF EXISTS publishing_fact_value_guard ON public.publishing_fact;
CREATE TRIGGER publishing_fact_value_guard
BEFORE UPDATE ON public.publishing_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_header('publishing');

DROP TRIGGER IF EXISTS music_fact_value_node_value_guard ON public.music_fact_value_node;
CREATE TRIGGER music_fact_value_node_value_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.music_fact_value_node
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_value('music');

DROP TRIGGER IF EXISTS music_fact_value_guard ON public.music_fact;
CREATE TRIGGER music_fact_value_guard
BEFORE UPDATE ON public.music_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_header('music');

DROP TRIGGER IF EXISTS program_fact_value_node_value_guard ON public.program_fact_value_node;
CREATE TRIGGER program_fact_value_node_value_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.program_fact_value_node
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_value('program');

DROP TRIGGER IF EXISTS program_fact_value_guard ON public.program_fact;
CREATE TRIGGER program_fact_value_guard
BEFORE UPDATE ON public.program_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_header('program');

DROP TRIGGER IF EXISTS software_fact_value_node_value_guard ON public.software_fact_value_node;
CREATE TRIGGER software_fact_value_node_value_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.software_fact_value_node
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_value('software');

DROP TRIGGER IF EXISTS software_fact_value_guard ON public.software_fact;
CREATE TRIGGER software_fact_value_guard
BEFORE UPDATE ON public.software_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_header('software');

DROP TRIGGER IF EXISTS entity_fact_value_node_value_guard ON public.entity_fact_value_node;
CREATE TRIGGER entity_fact_value_node_value_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.entity_fact_value_node
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_value('entity');

DROP TRIGGER IF EXISTS entity_fact_value_guard ON public.entity_fact;
CREATE TRIGGER entity_fact_value_guard
BEFORE UPDATE ON public.entity_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_header('entity');

DROP TRIGGER IF EXISTS grouping_fact_value_node_value_guard ON public.grouping_fact_value_node;
CREATE TRIGGER grouping_fact_value_node_value_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.grouping_fact_value_node
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_value('grouping');

DROP TRIGGER IF EXISTS grouping_fact_value_guard ON public.grouping_fact;
CREATE TRIGGER grouping_fact_value_guard
BEFORE UPDATE ON public.grouping_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_header('grouping');

DROP TRIGGER IF EXISTS reference_fact_value_node_value_guard ON public.reference_fact_value_node;
CREATE TRIGGER reference_fact_value_node_value_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.reference_fact_value_node
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_value('reference');

DROP TRIGGER IF EXISTS reference_fact_value_guard ON public.reference_fact;
CREATE TRIGGER reference_fact_value_guard
BEFORE UPDATE ON public.reference_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_header('reference');

DROP TRIGGER IF EXISTS catalog_source_snapshot_immutable ON public.catalog_source_snapshot;
CREATE TRIGGER catalog_source_snapshot_immutable
BEFORE UPDATE ON public.catalog_source_snapshot
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_source_snapshot();


CREATE OR REPLACE FUNCTION public.catalog_guard_installment_parent()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE cyclic boolean; beyond_budget boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.id <> OLD.id OR NEW.serialization_id <> OLD.serialization_id) THEN
    RAISE EXCEPTION 'Installment identity and owner are immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'publishing_installment_identity_immutable';
  END IF;
  PERFORM 1 FROM public.publishing_serialization WHERE id = NEW.serialization_id FOR UPDATE;
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  WITH RECURSIVE ancestors AS (
    SELECT id, parent_id, 1 AS depth FROM public.publishing_installment
      WHERE serialization_id = NEW.serialization_id AND id = NEW.parent_id
    UNION ALL
    SELECT parent.id, parent.parent_id, ancestors.depth + 1
      FROM public.publishing_installment AS parent
      JOIN ancestors ON parent.id = ancestors.parent_id
      WHERE parent.serialization_id = NEW.serialization_id AND ancestors.depth < 256
  ) SELECT coalesce(bool_or(id = NEW.id), false),
           coalesce(bool_or(depth = 256), false)
      INTO cyclic, beyond_budget FROM ancestors;
  IF cyclic OR beyond_budget THEN
    RAISE EXCEPTION 'Installment parent creates a cycle or exceeds the 256-level grammar'
      USING ERRCODE = '23514', CONSTRAINT = 'publishing_installment_acyclic';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS publishing_installment_parent_guard ON public.publishing_installment;
CREATE TRIGGER publishing_installment_parent_guard
BEFORE INSERT OR UPDATE OF id, serialization_id, parent_id ON public.publishing_installment
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_installment_parent();

DROP TRIGGER IF EXISTS reference_area_type_vocab_guard ON public.reference_area;
CREATE TRIGGER reference_area_type_vocab_guard
BEFORE INSERT OR UPDATE OF type_revision_id ON public.reference_area
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS reference_place_type_vocab_guard ON public.reference_place;
CREATE TRIGGER reference_place_type_vocab_guard
BEFORE INSERT OR UPDATE OF type_revision_id ON public.reference_place
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS reference_instrument_type_vocab_guard ON public.reference_instrument;
CREATE TRIGGER reference_instrument_type_vocab_guard
BEFORE INSERT OR UPDATE OF type_revision_id ON public.reference_instrument
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS reference_event_type_vocab_guard ON public.reference_event;
CREATE TRIGGER reference_event_type_vocab_guard
BEFORE INSERT OR UPDATE OF type_revision_id ON public.reference_event
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS entity_catalog_profile_type_vocab_guard ON public.entity_catalog_profile;
CREATE TRIGGER entity_catalog_profile_type_vocab_guard
BEFORE INSERT OR UPDATE OF type_revision_id ON public.entity_catalog_profile
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS entity_catalog_profile_gender_vocab_guard ON public.entity_catalog_profile;
CREATE TRIGGER entity_catalog_profile_gender_vocab_guard
BEFORE INSERT OR UPDATE OF gender_revision_id ON public.entity_catalog_profile
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('gender_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS publishing_text_version_method_vocab_guard ON public.publishing_text_version;
CREATE TRIGGER publishing_text_version_method_vocab_guard
BEFORE INSERT OR UPDATE OF method_revision_id ON public.publishing_text_version
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('method_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS publishing_publication_facet_definition_vocab_guard ON public.publishing_publication_facet;
CREATE TRIGGER publishing_publication_facet_definition_vocab_guard
BEFORE INSERT OR UPDATE OF definition_revision_id ON public.publishing_publication_facet
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS publishing_serialization_status_vocab_guard ON public.publishing_serialization;
CREATE TRIGGER publishing_serialization_status_vocab_guard
BEFORE INSERT OR UPDATE OF status_revision_id ON public.publishing_serialization
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('status_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS publishing_installment_kind_vocab_guard ON public.publishing_installment;
CREATE TRIGGER publishing_installment_kind_vocab_guard
BEFORE INSERT OR UPDATE OF kind_revision_id ON public.publishing_installment
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('kind_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS music_work_type_vocab_guard ON public.music_work;
CREATE TRIGGER music_work_type_vocab_guard
BEFORE INSERT OR UPDATE OF type_revision_id ON public.music_work
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS music_release_group_primary_type_vocab_guard ON public.music_release_group;
CREATE TRIGGER music_release_group_primary_type_vocab_guard
BEFORE INSERT OR UPDATE OF primary_type_revision_id ON public.music_release_group
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('primary_type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS music_release_group_secondary_type_type_vocab_guard ON public.music_release_group_secondary_type;
CREATE TRIGGER music_release_group_secondary_type_type_vocab_guard
BEFORE INSERT OR UPDATE OF type_revision_id ON public.music_release_group_secondary_type
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS music_release_status_vocab_guard ON public.music_release;
CREATE TRIGGER music_release_status_vocab_guard
BEFORE INSERT OR UPDATE OF status_revision_id ON public.music_release
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('status_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS music_release_packaging_vocab_guard ON public.music_release;
CREATE TRIGGER music_release_packaging_vocab_guard
BEFORE INSERT OR UPDATE OF packaging_revision_id ON public.music_release
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('packaging_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS music_medium_format_vocab_guard ON public.music_medium;
CREATE TRIGGER music_medium_format_vocab_guard
BEFORE INSERT OR UPDATE OF format_revision_id ON public.music_medium
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('format_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS music_release_presentation_type_vocab_guard ON public.music_release_presentation;
CREATE TRIGGER music_release_presentation_type_vocab_guard
BEFORE INSERT OR UPDATE OF type_revision_id ON public.music_release_presentation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS program_work_type_vocab_guard ON public.program_work;
CREATE TRIGGER program_work_type_vocab_guard
BEFORE INSERT OR UPDATE OF type_revision_id ON public.program_work
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS program_version_version_type_vocab_guard ON public.program_version;
CREATE TRIGGER program_version_version_type_vocab_guard
BEFORE INSERT OR UPDATE OF version_type_revision_id ON public.program_version
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('version_type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS program_episode_type_vocab_guard ON public.program_episode;
CREATE TRIGGER program_episode_type_vocab_guard
BEFORE INSERT OR UPDATE OF type_revision_id ON public.program_episode
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS software_visual_novel_length_type_vocab_guard ON public.software_visual_novel;
CREATE TRIGGER software_visual_novel_length_type_vocab_guard
BEFORE INSERT OR UPDATE OF length_type_revision_id ON public.software_visual_novel
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('length_type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS software_release_type_vocab_guard ON public.software_release;
CREATE TRIGGER software_release_type_vocab_guard
BEFORE INSERT OR UPDATE OF type_revision_id ON public.software_release
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS software_release_content_release_type_vocab_guard ON public.software_release_content;
CREATE TRIGGER software_release_content_release_type_vocab_guard
BEFORE INSERT OR UPDATE OF release_type_revision_id ON public.software_release_content
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('release_type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS software_release_platform_platform_vocab_guard ON public.software_release_platform;
CREATE TRIGGER software_release_platform_platform_vocab_guard
BEFORE INSERT OR UPDATE OF platform_revision_id ON public.software_release_platform
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('platform_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS software_release_medium_medium_type_vocab_guard ON public.software_release_medium;
CREATE TRIGGER software_release_medium_medium_type_vocab_guard
BEFORE INSERT OR UPDATE OF medium_type_revision_id ON public.software_release_medium
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('medium_type_revision_id', 'vocabulary', 'optional');

DROP TRIGGER IF EXISTS software_release_language_channel_vocab_guard ON public.software_release_language;
CREATE TRIGGER software_release_language_channel_vocab_guard
BEFORE INSERT OR UPDATE OF channel_revision_id ON public.software_release_language
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('channel_revision_id', 'vocabulary', 'optional');
