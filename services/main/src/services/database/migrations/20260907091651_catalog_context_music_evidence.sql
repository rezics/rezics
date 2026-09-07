SET search_path TO public;

-- Create "music_component_source_occurrence" table
CREATE TABLE "music_component_source_occurrence" (
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "component" text NOT NULL,
  "component_key" text NOT NULL,
  "source_path" text NOT NULL,
  "history_id" uuid NOT NULL,
  PRIMARY KEY ("source_record_id", "snapshot_id", "owner_id", "component", "source_path"),
  CONSTRAINT "music_component_source_key_check" CHECK (((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)) AND ("left"(source_path, 1) = '/'::text) AND ((octet_length(component) >= 1) AND (octet_length(component) <= 96)) AND ((octet_length(component_key) >= 1) AND (octet_length(component_key) <= 512)))
);
-- Create index "music_component_source_history_idx" to table: "music_component_source_occurrence"
CREATE INDEX "music_component_source_history_idx" ON "music_component_source_occurrence" ("owner_id", "history_id");
-- Create "software_participation" table
CREATE TABLE "software_participation" (
  "content_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "current_revision" bigint NULL,
  PRIMARY KEY ("content_id", "id"),
  CONSTRAINT "software_participation_head_check" CHECK ((current_revision IS NULL) OR ((current_revision >= 1) AND (current_revision <= '9007199254740991'::bigint)))
);
-- Create "software_participation_credit_source_occurrence" table
CREATE TABLE "software_participation_credit_source_occurrence" (
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "content_id" uuid NOT NULL,
  "participation_id" uuid NOT NULL,
  "participation_revision" bigint NOT NULL,
  PRIMARY KEY ("source_record_id", "snapshot_id", "source_path"),
  CONSTRAINT "software_participation_credit_path_check" CHECK (((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)) AND ("left"(source_path, 1) = '/'::text))
);
-- Create index "software_participation_credit_target_idx" to table: "software_participation_credit_source_occurrence"
CREATE INDEX "software_participation_credit_target_idx" ON "software_participation_credit_source_occurrence" ("content_id", "participation_id", "participation_revision");
-- Create "software_participation_revision" table
CREATE TABLE "software_participation_revision" (
  "content_id" uuid NOT NULL,
  "participation_id" uuid NOT NULL,
  "revision" bigint NOT NULL,
  "entity_id" uuid NOT NULL,
  "name_id" uuid NULL,
  "name_revision" bigint NULL,
  "context_id" uuid NULL,
  "context_revision" bigint NULL,
  "character_id" uuid NULL,
  "role_revision_id" uuid NOT NULL,
  "note" text NULL,
  "state" text NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "created_by_auth_user_id" uuid NOT NULL,
  PRIMARY KEY ("content_id", "participation_id", "revision"),
  CONSTRAINT "software_participation_alias_pair_check" CHECK ((name_id IS NULL) = (name_revision IS NULL)),
  CONSTRAINT "software_participation_context_pair_check" CHECK ((context_id IS NULL) = (context_revision IS NULL)),
  CONSTRAINT "software_participation_note_check" CHECK ((note IS NULL) OR (octet_length(note) <= 16384)),
  CONSTRAINT "software_participation_revision_check" CHECK (((revision >= 1) AND (revision <= '9007199254740991'::bigint)) AND (state = ANY (ARRAY['active'::text, 'withdrawn'::text])))
);
-- Create index "software_participation_character_idx" to table: "software_participation_revision"
CREATE INDEX "software_participation_character_idx" ON "software_participation_revision" ("character_id", "content_id", "participation_id", "revision") WHERE (character_id IS NOT NULL);
-- Create index "software_participation_entity_idx" to table: "software_participation_revision"
CREATE INDEX "software_participation_entity_idx" ON "software_participation_revision" ("entity_id", "content_id", "participation_id", "revision");
-- Modify "music_component_source_occurrence" table
ALTER TABLE "music_component_source_occurrence" ADD CONSTRAINT "music_component_source_history_fk" FOREIGN KEY ("owner_id", "history_id") REFERENCES "music_component_revision" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "music_component_source_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "software_participation" table
ALTER TABLE "software_participation" ADD CONSTRAINT "software_participation_content_id_software_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "software_content" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "software_participation_head_fk" FOREIGN KEY ("content_id", "id", "current_revision") REFERENCES "software_participation_revision" ("content_id", "participation_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "software_participation_credit_source_occurrence" table
ALTER TABLE "software_participation_credit_source_occurrence" ADD CONSTRAINT "software_participation_credit_revision_fk" FOREIGN KEY ("content_id", "participation_id", "participation_revision") REFERENCES "software_participation_revision" ("content_id", "participation_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "software_participation_credit_source_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "software_participation_revision" table
ALTER TABLE "software_participation_revision" ADD CONSTRAINT "software_participation_alias_revision_fk" FOREIGN KEY ("entity_id", "name_id", "name_revision") REFERENCES "entity_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "software_participation_context_revision_fk" FOREIGN KEY ("content_id", "context_id", "context_revision") REFERENCES "software_participation_context_revision" ("content_id", "context_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "software_participation_revision_7513eLLe9PAa_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "software_participation_revision_i45hUWCsvfPc_fkey" FOREIGN KEY ("character_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "software_participation_revision_identity_fk" FOREIGN KEY ("content_id", "participation_id") REFERENCES "software_participation" ("content_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "software_participation_revision_vb7MmelrBujy_fkey" FOREIGN KEY ("role_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "software_participation_revision_xXQiRQwhr3AG_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.catalog_guard_software_participation()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND
      (NEW.content_id <> OLD.content_id OR NEW.id <> OLD.id OR
       NEW.current_revision IS NULL OR
       NEW.current_revision <> coalesce(OLD.current_revision, 0) + 1)) THEN
    RAISE EXCEPTION 'Participation identity is immutable and its head must advance by one'
      USING ERRCODE = '23514', CONSTRAINT = 'software_participation_transition_check';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_require_software_participation_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.software_participation
             WHERE content_id = NEW.content_id AND id = NEW.id AND current_revision IS NULL) THEN
    RAISE EXCEPTION 'Participation must have a current revision at commit'
      USING ERRCODE = '23514', CONSTRAINT = 'software_participation_committed_head_check';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_software_participation_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE current_head bigint;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Participation revisions and source occurrences are immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'software_participation_history_immutable';
  END IF;
  SELECT current_revision INTO current_head FROM public.software_participation
    WHERE content_id = NEW.content_id AND id = NEW.participation_id FOR UPDATE;
  IF FOUND AND NEW.revision <> coalesce(current_head, 0) + 1 THEN
    RAISE EXCEPTION 'Participation revisions must append at the current head'
      USING ERRCODE = '23514', CONSTRAINT = 'software_participation_revision_sequence_check';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS software_participation_guard ON public.software_participation;
