CREATE OR REPLACE FUNCTION public.catalog_source_guard_record()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND
    (NEW.id <> OLD.id OR NEW.source <> OLD.source OR NEW.object_type <> OLD.object_type OR
     NEW.external_id <> OLD.external_id OR NEW.acquisition_generation < OLD.acquisition_generation OR
     NEW.accepted_generation < OLD.accepted_generation)) THEN
    RAISE EXCEPTION 'Source natural identity is immutable and acquisition generations cannot regress'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_source_identity_immutable';
  END IF;
  IF NEW.head_snapshot_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.catalog_source_snapshot WHERE source_record_id = NEW.id AND id = NEW.head_snapshot_id
  ) THEN
    RAISE EXCEPTION 'Source head must reference its own immutable snapshot'
      USING ERRCODE = '23503', CONSTRAINT = 'catalog_source_exact_head';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_source_guard_immutable_evidence()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'Source snapshots, binding revisions and completed check receipts are immutable'
    USING ERRCODE = '23514', CONSTRAINT = 'catalog_source_evidence_immutable';
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_source_guard_mapping()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND
    (NEW.source_record_id <> OLD.source_record_id OR NEW.path <> OLD.path OR
     NEW.mapping_key <> OLD.mapping_key OR NEW.owner <> OLD.owner OR
     NEW.binding_revision < OLD.binding_revision OR NEW.binding_revision > OLD.binding_revision + 1 OR
     NEW.policy_revision < OLD.policy_revision OR
     ((NEW.state <> OLD.state OR NEW.policy_revision <> OLD.policy_revision) AND NEW.binding_revision <> OLD.binding_revision + 1))) THEN
    RAISE EXCEPTION 'Source mapping identity is immutable and authority edits require the next revision'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_source_mapping_transition';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_source_require_binding_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE claim public.catalog_source_mapping_claim%ROWTYPE; binding_row public.catalog_source_binding_revision%ROWTYPE; native_target uuid;
BEGIN
  SELECT * INTO claim FROM public.catalog_source_mapping_claim
    WHERE source_record_id = NEW.source_record_id AND mapping_key = NEW.mapping_key;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF to_jsonb(NEW) ? 'revision' AND (to_jsonb(NEW)->>'revision')::bigint > claim.binding_revision THEN
    RAISE EXCEPTION 'An appended source binding revision must be published in its transaction'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_source_binding_revision_published';
  END IF;
  SELECT r.* INTO binding_row FROM public.catalog_source_binding_revision r
    WHERE r.source_record_id = claim.source_record_id AND r.mapping_key = claim.mapping_key AND r.revision = claim.binding_revision;
  IF NOT FOUND OR binding_row.owner <> claim.owner OR binding_row.policy_revision <> claim.policy_revision OR binding_row.state <> claim.state THEN
    RAISE EXCEPTION 'Source mapping must commit its exact immutable binding and policy revision'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_source_binding_head_required';
  END IF;
  EXECUTE format('SELECT owner_id FROM public.%I WHERE source_record_id = $1 AND mapping_key = $2', claim.owner || '_source_binding')
    INTO native_target USING claim.source_record_id, claim.mapping_key;
  IF native_target IS NULL OR native_target IS DISTINCT FROM (to_jsonb(binding_row)->>(claim.owner || '_id'))::uuid THEN
    RAISE EXCEPTION 'Source binding target must equal its committed revision target'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_source_binding_exact_target';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS catalog_source_record_guard ON public.catalog_source_record;
CREATE TRIGGER catalog_source_record_guard BEFORE INSERT OR UPDATE OR DELETE ON public.catalog_source_record
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_record();
DROP TRIGGER IF EXISTS catalog_source_mapping_guard ON public.catalog_source_mapping_claim;
CREATE TRIGGER catalog_source_mapping_guard BEFORE UPDATE OR DELETE ON public.catalog_source_mapping_claim
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_mapping();

DO $$
DECLARE relation_name text; physical record;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['catalog_source_snapshot', 'catalog_source_binding_revision', 'catalog_source_check_receipt'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_evidence_guard ON public.%I', relation_name);
    EXECUTE format('CREATE TRIGGER catalog_source_evidence_guard BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_immutable_evidence()', relation_name);
  END LOOP;
  -- Constraint triggers are installed on concrete leaves, including an unpartitioned fresh target.
  FOR physical IN
    WITH RECURSIVE roots AS (
      SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('catalog_source_mapping_claim','catalog_source_binding_revision','publishing_source_binding','music_source_binding','program_source_binding','software_source_binding','entity_source_binding','grouping_source_binding','reference_source_binding')
      UNION ALL SELECT i.inhrelid FROM pg_inherits i JOIN roots r ON r.oid=i.inhparent
    ) SELECT c.oid::regclass AS name FROM roots r JOIN pg_class c ON c.oid=r.oid WHERE c.relkind='r'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_binding_head_required ON %s', physical.name);
    EXECUTE format('CREATE CONSTRAINT TRIGGER catalog_source_binding_head_required AFTER INSERT OR UPDATE ON %s DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_source_require_binding_head()', physical.name);
  END LOOP;
END;
$$;
