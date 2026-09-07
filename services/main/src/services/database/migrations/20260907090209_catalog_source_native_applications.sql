SET search_path TO public;

-- Create "catalog_source_application" table
CREATE TABLE "catalog_source_application" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "previous_snapshot_id" uuid NULL,
  "before_revision" bigint NOT NULL,
  "after_revision" bigint NOT NULL,
  "change_count" integer NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("source_record_id", "proposal_id", "action"),
  CONSTRAINT "catalog_source_application_9WAUDE6jbeTv_fkey" FOREIGN KEY ("source_record_id", "proposal_id") REFERENCES "catalog_source_adoption_proposal" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_application_pLs5kO8MMCDW_fkey" FOREIGN KEY ("source_record_id", "previous_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_application_values" CHECK ((action = ANY (ARRAY['apply'::text, 'withdraw'::text])) AND (before_revision >= 1) AND (after_revision > before_revision) AND (after_revision <= '9007199254740991'::bigint) AND ((change_count >= 0) AND (change_count <= 128)))
) PARTITION BY HASH ("source_record_id");
-- Create "music_source_application_change" table
CREATE TABLE "music_source_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component" text NOT NULL,
  "component_key" text NOT NULL,
  "before_revision_id" uuid NULL,
  "after_revision_id" uuid NOT NULL,
  PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "music_source_application_change_VRhkURkbidtS_fkey" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_source_application_change_jbOes6KhljVI_fkey" FOREIGN KEY ("owner_id", "after_revision_id") REFERENCES "music_component_revision" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_source_application_change_uMpDDANMHaAb_fkey" FOREIGN KEY ("owner_id", "before_revision_id") REFERENCES "music_component_revision" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_source_application_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((octet_length(component) >= 1) AND (octet_length(component) <= 96)) AND ((octet_length(component_key) >= 1) AND (octet_length(component_key) <= 512)) AND ((before_revision_id IS NULL) OR (before_revision_id <> after_revision_id)))
) PARTITION BY HASH ("source_record_id");
-- Create "software_source_component_application_change" table
CREATE TABLE "software_source_component_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component" text NOT NULL,
  "component_key" text NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "software_source_component_application_change_BwtGLu8Meo40_fkey" FOREIGN KEY ("owner_id", "component", "component_key", "before_revision") REFERENCES "software_component_revision" ("release_id", "kind", "component_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_component_application_change_qsur6iBA17p9_fkey" FOREIGN KEY ("owner_id", "component", "component_key", "after_revision") REFERENCES "software_component_revision" ("release_id", "kind", "component_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_component_application_change_w4gxdZiU4V52_fkey" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_component_application_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "software_source_record_application_change" table
CREATE TABLE "software_source_record_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "software_source_record_application_change_1n6WbKLzjkmm_fkey" FOREIGN KEY ("owner_id", "after_revision") REFERENCES "software_record_revision" ("owner_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_record_application_change_cYDszzacWX5d_fkey" FOREIGN KEY ("owner_id", "before_revision") REFERENCES "software_record_revision" ("owner_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_record_application_change_qdJ2myqepODC_fkey" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_record_application_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");

-- Atlas Community omits children; source application leaves must exist before deferred guards.
DO $$
DECLARE parent_name text; partition_number integer;
BEGIN
  FOREACH parent_name IN ARRAY ARRAY['catalog_source_application','music_source_application_change','software_source_component_application_change','software_source_record_application_change'] LOOP
    FOR partition_number IN 0..63 LOOP
      EXECUTE format('CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES WITH (MODULUS 64, REMAINDER %s)', parent_name || '_p' || lpad(partition_number::text, 2, '0'), parent_name, partition_number);
    END LOOP;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_source_validate_application_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE history public.music_component_revision%ROWTYPE;
BEGIN
  IF TG_ARGV[0] = 'music' THEN
    SELECT * INTO STRICT history FROM public.music_component_revision WHERE owner_id = NEW.owner_id AND id = NEW.after_revision_id;
    IF history.component <> NEW.component OR history.component_key <> NEW.component_key THEN
      RAISE EXCEPTION 'Music application history has a different component key' USING ERRCODE = '23514';
    END IF;
    IF NEW.before_revision_id IS NOT NULL THEN
      SELECT * INTO STRICT history FROM public.music_component_revision WHERE owner_id = NEW.owner_id AND id = NEW.before_revision_id;
      IF history.component <> NEW.component OR history.component_key <> NEW.component_key OR NEW.before_revision_id >= NEW.after_revision_id THEN
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
  FOREACH relation_name IN ARRAY ARRAY['catalog_source_application','music_source_application_change','software_source_component_application_change','software_source_record_application_change'] LOOP
    EXECUTE format('CREATE TRIGGER catalog_source_application_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_immutable_evidence()', relation_name);
  END LOOP;
  FOR physical IN
    WITH RECURSIVE roots AS (
      SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('catalog_source_application','music_source_application_change','software_source_component_application_change','software_source_record_application_change')
      UNION ALL SELECT i.inhrelid FROM pg_inherits i JOIN roots r ON r.oid=i.inhparent
    ) SELECT c.oid::regclass AS name FROM roots r JOIN pg_class c ON c.oid=r.oid WHERE c.relkind='r'
  LOOP
    EXECUTE format('CREATE CONSTRAINT TRIGGER catalog_source_application_complete AFTER INSERT ON %s DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_source_require_application_complete()', physical.name);
  END LOOP;
END $$;
CREATE TRIGGER music_source_application_exact_component BEFORE INSERT ON public.music_source_application_change
  FOR EACH ROW EXECUTE FUNCTION public.catalog_source_validate_application_change('music');
