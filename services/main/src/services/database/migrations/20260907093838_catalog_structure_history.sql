SET search_path TO public;

-- Drop index "distribution_support_snapshot_idx" from table: "distribution_fact_support"
DROP INDEX "distribution_support_snapshot_idx";
-- Create index "distribution_support_snapshot_idx" to table: "distribution_fact_support"
CREATE INDEX "distribution_support_snapshot_idx" ON "distribution_fact_support" ("source_record_id", "snapshot_id", "owner_id", "id");
-- Drop index "entity_support_snapshot_idx" from table: "entity_fact_support"
DROP INDEX "entity_support_snapshot_idx";
-- Create index "entity_support_snapshot_idx" to table: "entity_fact_support"
CREATE INDEX "entity_support_snapshot_idx" ON "entity_fact_support" ("source_record_id", "snapshot_id", "owner_id", "id");
-- Drop index "grouping_support_snapshot_idx" from table: "grouping_fact_support"
DROP INDEX "grouping_support_snapshot_idx";
-- Create index "grouping_support_snapshot_idx" to table: "grouping_fact_support"
CREATE INDEX "grouping_support_snapshot_idx" ON "grouping_fact_support" ("source_record_id", "snapshot_id", "owner_id", "id");
-- Drop index "music_support_snapshot_idx" from table: "music_fact_support"
DROP INDEX "music_support_snapshot_idx";
-- Create index "music_support_snapshot_idx" to table: "music_fact_support"
CREATE INDEX "music_support_snapshot_idx" ON "music_fact_support" ("source_record_id", "snapshot_id", "owner_id", "id");
-- Drop index "program_support_snapshot_idx" from table: "program_fact_support"
DROP INDEX "program_support_snapshot_idx";
-- Create index "program_support_snapshot_idx" to table: "program_fact_support"
CREATE INDEX "program_support_snapshot_idx" ON "program_fact_support" ("source_record_id", "snapshot_id", "owner_id", "id");
-- Drop index "publishing_support_snapshot_idx" from table: "publishing_fact_support"
DROP INDEX "publishing_support_snapshot_idx";
-- Create index "publishing_support_snapshot_idx" to table: "publishing_fact_support"
CREATE INDEX "publishing_support_snapshot_idx" ON "publishing_fact_support" ("source_record_id", "snapshot_id", "owner_id", "id");
-- Drop index "reference_support_snapshot_idx" from table: "reference_fact_support"
DROP INDEX "reference_support_snapshot_idx";
-- Create index "reference_support_snapshot_idx" to table: "reference_fact_support"
CREATE INDEX "reference_support_snapshot_idx" ON "reference_fact_support" ("source_record_id", "snapshot_id", "owner_id", "id");
-- Drop index "software_support_snapshot_idx" from table: "software_fact_support"
DROP INDEX "software_support_snapshot_idx";
-- Create index "software_support_snapshot_idx" to table: "software_fact_support"
CREATE INDEX "software_support_snapshot_idx" ON "software_fact_support" ("source_record_id", "snapshot_id", "owner_id", "id");
-- Create "program_component_revision" table
CREATE TABLE "program_component_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "component" text NOT NULL,
  "component_key" text NOT NULL,
  "owner_revision" bigint NOT NULL,
  "operation" text NOT NULL,
  "value" jsonb NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "program_component_revision_owner_id_program_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_component_revision_values" CHECK ((operation = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])) AND ((owner_revision >= 1) AND (owner_revision <= '9007199254740991'::bigint)) AND ((octet_length(component) >= 1) AND (octet_length(component) <= 96)) AND ((octet_length(component_key) >= 1) AND (octet_length(component_key) <= 512)) AND (jsonb_typeof(value) = 'object'::text) AND (octet_length((value)::text) <= 1048576))
);
-- Create index "program_component_revision_lookup_idx" to table: "program_component_revision"
CREATE INDEX "program_component_revision_lookup_idx" ON "program_component_revision" ("owner_id", "component", "component_key", "id");
-- Create "program_component_source_occurrence" table
CREATE TABLE "program_component_source_occurrence" (
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "component" text NOT NULL,
  "component_key" text NOT NULL,
  "source_path" text NOT NULL,
  "history_id" uuid NOT NULL,
  PRIMARY KEY ("source_record_id", "snapshot_id", "owner_id", "component", "source_path"),
  CONSTRAINT "program_component_source_occurrence_iGmoCfHxQqAk_fkey" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_component_source_occurrence_oxAtFJxsiskk_fkey" FOREIGN KEY ("owner_id", "history_id") REFERENCES "program_component_revision" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_source_component_path" CHECK (("left"(source_path, 1) = '/'::text) AND ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)))
);
-- Create index "program_source_component_idx" to table: "program_component_source_occurrence"
CREATE INDEX "program_source_component_idx" ON "program_component_source_occurrence" ("source_record_id", "snapshot_id", "owner_id", "component", "component_key", "source_path");
-- Create "publishing_component_revision" table
CREATE TABLE "publishing_component_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "component" text NOT NULL,
  "component_key" text NOT NULL,
  "owner_revision" bigint NOT NULL,
  "operation" text NOT NULL,
  "value" jsonb NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "publishing_component_revision_v7go8pT7Mbaa_fkey" FOREIGN KEY ("owner_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_component_revision_values" CHECK ((operation = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])) AND ((owner_revision >= 1) AND (owner_revision <= '9007199254740991'::bigint)) AND ((octet_length(component) >= 1) AND (octet_length(component) <= 96)) AND ((octet_length(component_key) >= 1) AND (octet_length(component_key) <= 512)) AND (jsonb_typeof(value) = 'object'::text) AND (octet_length((value)::text) <= 1048576))
);
-- Create index "publishing_component_revision_lookup_idx" to table: "publishing_component_revision"
CREATE INDEX "publishing_component_revision_lookup_idx" ON "publishing_component_revision" ("owner_id", "component", "component_key", "id");
-- Create "publishing_component_source_occurrence" table
CREATE TABLE "publishing_component_source_occurrence" (
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "component" text NOT NULL,
  "component_key" text NOT NULL,
  "source_path" text NOT NULL,
  "history_id" uuid NOT NULL,
  PRIMARY KEY ("source_record_id", "snapshot_id", "owner_id", "component", "source_path"),
  CONSTRAINT "publishing_component_source_occurrence_FP19tZstHxnk_fkey" FOREIGN KEY ("owner_id", "history_id") REFERENCES "publishing_component_revision" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_component_source_occurrence_ZAHWjXUe0I53_fkey" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_source_component_path" CHECK (("left"(source_path, 1) = '/'::text) AND ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)))
);
-- Create index "publishing_source_component_idx" to table: "publishing_component_source_occurrence"
CREATE INDEX "publishing_source_component_idx" ON "publishing_component_source_occurrence" ("source_record_id", "snapshot_id", "owner_id", "component", "component_key", "source_path");

