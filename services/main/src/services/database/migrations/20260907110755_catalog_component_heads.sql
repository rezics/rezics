SET search_path TO public;

-- The former intrinsic-duration field has been replaced by a source-qualified playtime estimate.
-- Drop its column-specific trigger before the generated column removal.
DROP TRIGGER IF EXISTS software_visual_novel_length_type_vocab_guard ON public.software_visual_novel;

-- Drop index "music_component_revision_lookup_idx" from table: "music_component_revision"
DROP INDEX "music_component_revision_lookup_idx";
-- Modify "music_component_revision" table
ALTER TABLE "music_component_revision" DROP CONSTRAINT "music_component_revision_value_check", ADD CONSTRAINT "music_component_revision_value_check" CHECK ((jsonb_typeof(value) = 'object'::text) AND ((octet_length(component_key) >= 1) AND (octet_length(component_key) <= 1536)) AND (owner_revision > 0) AND ((component_sequence >= 1) AND (component_sequence <= '9007199254740991'::bigint))), ADD COLUMN "component_sequence" bigint NOT NULL, ADD CONSTRAINT "music_component_revision_sequence_key" UNIQUE ("owner_id", "component", "component_key", "component_sequence");
-- Modify "music_component_source_occurrence" table
ALTER TABLE "music_component_source_occurrence" DROP CONSTRAINT "music_component_source_key_check", ADD CONSTRAINT "music_component_source_key_check" CHECK (((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)) AND ("left"(source_path, 1) = '/'::text) AND ((octet_length(component) >= 1) AND (octet_length(component) <= 96)) AND ((octet_length(component_key) >= 1) AND (octet_length(component_key) <= 1536)));
-- Modify "music_source_application_change" table
ALTER TABLE "music_source_application_change" DROP CONSTRAINT "music_source_application_values", ADD CONSTRAINT "music_source_application_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((octet_length(component) >= 1) AND (octet_length(component) <= 96)) AND ((octet_length(component_key) >= 1) AND (octet_length(component_key) <= 1536)) AND ((before_revision_id IS NULL) OR (before_revision_id <> after_revision_id)));
-- Modify "software_visual_novel" table
ALTER TABLE "software_visual_novel" DROP CONSTRAINT "software_vn_length_check", DROP COLUMN "length_type_revision_id", DROP COLUMN "length_minutes";
-- Create "music_component_head" table
CREATE TABLE "music_component_head" (
  "owner_id" uuid NOT NULL,
  "component" text NOT NULL,
  "component_key" text NOT NULL,
  "component_sequence" bigint NOT NULL,
  "history_id" uuid NOT NULL,
  PRIMARY KEY ("owner_id", "component", "component_key"),
  CONSTRAINT "music_component_head_history_fk" FOREIGN KEY ("owner_id", "history_id") REFERENCES "music_component_revision" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_component_head_owner_id_music_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_component_head_values" CHECK (((octet_length(component_key) >= 1) AND (octet_length(component_key) <= 1536)) AND ((component_sequence >= 1) AND (component_sequence <= '9007199254740991'::bigint)))
);
-- Drop index "program_component_revision_lookup_idx" from table: "program_component_revision"
DROP INDEX "program_component_revision_lookup_idx";
-- Modify "program_component_revision" table
ALTER TABLE "program_component_revision" DROP CONSTRAINT "program_component_revision_values", ADD CONSTRAINT "program_component_revision_values" CHECK ((operation = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])) AND ((owner_revision >= 1) AND (owner_revision <= '9007199254740991'::bigint)) AND ((component_sequence >= 1) AND (component_sequence <= '9007199254740991'::bigint)) AND ((octet_length(component) >= 1) AND (octet_length(component) <= 96)) AND ((octet_length(component_key) >= 1) AND (octet_length(component_key) <= 512)) AND (jsonb_typeof(value) = 'object'::text) AND (octet_length((value)::text) <= 1048576)), ADD COLUMN "component_sequence" bigint NOT NULL, ADD CONSTRAINT "program_component_revision_sequence_key" UNIQUE ("owner_id", "component", "component_key", "component_sequence");
-- Create "program_component_head" table
CREATE TABLE "program_component_head" (
  "owner_id" uuid NOT NULL,
  "component" text NOT NULL,
  "component_key" text NOT NULL,
  "component_sequence" bigint NOT NULL,
  "history_id" uuid NOT NULL,
  PRIMARY KEY ("owner_id", "component", "component_key"),
  CONSTRAINT "program_component_head_history_fk" FOREIGN KEY ("owner_id", "history_id") REFERENCES "program_component_revision" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_component_head_owner_id_program_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_component_head_values" CHECK (((component_sequence >= 1) AND (component_sequence <= '9007199254740991'::bigint)) AND ((octet_length(component) >= 1) AND (octet_length(component) <= 96)) AND ((octet_length(component_key) >= 1) AND (octet_length(component_key) <= 512)))
);
-- Drop index "publishing_component_revision_lookup_idx" from table: "publishing_component_revision"
DROP INDEX "publishing_component_revision_lookup_idx";
-- Modify "publishing_component_revision" table
ALTER TABLE "publishing_component_revision" DROP CONSTRAINT "publishing_component_revision_values", ADD CONSTRAINT "publishing_component_revision_values" CHECK ((operation = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])) AND ((owner_revision >= 1) AND (owner_revision <= '9007199254740991'::bigint)) AND ((component_sequence >= 1) AND (component_sequence <= '9007199254740991'::bigint)) AND ((octet_length(component) >= 1) AND (octet_length(component) <= 96)) AND ((octet_length(component_key) >= 1) AND (octet_length(component_key) <= 512)) AND (jsonb_typeof(value) = 'object'::text) AND (octet_length((value)::text) <= 1048576)), ADD COLUMN "component_sequence" bigint NOT NULL, ADD CONSTRAINT "publishing_component_revision_sequence_key" UNIQUE ("owner_id", "component", "component_key", "component_sequence");
-- Create "publishing_component_head" table
CREATE TABLE "publishing_component_head" (
  "owner_id" uuid NOT NULL,
  "component" text NOT NULL,
  "component_key" text NOT NULL,
  "component_sequence" bigint NOT NULL,
  "history_id" uuid NOT NULL,
  PRIMARY KEY ("owner_id", "component", "component_key"),
  CONSTRAINT "publishing_component_head_history_fk" FOREIGN KEY ("owner_id", "history_id") REFERENCES "publishing_component_revision" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_component_head_owner_id_publishing_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_component_head_values" CHECK (((component_sequence >= 1) AND (component_sequence <= '9007199254740991'::bigint)) AND ((octet_length(component) >= 1) AND (octet_length(component) <= 96)) AND ((octet_length(component_key) >= 1) AND (octet_length(component_key) <= 512)))
);

