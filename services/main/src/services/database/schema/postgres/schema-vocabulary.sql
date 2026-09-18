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

CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_model_release
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();

CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_model_profile
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();

CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_model_binding
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();

CREATE OR REPLACE FUNCTION public.schema_model_profile_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.schema_model_release r, jsonb_array_elements(r.body->'profiles') p
  WHERE r.id=NEW.model_id AND p->>'key'=NEW.key AND p->>'owner'=NEW.owner AND p=NEW.body)
 THEN RAISE EXCEPTION 'Profile differs from its compiled model' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER schema_model_profile_guard BEFORE INSERT ON public.schema_model_profile FOR EACH ROW EXECUTE FUNCTION public.schema_model_profile_guard();

CREATE OR REPLACE FUNCTION public.schema_model_binding_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.schema_model_profile p,jsonb_array_elements(p.body->CASE WHEN NEW.role='type' THEN 'types' ELSE 'properties' END) entry
 WHERE p.model_id=NEW.model_id AND p.key=NEW.profile_key
 AND EXISTS(SELECT 1 FROM public.schema_release_term meaning WHERE meaning.release_id=NEW.release_id AND meaning.term_id=NEW.term_id AND meaning.definition_id=NEW.definition_id)
 AND EXISTS(SELECT 1 FROM public.schema_model_release model,jsonb_array_elements(model.body->'sourceReleases') AS dependency(value) WHERE model.id=NEW.model_id AND (dependency.value->>'id')::uuid=NEW.release_id)
 AND coalesce(entry->>'termId',entry->>'predicateId')=NEW.term_id::text AND entry->>'definitionId'=NEW.definition_id::text AND entry->>'releaseId'=NEW.release_id::text)
 THEN RAISE EXCEPTION 'Binding differs from its compiled profile' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER schema_model_binding_guard BEFORE INSERT ON public.schema_model_binding FOR EACH ROW EXECUTE FUNCTION public.schema_model_binding_guard();

CREATE OR REPLACE FUNCTION public.schema_model_head_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE expected integer; actual integer;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Model selection version is retained' USING ERRCODE='23514'; END IF;
 IF (TG_OP='INSERT' AND NEW.version<>1) OR (TG_OP='UPDATE' AND (NEW.key<>OLD.key OR NEW.version<>OLD.version+1)) THEN RAISE EXCEPTION 'Model selection version must advance exactly once' USING ERRCODE='23514'; END IF;
 SELECT jsonb_array_length(body->'profiles') INTO expected FROM public.schema_model_release WHERE id=NEW.model_id;
 SELECT count(*) INTO actual FROM public.schema_model_profile WHERE model_id=NEW.model_id;
 IF expected IS NULL OR expected<>actual THEN RAISE EXCEPTION 'Model profile installation is incomplete' USING ERRCODE='23514'; END IF;
 SELECT coalesce(sum(jsonb_array_length(body->'types')+jsonb_array_length(body->'properties')),0) INTO expected FROM public.schema_model_profile WHERE model_id=NEW.model_id;
 SELECT count(*) INTO actual FROM public.schema_model_binding WHERE model_id=NEW.model_id;
 IF expected<>actual THEN RAISE EXCEPTION 'Model meaning bindings are incomplete' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.schema_model_release r,jsonb_array_elements(r.body->'sourceReleases') AS dependency(value)
 WHERE r.id=NEW.model_id AND NOT EXISTS(SELECT 1 FROM public.schema_release release WHERE release.id=(dependency.value->>'id')::uuid AND release.digest=dependency.value->>'digest')) THEN RAISE EXCEPTION 'Model source vocabulary is unavailable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER schema_model_head_guard BEFORE INSERT OR UPDATE OR DELETE ON public.schema_model_head FOR EACH ROW EXECUTE FUNCTION public.schema_model_head_guard();
