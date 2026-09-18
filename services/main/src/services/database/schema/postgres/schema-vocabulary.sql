-- Canonical vocabulary integrity guards. Install through the main schema_complete migration bundle.
CREATE OR REPLACE FUNCTION public.schema_reject_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Schema identities, revisions and decisions are immutable; append a new revision or selection'
    USING ERRCODE = '23514';
END;
$$;

CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_vocabulary
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_release
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_release_context
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_term
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_term_alias
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_definition
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_release_term
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_label
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_release_label
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_change
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_label_selection
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_profile
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_profile_revision
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_profile_rule
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_relation
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_relation_revision
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_relation_selection
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_node
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_statement
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_contract
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_contract_field
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_contract_keyword
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_contract_reference
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.catalog_definition_binding
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();

CREATE OR REPLACE FUNCTION public.schema_require_prior_revision()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_exists boolean;
BEGIN
  IF NEW.parent_revision_id IS NOT NULL THEN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I WHERE id = $1 AND relation_id = $2)', TG_TABLE_SCHEMA, TG_TABLE_NAME)
      INTO parent_exists USING NEW.parent_revision_id, NEW.relation_id;
    IF NOT parent_exists THEN
      RAISE EXCEPTION 'A revision parent must already exist for the same relation' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER schema_revision_parent BEFORE INSERT ON public.schema_relation_revision
FOR EACH ROW EXECUTE FUNCTION public.schema_require_prior_revision();

CREATE OR REPLACE FUNCTION public.schema_statement_shape_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM schema_node WHERE release_id=NEW.release_id AND id=NEW.subject_id AND kind IN ('iri','blank'))
 OR NOT EXISTS(SELECT 1 FROM schema_node WHERE release_id=NEW.release_id AND id=NEW.graph_id AND kind IN ('iri','blank','default-graph')) THEN
 RAISE EXCEPTION 'Invalid RDF subject or graph node' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER schema_statement_shape_guard BEFORE INSERT ON public.schema_statement FOR EACH ROW EXECUTE FUNCTION public.schema_statement_shape_guard();