CREATE OR REPLACE FUNCTION public.catalog_record_music_component()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE body jsonb; owner_key uuid; native_revision bigint; native_component_key text; i integer; next_sequence bigint; history_key uuid;
BEGIN
  body := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  owner_key := (body ->> TG_ARGV[0])::uuid;
  IF TG_OP = 'UPDATE' THEN
    FOR i IN 0..TG_NARGS - 1 LOOP
      IF (to_jsonb(OLD) -> TG_ARGV[i]) IS DISTINCT FROM (body -> TG_ARGV[i]) THEN
        RAISE EXCEPTION 'Native music component identity and ownership are immutable'
          USING ERRCODE = '23514', CONSTRAINT = 'music_component_identity_immutable';
      END IF;
    END LOOP;
  END IF;
  SELECT revision INTO STRICT native_revision FROM public.music_identity WHERE id = owner_key;
  native_component_key := '';
  FOR i IN 1..TG_NARGS - 1 LOOP
    native_component_key := native_component_key || CASE WHEN i = 1 THEN '' ELSE '/' END || replace(replace(body ->> TG_ARGV[i], '~', '~0'), '/', '~1');
  END LOOP;
  SELECT head.component_sequence INTO next_sequence FROM public.music_component_head head
    WHERE head.owner_id=owner_key AND head.component=TG_TABLE_NAME AND head.component_key=native_component_key FOR UPDATE;
  next_sequence := coalesce(next_sequence, 0) + 1;
  INSERT INTO public.music_component_revision(owner_id, component, component_key, component_sequence, owner_revision, operation, value)
    VALUES (owner_key, TG_TABLE_NAME, native_component_key, next_sequence, native_revision, TG_OP, body) RETURNING id INTO history_key;
  IF next_sequence=1 THEN
    INSERT INTO public.music_component_head(owner_id,component,component_key,component_sequence,history_id)
      VALUES (owner_key,TG_TABLE_NAME,native_component_key,next_sequence,history_key);
  ELSE
    UPDATE public.music_component_head SET component_sequence=next_sequence,history_id=history_key
      WHERE owner_id=owner_key AND component=TG_TABLE_NAME AND component_key=native_component_key;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_guard_music_history()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'Native music revisions and sealed TOCs are immutable'
    USING ERRCODE = '23514', CONSTRAINT = 'music_native_revision_immutable';