CREATE TRIGGER software_participation_guard BEFORE UPDATE OR DELETE ON public.software_participation
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_software_participation();

DROP TRIGGER IF EXISTS software_participation_head_required ON public.software_participation;
CREATE CONSTRAINT TRIGGER software_participation_head_required AFTER INSERT OR UPDATE ON public.software_participation
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_software_participation_head();

DROP TRIGGER IF EXISTS software_participation_revision_guard ON public.software_participation_revision;
CREATE TRIGGER software_participation_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON public.software_participation_revision
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_software_participation_revision();

DROP TRIGGER IF EXISTS software_participation_occurrence_guard ON public.software_participation_credit_source_occurrence;
CREATE TRIGGER software_participation_occurrence_guard BEFORE UPDATE OR DELETE ON public.software_participation_credit_source_occurrence
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_software_participation_revision();

CREATE OR REPLACE FUNCTION public.catalog_require_software_participation_revision_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.software_participation
             WHERE content_id = NEW.content_id AND id = NEW.participation_id
             AND (current_revision IS NULL OR current_revision < NEW.revision)) THEN
    RAISE EXCEPTION 'Participation appended revision must become current in its transaction'
      USING ERRCODE = '23514', CONSTRAINT = 'software_participation_appended_head_check';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS software_participation_revision_head_required ON public.software_participation_revision;
CREATE CONSTRAINT TRIGGER software_participation_revision_head_required AFTER INSERT ON public.software_participation_revision
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_software_participation_revision_head();

CREATE OR REPLACE FUNCTION public.catalog_validate_software_participation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.entity_identity WHERE id = NEW.entity_id AND shape IN ('person','organization','collective','unresolved','label')) THEN
    RAISE EXCEPTION 'Participation actor must be a person, organization or collective' USING ERRCODE = '23514';
  END IF;
  IF NEW.character_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.entity_identity WHERE id = NEW.character_id AND shape = 'character') THEN
    RAISE EXCEPTION 'Voice participation requires a Character' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.catalog_definition_revision r JOIN public.catalog_definition d ON d.id = r.definition_id WHERE r.id = NEW.role_revision_id AND d.kind = 'vocabulary') THEN
    RAISE EXCEPTION 'Participation role requires a vocabulary revision' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS software_participation_values ON public.software_participation_revision;
CREATE TRIGGER software_participation_values BEFORE INSERT ON public.software_participation_revision
FOR EACH ROW EXECUTE FUNCTION public.catalog_validate_software_participation();


CREATE OR REPLACE FUNCTION public.catalog_record_music_component()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE body jsonb; owner_key uuid; native_revision bigint; component_key text; i integer;
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
  component_key := '';
  FOR i IN 1..TG_NARGS - 1 LOOP
    component_key := component_key || CASE WHEN i = 1 THEN '' ELSE '/' END || (body ->> TG_ARGV[i]);
  END LOOP;
  INSERT INTO public.music_component_revision(owner_id, component, component_key, owner_revision, operation, value)
    VALUES (owner_key, TG_TABLE_NAME, component_key, native_revision, TG_OP, body);
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