CREATE OR REPLACE FUNCTION public.catalog_capture_structure_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE body jsonb; native_owner uuid; native_revision bigint; component_key text := ''; ordinal integer;
BEGIN
  body := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  native_owner := (body ->> TG_ARGV[1])::uuid;
  IF TG_OP='UPDATE' THEN
    FOR ordinal IN 1..TG_NARGS-1 LOOP
      IF (to_jsonb(OLD)->TG_ARGV[ordinal]) IS DISTINCT FROM (body->TG_ARGV[ordinal]) THEN
        RAISE EXCEPTION 'Structural component identity and owner are immutable' USING ERRCODE='23514';
      END IF;
    END LOOP;
  END IF;
  EXECUTE format('SELECT revision FROM public.%I WHERE id=$1', TG_ARGV[0] || '_identity') INTO STRICT native_revision USING native_owner;
  FOR ordinal IN 2..TG_NARGS-1 LOOP
    component_key := component_key || CASE WHEN ordinal=2 THEN '' ELSE '/' END || (body->>TG_ARGV[ordinal]);
  END LOOP;
  EXECUTE format('INSERT INTO public.%I(owner_id,component,component_key,owner_revision,operation,value) VALUES($1,$2,$3,$4,$5,$6)',TG_ARGV[0] || '_component_revision') USING native_owner,TG_TABLE_NAME,component_key,native_revision,TG_OP,body;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_guard_structure_history()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'Native structural history and source evidence are immutable' USING ERRCODE='23514';
END $$;

CREATE OR REPLACE FUNCTION public.catalog_validate_structure_source()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE valid boolean;
BEGIN
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE owner_id=$1 AND id=$2 AND component=$3 AND component_key=$4 AND operation <> ''DELETE'')',TG_ARGV[0] || '_component_revision') INTO valid USING NEW.owner_id,NEW.history_id,NEW.component,NEW.component_key;
  IF NOT valid THEN RAISE EXCEPTION 'Structural source support requires the exact native component history' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE row record; owner_name text; relation_name text;
BEGIN
  FOR row IN SELECT * FROM (VALUES
    ('program','program_work','id','id'),('program','program_season','id','id'),('program','program_version','id','id'),('program','program_episode','id','id'),('program','program_episode_occurrence','owner_id','id'),
    ('publishing','publishing_work','id','id'),('publishing','publishing_text_version','id','id'),('publishing','publishing_publication','id','id'),('publishing','publishing_serialization','id','id'),
    ('publishing','publishing_text_work','text_version_id','work_id'),('publishing','publishing_publication_text','publication_id','text_version_id'),('publishing','publishing_publication_work','publication_id','work_id'),('publishing','publishing_publication_facet','publication_id','definition_revision_id'),
    ('publishing','publishing_release_event','publication_id','id'),('publishing','publishing_installment','serialization_id','id')
  ) values(owner_name,table_name,owner_column,key_column) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_capture_structure_revision ON public.%I',row.table_name);
    EXECUTE format('CREATE TRIGGER catalog_capture_structure_revision AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_capture_structure_revision(%L,%L,%L)',row.table_name,row.owner_name,row.owner_column,row.key_column);
  END LOOP;
  FOREACH owner_name IN ARRAY ARRAY['program','publishing'] LOOP
    FOREACH relation_name IN ARRAY ARRAY[owner_name || '_component_revision',owner_name || '_component_source_occurrence'] LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS catalog_structure_history_immutable ON public.%I',relation_name);
      EXECUTE format('CREATE TRIGGER catalog_structure_history_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_structure_history()',relation_name);
    END LOOP;
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_structure_source_exact ON public.%I',owner_name || '_component_source_occurrence');
    EXECUTE format('CREATE TRIGGER catalog_structure_source_exact BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_validate_structure_source(%L)',owner_name || '_component_source_occurrence',owner_name);
  END LOOP;
END $$;