END $$;

DROP TRIGGER IF EXISTS music_component_revision_immutable ON public.music_component_revision;
CREATE TRIGGER music_component_revision_immutable BEFORE UPDATE OR DELETE ON public.music_component_revision
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_history();
DROP TRIGGER IF EXISTS music_disc_toc_immutable ON public.music_disc_toc;
CREATE TRIGGER music_disc_toc_immutable BEFORE UPDATE OR DELETE ON public.music_disc_toc
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_history();
DROP TRIGGER IF EXISTS music_disc_toc_offset_immutable ON public.music_disc_toc_offset;
CREATE TRIGGER music_disc_toc_offset_immutable BEFORE UPDATE OR DELETE ON public.music_disc_toc_offset
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_history();

CREATE OR REPLACE FUNCTION public.catalog_guard_music_toc_offset_append()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM 1 FROM public.music_disc_toc WHERE id = NEW.toc_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.music_medium_toc WHERE toc_id = NEW.toc_id)
    OR EXISTS(SELECT 1 FROM public.music_candidate_toc WHERE toc_id = NEW.toc_id) THEN
    RAISE EXCEPTION 'Attached TOC offsets are sealed' USING ERRCODE = '23514', CONSTRAINT = 'music_toc_offset_sealed';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_disc_toc_offset_sealed ON public.music_disc_toc_offset;
CREATE TRIGGER music_disc_toc_offset_sealed BEFORE INSERT ON public.music_disc_toc_offset
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_toc_offset_append();

CREATE OR REPLACE FUNCTION public.catalog_check_music_toc_attachment()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE expected_count integer; leadout bigint; actual_count bigint; valid boolean;
BEGIN
  SELECT track_count, leadout_offset INTO STRICT expected_count, leadout
    FROM public.music_disc_toc WHERE id = NEW.toc_id FOR UPDATE;
  SELECT count(*), coalesce(bool_and(position = ordinal - 1 AND track_offset < leadout
    AND (previous_offset IS NULL OR previous_offset < track_offset)), false)
    INTO actual_count, valid
    FROM (SELECT position, "offset" AS track_offset, row_number() OVER (ORDER BY position) ordinal,
      lag("offset") OVER (ORDER BY position) previous_offset
      FROM public.music_disc_toc_offset WHERE toc_id = NEW.toc_id ORDER BY position LIMIT 100) offsets;
  IF actual_count <> expected_count OR NOT valid THEN
    RAISE EXCEPTION 'Disc TOC must have the declared contiguous increasing offsets before attachment'
      USING ERRCODE = '23514', CONSTRAINT = 'music_disc_toc_complete';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS music_medium_toc_complete ON public.music_medium_toc;
CREATE TRIGGER music_medium_toc_complete BEFORE INSERT OR UPDATE ON public.music_medium_toc
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_toc_attachment();
DROP TRIGGER IF EXISTS music_candidate_toc_complete ON public.music_candidate_toc;
CREATE TRIGGER music_candidate_toc_complete BEFORE INSERT OR UPDATE ON public.music_candidate_toc
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_toc_attachment();

DO $$
DECLARE row record;
BEGIN
  FOR row IN SELECT * FROM (VALUES
    ('music_work','id','id'), ('music_recording','id','id'),
    ('music_release_group','id','id'), ('music_release','id','id'),
    ('music_release_candidate','id','id'),
    ('music_medium','release_id','id'), ('music_track_occurrence','release_id','id'),
    ('music_release_label','release_id','id'), ('music_release_event','release_id','id'),
    ('music_release_presentation','release_id','id'), ('music_medium_presentation','release_id','id'),
    ('music_candidate_track','candidate_id','id'), ('music_work_language','work_id','language_tag'),
    ('music_release_group_secondary_type','release_group_id','type_revision_id')
  ) items(table_name, owner_column, key_column) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', row.table_name || '_record_revision', row.table_name);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component(%L,%L)',
      row.table_name || '_record_revision', row.table_name, row.owner_column, row.key_column);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS music_medium_attribute_record_revision ON public.music_medium_attribute;
CREATE TRIGGER music_medium_attribute_record_revision AFTER INSERT OR UPDATE OR DELETE ON public.music_medium_attribute
  FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component('release_id','medium_id','id');
DROP TRIGGER IF EXISTS music_track_presentation_record_revision ON public.music_track_presentation;
CREATE TRIGGER music_track_presentation_record_revision AFTER INSERT OR UPDATE OR DELETE ON public.music_track_presentation
  FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component('release_id','medium_presentation_id','track_id');
DROP TRIGGER IF EXISTS music_medium_toc_record_revision ON public.music_medium_toc;
CREATE TRIGGER music_medium_toc_record_revision AFTER INSERT OR UPDATE OR DELETE ON public.music_medium_toc
  FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component('release_id','medium_id','toc_id');
DROP TRIGGER IF EXISTS music_candidate_toc_record_revision ON public.music_candidate_toc;
CREATE TRIGGER music_candidate_toc_record_revision AFTER INSERT OR UPDATE OR DELETE ON public.music_candidate_toc
  FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component('candidate_id','toc_id');

DROP TRIGGER IF EXISTS music_medium_identifier_record_revision ON public.music_medium_identifier;
CREATE TRIGGER music_medium_identifier_record_revision AFTER INSERT OR UPDATE OR DELETE ON public.music_medium_identifier
  FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component('release_id','medium_id','namespace','value');
DROP TRIGGER IF EXISTS music_track_identifier_record_revision ON public.music_track_identifier;
CREATE TRIGGER music_track_identifier_record_revision AFTER INSERT OR UPDATE OR DELETE ON public.music_track_identifier
  FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component('release_id','track_id','namespace','value');

CREATE OR REPLACE FUNCTION public.catalog_check_music_source_occurrence()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.music_component_revision
    WHERE owner_id = NEW.owner_id AND id = NEW.history_id AND component = NEW.component
      AND component_key = NEW.component_key AND operation <> 'DELETE') THEN
    RAISE EXCEPTION 'Music source occurrence must reference the exact native component revision'
      USING ERRCODE = '23514', CONSTRAINT = 'music_source_occurrence_exact_history';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_component_source_occurrence_exact_history ON public.music_component_source_occurrence;
CREATE TRIGGER music_component_source_occurrence_exact_history BEFORE INSERT ON public.music_component_source_occurrence
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_source_occurrence();
DROP TRIGGER IF EXISTS music_component_source_occurrence_immutable ON public.music_component_source_occurrence;
CREATE TRIGGER music_component_source_occurrence_immutable BEFORE UPDATE OR DELETE ON public.music_component_source_occurrence
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_history();


CREATE OR REPLACE FUNCTION public.catalog_guard_music_component_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP='DELETE' OR pg_trigger_depth()<2 THEN
    RAISE EXCEPTION 'Music component heads are maintained by native history capture' USING ERRCODE='23514';
  END IF;
  IF TG_OP='INSERT' AND NEW.component_sequence<>1 THEN
    RAISE EXCEPTION 'Music component history must start at sequence one' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND ((OLD.owner_id,OLD.component,OLD.component_key) IS DISTINCT FROM (NEW.owner_id,NEW.component,NEW.component_key)
    OR NEW.component_sequence<>OLD.component_sequence+1) THEN
    RAISE EXCEPTION 'Music component sequence must advance exactly once' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.music_component_revision WHERE owner_id=NEW.owner_id AND id=NEW.history_id
    AND component=NEW.component AND component_key=NEW.component_key AND component_sequence=NEW.component_sequence) THEN
    RAISE EXCEPTION 'Music component head requires its exact immutable revision' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_component_head_maintained ON public.music_component_head;
CREATE TRIGGER music_component_head_maintained BEFORE INSERT OR UPDATE OR DELETE ON public.music_component_head
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_component_head();

CREATE OR REPLACE FUNCTION public.catalog_guard_music_revision_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF pg_trigger_depth()<2 THEN
    RAISE EXCEPTION 'Music history is captured from native rows, not caller-supplied snapshots' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_component_revision_capture_only ON public.music_component_revision;
CREATE TRIGGER music_component_revision_capture_only BEFORE INSERT ON public.music_component_revision
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_revision_insert();

CREATE OR REPLACE FUNCTION public.catalog_check_music_source_baseline()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE native public.music_component_revision%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.source_record_id, OLD.mapping_key, OLD.owner_id, OLD.component, OLD.component_key)
    IS DISTINCT FROM (NEW.source_record_id, NEW.mapping_key, NEW.owner_id, NEW.component, NEW.component_key) THEN
    RAISE EXCEPTION 'Music source baseline identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.music_component_source_occurrence
    WHERE source_record_id=NEW.source_record_id AND snapshot_id=NEW.snapshot_id AND owner_id=NEW.owner_id
      AND component=NEW.component AND component_key=NEW.component_key AND source_path=NEW.source_path AND history_id=NEW.source_history_id) THEN
    RAISE EXCEPTION 'Music source baseline requires exact original source support' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO STRICT native FROM public.music_component_revision WHERE owner_id=NEW.owner_id AND id=NEW.current_history_id;
  IF native.component <> NEW.component OR native.component_key <> NEW.component_key OR (native.operation='DELETE') <> NEW.absent THEN
    RAISE EXCEPTION 'Music source baseline current component differs' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.music_source_application_change change
    JOIN public.catalog_source_adoption_proposal proposal ON proposal.source_record_id=change.source_record_id AND proposal.id=change.proposal_id
    WHERE change.source_record_id=NEW.source_record_id AND change.proposal_id=NEW.proposal_id AND change.action=NEW.action
      AND proposal.mapping_key=NEW.mapping_key AND change.owner_id=NEW.owner_id AND change.component=NEW.component
      AND change.component_key=NEW.component_key AND change.after_revision_id=NEW.current_history_id) THEN
    RAISE EXCEPTION 'Music source baseline requires exact native application proof' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_source_baseline_proof ON public.music_component_source_baseline;
CREATE TRIGGER music_source_baseline_proof BEFORE INSERT OR UPDATE ON public.music_component_source_baseline
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_source_baseline();

-- Shared alternate text/credit values are replaced through exact occurrence revisions.
DROP TRIGGER IF EXISTS music_alternative_track_immutable ON public.music_alternative_track;
CREATE TRIGGER music_alternative_track_immutable BEFORE UPDATE OR DELETE ON public.music_alternative_track
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_history();

CREATE OR REPLACE FUNCTION public.catalog_check_music_definition_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE revision_id uuid; policy jsonb;
BEGIN
  revision_id := (to_jsonb(NEW)->>TG_ARGV[0])::uuid;
  IF revision_id IS NULL THEN RETURN NEW; END IF;
  SELECT revision.constraints INTO policy FROM public.catalog_definition_revision revision
    JOIN public.catalog_definition definition ON definition.id=revision.definition_id
    WHERE revision.id=revision_id AND definition.kind='vocabulary';
  IF policy IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(policy->'targets','[]'::jsonb)) target
    WHERE target->>'owner'='music' AND coalesce(target->'shapes','[]'::jsonb) ? TG_ARGV[1])
    OR NOT (coalesce(policy->'slots','[]'::jsonb) ? TG_ARGV[2]) THEN
    RAISE EXCEPTION 'Music vocabulary is outside its governed native target or slot'
      USING ERRCODE='23514', CONSTRAINT='music_definition_target_scope';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_release_status_scope ON public.music_release;
CREATE TRIGGER music_release_status_scope BEFORE INSERT OR UPDATE ON public.music_release
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('status_revision_id','release','music_release.status_revision_id');
DROP TRIGGER IF EXISTS music_release_packaging_scope ON public.music_release;
CREATE TRIGGER music_release_packaging_scope BEFORE INSERT OR UPDATE ON public.music_release
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('packaging_revision_id','release','music_release.packaging_revision_id');
DROP TRIGGER IF EXISTS music_medium_format_scope ON public.music_medium;
CREATE TRIGGER music_medium_format_scope BEFORE INSERT OR UPDATE ON public.music_medium
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('format_revision_id','release','music_medium.format_revision_id');
DROP TRIGGER IF EXISTS music_work_type_scope ON public.music_work;
CREATE TRIGGER music_work_type_scope BEFORE INSERT OR UPDATE ON public.music_work
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('type_revision_id','work','music_work.type_revision_id');
DROP TRIGGER IF EXISTS music_release_group_primary_scope ON public.music_release_group;
CREATE TRIGGER music_release_group_primary_scope BEFORE INSERT OR UPDATE ON public.music_release_group
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('primary_type_revision_id','release_group','music_release_group.primary_type_revision_id');
DROP TRIGGER IF EXISTS music_release_group_secondary_scope ON public.music_release_group_secondary_type;
CREATE TRIGGER music_release_group_secondary_scope BEFORE INSERT OR UPDATE ON public.music_release_group_secondary_type
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('type_revision_id','release_group','music_release_group_secondary_type.type_revision_id');
DROP TRIGGER IF EXISTS music_release_presentation_type_scope ON public.music_release_presentation;
CREATE TRIGGER music_release_presentation_type_scope BEFORE INSERT OR UPDATE ON public.music_release_presentation
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('type_revision_id','release','music_release_presentation.type_revision_id');


CREATE OR REPLACE FUNCTION public.catalog_capture_structure_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE body jsonb; native_owner uuid; native_revision bigint; component_key text := ''; ordinal integer; next_sequence bigint; history_key uuid;
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
    component_key := component_key || CASE WHEN ordinal=2 THEN '' ELSE '/' END || replace(replace(body->>TG_ARGV[ordinal], '~', '~0'), '/', '~1');
  END LOOP;
  EXECUTE format('SELECT component_sequence FROM public.%I WHERE owner_id=$1 AND component=$2 AND component_key=$3 FOR UPDATE',TG_ARGV[0] || '_component_head') INTO next_sequence USING native_owner,TG_TABLE_NAME,component_key;
  next_sequence := coalesce(next_sequence,0) + 1;
  EXECUTE format('INSERT INTO public.%I(owner_id,component,component_key,component_sequence,owner_revision,operation,value) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',TG_ARGV[0] || '_component_revision') INTO history_key USING native_owner,TG_TABLE_NAME,component_key,next_sequence,native_revision,TG_OP,body;
  IF next_sequence=1 THEN
    EXECUTE format('INSERT INTO public.%I(owner_id,component,component_key,component_sequence,history_id) VALUES($1,$2,$3,$4,$5)',TG_ARGV[0] || '_component_head') USING native_owner,TG_TABLE_NAME,component_key,next_sequence,history_key;
  ELSE
    EXECUTE format('UPDATE public.%I SET component_sequence=$4,history_id=$5 WHERE owner_id=$1 AND component=$2 AND component_key=$3',TG_ARGV[0] || '_component_head') USING native_owner,TG_TABLE_NAME,component_key,next_sequence,history_key;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_guard_structure_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE valid boolean;
BEGIN
  IF TG_OP='DELETE' OR pg_trigger_depth()<2 THEN RAISE EXCEPTION 'Structural heads are maintained by native history capture' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' AND NEW.component_sequence<>1 THEN RAISE EXCEPTION 'Structural sequence must start at one' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND ((OLD.owner_id,OLD.component,OLD.component_key) IS DISTINCT FROM (NEW.owner_id,NEW.component,NEW.component_key) OR NEW.component_sequence<>OLD.component_sequence+1) THEN RAISE EXCEPTION 'Structural sequence must advance exactly once' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE owner_id=$1 AND id=$2 AND component=$3 AND component_key=$4 AND component_sequence=$5)', TG_ARGV[0] || '_component_revision') INTO valid USING NEW.owner_id,NEW.history_id,NEW.component,NEW.component_key,NEW.component_sequence;
  IF NOT valid THEN RAISE EXCEPTION 'Structural head requires exact immutable history' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_guard_structure_revision_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF pg_trigger_depth()<2 THEN RAISE EXCEPTION 'Structural history is captured from native rows' USING ERRCODE='23514'; END IF;
  RETURN NEW;
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
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_structure_head_maintained ON public.%I',owner_name || '_component_head');
    EXECUTE format('CREATE TRIGGER catalog_structure_head_maintained BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_structure_head(%L)',owner_name || '_component_head',owner_name);
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_structure_revision_capture_only ON public.%I',owner_name || '_component_revision');
    EXECUTE format('CREATE TRIGGER catalog_structure_revision_capture_only BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_structure_revision_insert()',owner_name || '_component_revision');
    FOREACH relation_name IN ARRAY ARRAY[owner_name || '_component_revision',owner_name || '_component_source_occurrence'] LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS catalog_structure_history_immutable ON public.%I',relation_name);
      EXECUTE format('CREATE TRIGGER catalog_structure_history_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_structure_history()',relation_name);
    END LOOP;
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_structure_source_exact ON public.%I',owner_name || '_component_source_occurrence');
    EXECUTE format('CREATE TRIGGER catalog_structure_source_exact BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_validate_structure_source(%L)',owner_name || '_component_source_occurrence',owner_name);
  END LOOP;
END $$;


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
  IF (application.action = 'apply' AND proposal.state NOT IN ('applied','withdrawn'))
    OR (application.action = 'withdraw' AND proposal.state <> 'withdrawn') THEN
    RAISE EXCEPTION 'Native application must commit its corresponding proposal decision' USING ERRCODE = '23514';
  END IF;
  SELECT count(*), count(DISTINCT position), min(position), max(position)
    INTO actual_count, unique_positions, first_position, last_position FROM (
      SELECT position FROM public.music_source_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
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
  FOREACH relation_name IN ARRAY ARRAY['catalog_source_application','music_source_application_change','software_source_component_application_change','software_source_record_application_change','publishing_source_semantic_application_change','publishing_source_name_application_change','publishing_source_authority_application_change','music_source_semantic_application_change','music_source_name_application_change','music_source_authority_application_change','program_source_semantic_application_change','program_source_name_application_change','program_source_authority_application_change','software_source_semantic_application_change','software_source_name_application_change','software_source_authority_application_change','entity_source_semantic_application_change','entity_source_name_application_change','entity_source_authority_application_change','grouping_source_semantic_application_change','grouping_source_name_application_change','grouping_source_authority_application_change','reference_source_semantic_application_change','reference_source_name_application_change','reference_source_authority_application_change','distribution_source_semantic_application_change','distribution_source_name_application_change','distribution_source_authority_application_change','software_source_context_application_change','software_source_participation_application_change'] LOOP
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
      WHERE n.nspname='public' AND c.relname IN ('catalog_source_application','music_source_application_change','software_source_component_application_change','software_source_record_application_change','publishing_source_semantic_application_change','publishing_source_name_application_change','publishing_source_authority_application_change','music_source_semantic_application_change','music_source_name_application_change','music_source_authority_application_change','program_source_semantic_application_change','program_source_name_application_change','program_source_authority_application_change','software_source_semantic_application_change','software_source_name_application_change','software_source_authority_application_change','entity_source_semantic_application_change','entity_source_name_application_change','entity_source_authority_application_change','grouping_source_semantic_application_change','grouping_source_name_application_change','grouping_source_authority_application_change','reference_source_semantic_application_change','reference_source_name_application_change','reference_source_authority_application_change','distribution_source_semantic_application_change','distribution_source_name_application_change','distribution_source_authority_application_change','software_source_context_application_change','software_source_participation_application_change')
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
