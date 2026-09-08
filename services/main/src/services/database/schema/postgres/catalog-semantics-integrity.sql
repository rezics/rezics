CREATE OR REPLACE FUNCTION public.catalog_guard_semantic_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 RAISE EXCEPTION 'Semantic revisions and their participants are immutable' USING ERRCODE='23514', CONSTRAINT='catalog_semantic_revision_immutable';
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_governed_value()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE definition jsonb; expected_kind text; rule jsonb; parent_rule integer; vocabulary jsonb;
BEGIN
 EXECUTE format('SELECT d.constraints,d.value_kind FROM public.%I f JOIN public.catalog_definition_revision d ON d.id=f.definition_revision_id WHERE f.owner_id=$1 AND f.id=$2',TG_ARGV[0]||'_fact') INTO definition,expected_kind USING NEW.owner_id,NEW.fact_id;
 IF definition ? 'rules' THEN
  rule:=definition->'rules'->NEW.rule_position;
  IF rule IS NULL OR (rule->>'position')::integer <> NEW.rule_position THEN RAISE EXCEPTION 'Unknown value rule' USING ERRCODE='23514'; END IF;
  expected_kind:=rule->>'kind';
  IF NEW.position=0 THEN
   IF NEW.rule_position<>0 THEN RAISE EXCEPTION 'Invalid root rule' USING ERRCODE='23514'; END IF;
  ELSE
   EXECUTE format('SELECT rule_position FROM public.%I WHERE owner_id=$1 AND fact_id=$2 AND position=$3',TG_ARGV[0]||'_fact_value_node') INTO parent_rule USING NEW.owner_id,NEW.fact_id,NEW.parent_position;
   IF parent_rule IS NULL OR (rule->>'parent')::integer IS DISTINCT FROM parent_rule OR rule->>'memberKey' IS DISTINCT FROM NEW.member_key THEN RAISE EXCEPTION 'Undeclared value member' USING ERRCODE='23514'; END IF;
  END IF;
 ELSE
  rule:=definition;
  IF NEW.position<>0 THEN RAISE EXCEPTION 'Scalar definition cannot accept descendants' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.kind='null' AND coalesce((rule->>'nullable')::boolean,false) THEN RETURN NEW; END IF;
 IF NEW.kind IS DISTINCT FROM expected_kind THEN RAISE EXCEPTION 'Wrong governed value type' USING ERRCODE='23514'; END IF;
 IF NEW.kind='number' AND ((rule ? 'minimum' AND NEW.number_value<(rule->>'minimum')::numeric) OR (rule ? 'maximum' AND NEW.number_value>(rule->>'maximum')::numeric) OR (coalesce((rule->>'integer')::boolean,false) AND (trunc(NEW.number_value)<>NEW.number_value OR abs(NEW.number_value)>9007199254740991))) THEN RAISE EXCEPTION 'Governed numeric bound violated' USING ERRCODE='23514'; END IF;
 IF NEW.kind='string' AND ((rule ? 'minLength' AND length(NEW.text_value)<(rule->>'minLength')::integer) OR (rule ? 'maxLength' AND length(NEW.text_value)>(rule->>'maxLength')::integer)) THEN RAISE EXCEPTION 'Governed text bound violated' USING ERRCODE='23514'; END IF;
 IF rule ? 'allowedValues' AND NOT (rule->'allowedValues' @> jsonb_build_array(CASE NEW.kind WHEN 'string' THEN to_jsonb(NEW.text_value) WHEN 'number' THEN to_jsonb(NEW.number_value) WHEN 'boolean' THEN to_jsonb(NEW.boolean_value) ELSE 'null'::jsonb END)) THEN RAISE EXCEPTION 'Value is not a governed member' USING ERRCODE='23514'; END IF;
 IF rule ? 'vocabularyRevisionId' THEN
  SELECT constraints INTO vocabulary FROM public.catalog_definition_revision WHERE id=(rule->>'vocabularyRevisionId')::uuid;
  IF NEW.kind<>'string' OR NOT (coalesce(vocabulary->'memberRevisionIds','[]'::jsonb) ? NEW.text_value) THEN RAISE EXCEPTION 'Value is not in the exact vocabulary revision' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_sealed_semantic()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE published boolean;
BEGIN
 IF TG_ARGV[1]='fact' THEN
  IF OLD.sealed_at IS NOT NULL AND (TG_OP='DELETE' OR NEW IS DISTINCT FROM OLD) THEN RAISE EXCEPTION 'Sealed facts are immutable' USING ERRCODE='23514', CONSTRAINT='catalog_fact_value_immutable'; END IF;
  IF TG_OP='UPDATE' AND (NEW.semantic_id<>OLD.semantic_id OR NEW.expected_head_version<>OLD.expected_head_version OR NEW.spoiler<>OLD.spoiler OR NEW.purpose<>OLD.purpose) THEN RAISE EXCEPTION 'Staged fact identity and purpose are immutable' USING ERRCODE='23514', CONSTRAINT='catalog_fact_identity_immutable'; END IF;
  RETURN NEW;
 END IF;
 EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE owner_id=$1 AND relation_id=$2)',TG_ARGV[0]||'_semantic_revision') INTO published USING NEW.owner_id,NEW.relation_id;
 IF published THEN RAISE EXCEPTION 'Published relation cannot gain participants or qualifiers' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_semantic_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE current_version bigint; target record; prior record; predicate jsonb; role jsonb; participant record; target_owner text; target_id uuid; target_shape text; role_count integer; total integer;
BEGIN
 EXECUTE format('SELECT id FROM public.%I WHERE id=$1 FOR UPDATE',TG_ARGV[0]||'_identity') USING NEW.owner_id;
 EXECUTE format('SELECT version FROM public.%I WHERE owner_id=$1 AND semantic_id=$2 FOR UPDATE',TG_ARGV[0]||'_semantic_head') INTO current_version USING NEW.owner_id,NEW.semantic_id;
 IF NEW.version<>coalesce(current_version,0)+1 THEN RAISE EXCEPTION 'Semantic head version conflict' USING ERRCODE='40001'; END IF;
 IF NEW.fact_id IS NOT NULL THEN
  EXECUTE format('SELECT semantic_id,sealed_at,purpose FROM public.%I WHERE owner_id=$1 AND id=$2',TG_ARGV[0]||'_fact') INTO target USING NEW.owner_id,NEW.fact_id;
  IF target.semantic_id IS DISTINCT FROM NEW.semantic_id OR target.sealed_at IS NULL THEN RAISE EXCEPTION 'Unsealed or wrong semantic fact' USING ERRCODE='23514'; END IF;
  IF current_version IS NOT NULL THEN
   EXECUTE format('SELECT r.fact_id,f.purpose FROM public.%I r LEFT JOIN public.%I f ON f.owner_id=r.owner_id AND f.id=r.fact_id WHERE r.owner_id=$1 AND r.semantic_id=$2 AND r.version=$3',TG_ARGV[0]||'_semantic_revision',TG_ARGV[0]||'_fact') INTO prior USING NEW.owner_id,NEW.semantic_id,current_version;
   IF prior.fact_id IS NULL OR prior.purpose IS DISTINCT FROM target.purpose THEN RAISE EXCEPTION 'Semantic fact purpose cannot change across revisions' USING ERRCODE='23514',CONSTRAINT='catalog_semantic_fact_purpose_immutable'; END IF;
  END IF;
 ELSE
  IF current_version IS NOT NULL THEN
   EXECUTE format('SELECT fact_id FROM public.%I WHERE owner_id=$1 AND semantic_id=$2 AND version=$3',TG_ARGV[0]||'_semantic_revision') INTO prior USING NEW.owner_id,NEW.semantic_id,current_version;
   IF prior.fact_id IS NOT NULL THEN RAISE EXCEPTION 'A fact semantic cannot become a relation' USING ERRCODE='23514',CONSTRAINT='catalog_semantic_fact_purpose_immutable'; END IF;
  END IF;
  EXECUTE format('SELECT r.semantic_id,d.constraints FROM public.%I r JOIN public.catalog_definition_revision d ON d.id=r.definition_revision_id WHERE r.owner_id=$1 AND r.id=$2',TG_ARGV[0]||'_catalog_relation') INTO target USING NEW.owner_id,NEW.relation_id;
  IF target.semantic_id IS DISTINCT FROM NEW.semantic_id THEN RAISE EXCEPTION 'Wrong semantic relation' USING ERRCODE='23514'; END IF;
  predicate:=target.constraints;
  IF jsonb_array_length(coalesce(predicate->'roles','[]'::jsonb))=0 THEN RAISE EXCEPTION 'Predicate roles missing' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT count(*) FROM (SELECT 1 FROM public.%I WHERE owner_id=$1 AND relation_id=$2 LIMIT 129) p',TG_ARGV[0]||'_relation_participant') INTO total USING NEW.owner_id,NEW.relation_id;
  IF total>128 THEN RAISE EXCEPTION 'Relation participant budget exceeded' USING ERRCODE='23514'; END IF;
  FOR role IN SELECT value FROM jsonb_array_elements(predicate->'roles') LOOP
   EXECUTE format('SELECT count(*) FROM public.%I WHERE owner_id=$1 AND relation_id=$2 AND role_revision_id=$3',TG_ARGV[0]||'_relation_participant') INTO role_count USING NEW.owner_id,NEW.relation_id,(role->>'roleRevisionId')::uuid;
   IF role_count<(role->>'min')::integer OR role_count>(role->>'max')::integer THEN RAISE EXCEPTION 'Predicate cardinality violated' USING ERRCODE='23514'; END IF;
  END LOOP;
  FOR participant IN EXECUTE format('SELECT to_jsonb(p) AS data FROM public.%I p WHERE owner_id=$1 AND relation_id=$2 LIMIT 129',TG_ARGV[0]||'_relation_participant') USING NEW.owner_id,NEW.relation_id LOOP
   SELECT value INTO role FROM jsonb_array_elements(predicate->'roles') WHERE value->>'roleRevisionId'=participant.data->>'role_revision_id';
   IF role IS NULL THEN RAISE EXCEPTION 'Undeclared predicate role' USING ERRCODE='23514'; END IF;
   FOREACH target_owner IN ARRAY ARRAY['publishing','music','program','software','entity','grouping','reference','distribution'] LOOP
    target_id:=(participant.data->>(target_owner||'_id'))::uuid;
    IF target_id IS NOT NULL THEN
     EXECUTE format('SELECT shape FROM public.%I WHERE id=$1',target_owner||'_identity') INTO target_shape USING target_id;
     IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(role->'targets') t WHERE t->>'owner'=target_owner AND t->'shapes' ? target_shape) THEN RAISE EXCEPTION 'Predicate target shape violated' USING ERRCODE='23514'; END IF;
    END IF;
   END LOOP;
  END LOOP;
  EXECUTE format('SELECT count(*) FROM (SELECT 1 FROM public.%I WHERE owner_id=$1 AND relation_id=$2 LIMIT 65) q',TG_ARGV[0]||'_relation_scope') INTO total USING NEW.owner_id,NEW.relation_id;
  IF total>64 THEN RAISE EXCEPTION 'Relation qualifier budget exceeded' USING ERRCODE='23514'; END IF;
  FOR target IN EXECUTE format('SELECT q.definition_revision_id,f.definition_revision_id AS fact_definition,f.sealed_at FROM public.%I q JOIN public.%I f ON f.owner_id=q.owner_id AND f.id=q.value_fact_id WHERE q.owner_id=$1 AND q.relation_id=$2 LIMIT 65',TG_ARGV[0]||'_relation_scope',TG_ARGV[0]||'_fact') USING NEW.owner_id,NEW.relation_id LOOP
   IF NOT (coalesce(predicate->'qualifierRevisionIds','[]'::jsonb) ? target.definition_revision_id::text) OR target.fact_definition<>target.definition_revision_id OR target.sealed_at IS NULL THEN RAISE EXCEPTION 'Undeclared or unsealed relation qualifier' USING ERRCODE='23514'; END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_require_semantic_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE current_version bigint;
BEGIN
 EXECUTE format('SELECT version FROM public.%I WHERE owner_id=$1 AND semantic_id=$2',TG_ARGV[0]||'_semantic_head') INTO current_version USING NEW.owner_id,NEW.semantic_id;
 IF current_version IS NULL OR current_version<NEW.version THEN RAISE EXCEPTION 'Immutable semantic revision must publish an atomic head' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS publishing_semantic_revision_immutable ON public.publishing_semantic_revision;
CREATE TRIGGER publishing_semantic_revision_immutable BEFORE UPDATE OR DELETE ON public.publishing_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS publishing_catalog_relation_immutable ON public.publishing_catalog_relation;
CREATE TRIGGER publishing_catalog_relation_immutable BEFORE UPDATE OR DELETE ON public.publishing_catalog_relation FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS publishing_relation_participant_immutable ON public.publishing_relation_participant;
CREATE TRIGGER publishing_relation_participant_immutable BEFORE UPDATE OR DELETE ON public.publishing_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS publishing_relation_scope_immutable ON public.publishing_relation_scope;
CREATE TRIGGER publishing_relation_scope_immutable BEFORE UPDATE OR DELETE ON public.publishing_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS publishing_fact_value_node_governance ON public.publishing_fact_value_node;
CREATE TRIGGER publishing_fact_value_node_governance BEFORE INSERT ON public.publishing_fact_value_node FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_governed_value('publishing');

DROP TRIGGER IF EXISTS publishing_fact_sealed_semantic ON public.publishing_fact;
CREATE TRIGGER publishing_fact_sealed_semantic BEFORE UPDATE OR DELETE ON public.publishing_fact FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('publishing','fact');

DROP TRIGGER IF EXISTS publishing_relation_participant_sealed_semantic ON public.publishing_relation_participant;
CREATE TRIGGER publishing_relation_participant_sealed_semantic BEFORE INSERT ON public.publishing_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('publishing','relation');

DROP TRIGGER IF EXISTS publishing_relation_scope_sealed_semantic ON public.publishing_relation_scope;
CREATE TRIGGER publishing_relation_scope_sealed_semantic BEFORE INSERT ON public.publishing_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('publishing','relation');

DROP TRIGGER IF EXISTS publishing_semantic_revision_governance ON public.publishing_semantic_revision;
CREATE TRIGGER publishing_semantic_revision_governance BEFORE INSERT ON public.publishing_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_revision('publishing');

DROP TRIGGER IF EXISTS publishing_semantic_revision_head ON public.publishing_semantic_revision;
CREATE CONSTRAINT TRIGGER publishing_semantic_revision_head AFTER INSERT ON public.publishing_semantic_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_semantic_head('publishing');

DROP TRIGGER IF EXISTS music_semantic_revision_immutable ON public.music_semantic_revision;
CREATE TRIGGER music_semantic_revision_immutable BEFORE UPDATE OR DELETE ON public.music_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS music_catalog_relation_immutable ON public.music_catalog_relation;
CREATE TRIGGER music_catalog_relation_immutable BEFORE UPDATE OR DELETE ON public.music_catalog_relation FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS music_relation_participant_immutable ON public.music_relation_participant;
CREATE TRIGGER music_relation_participant_immutable BEFORE UPDATE OR DELETE ON public.music_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS music_relation_scope_immutable ON public.music_relation_scope;
CREATE TRIGGER music_relation_scope_immutable BEFORE UPDATE OR DELETE ON public.music_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS music_fact_value_node_governance ON public.music_fact_value_node;
CREATE TRIGGER music_fact_value_node_governance BEFORE INSERT ON public.music_fact_value_node FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_governed_value('music');

DROP TRIGGER IF EXISTS music_fact_sealed_semantic ON public.music_fact;
CREATE TRIGGER music_fact_sealed_semantic BEFORE UPDATE OR DELETE ON public.music_fact FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('music','fact');

DROP TRIGGER IF EXISTS music_relation_participant_sealed_semantic ON public.music_relation_participant;
CREATE TRIGGER music_relation_participant_sealed_semantic BEFORE INSERT ON public.music_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('music','relation');

DROP TRIGGER IF EXISTS music_relation_scope_sealed_semantic ON public.music_relation_scope;
CREATE TRIGGER music_relation_scope_sealed_semantic BEFORE INSERT ON public.music_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('music','relation');

DROP TRIGGER IF EXISTS music_semantic_revision_governance ON public.music_semantic_revision;
CREATE TRIGGER music_semantic_revision_governance BEFORE INSERT ON public.music_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_revision('music');

DROP TRIGGER IF EXISTS music_semantic_revision_head ON public.music_semantic_revision;
CREATE CONSTRAINT TRIGGER music_semantic_revision_head AFTER INSERT ON public.music_semantic_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_semantic_head('music');

DROP TRIGGER IF EXISTS program_semantic_revision_immutable ON public.program_semantic_revision;
CREATE TRIGGER program_semantic_revision_immutable BEFORE UPDATE OR DELETE ON public.program_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS program_catalog_relation_immutable ON public.program_catalog_relation;
CREATE TRIGGER program_catalog_relation_immutable BEFORE UPDATE OR DELETE ON public.program_catalog_relation FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS program_relation_participant_immutable ON public.program_relation_participant;
CREATE TRIGGER program_relation_participant_immutable BEFORE UPDATE OR DELETE ON public.program_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS program_relation_scope_immutable ON public.program_relation_scope;
CREATE TRIGGER program_relation_scope_immutable BEFORE UPDATE OR DELETE ON public.program_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS program_fact_value_node_governance ON public.program_fact_value_node;
CREATE TRIGGER program_fact_value_node_governance BEFORE INSERT ON public.program_fact_value_node FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_governed_value('program');

DROP TRIGGER IF EXISTS program_fact_sealed_semantic ON public.program_fact;
CREATE TRIGGER program_fact_sealed_semantic BEFORE UPDATE OR DELETE ON public.program_fact FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('program','fact');

DROP TRIGGER IF EXISTS program_relation_participant_sealed_semantic ON public.program_relation_participant;
CREATE TRIGGER program_relation_participant_sealed_semantic BEFORE INSERT ON public.program_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('program','relation');

DROP TRIGGER IF EXISTS program_relation_scope_sealed_semantic ON public.program_relation_scope;
CREATE TRIGGER program_relation_scope_sealed_semantic BEFORE INSERT ON public.program_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('program','relation');

DROP TRIGGER IF EXISTS program_semantic_revision_governance ON public.program_semantic_revision;
CREATE TRIGGER program_semantic_revision_governance BEFORE INSERT ON public.program_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_revision('program');

DROP TRIGGER IF EXISTS program_semantic_revision_head ON public.program_semantic_revision;
CREATE CONSTRAINT TRIGGER program_semantic_revision_head AFTER INSERT ON public.program_semantic_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_semantic_head('program');

DROP TRIGGER IF EXISTS software_semantic_revision_immutable ON public.software_semantic_revision;
CREATE TRIGGER software_semantic_revision_immutable BEFORE UPDATE OR DELETE ON public.software_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS software_catalog_relation_immutable ON public.software_catalog_relation;
CREATE TRIGGER software_catalog_relation_immutable BEFORE UPDATE OR DELETE ON public.software_catalog_relation FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS software_relation_participant_immutable ON public.software_relation_participant;
CREATE TRIGGER software_relation_participant_immutable BEFORE UPDATE OR DELETE ON public.software_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS software_relation_scope_immutable ON public.software_relation_scope;
CREATE TRIGGER software_relation_scope_immutable BEFORE UPDATE OR DELETE ON public.software_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS software_fact_value_node_governance ON public.software_fact_value_node;
CREATE TRIGGER software_fact_value_node_governance BEFORE INSERT ON public.software_fact_value_node FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_governed_value('software');

DROP TRIGGER IF EXISTS software_fact_sealed_semantic ON public.software_fact;
CREATE TRIGGER software_fact_sealed_semantic BEFORE UPDATE OR DELETE ON public.software_fact FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('software','fact');

DROP TRIGGER IF EXISTS software_relation_participant_sealed_semantic ON public.software_relation_participant;
CREATE TRIGGER software_relation_participant_sealed_semantic BEFORE INSERT ON public.software_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('software','relation');

DROP TRIGGER IF EXISTS software_relation_scope_sealed_semantic ON public.software_relation_scope;
CREATE TRIGGER software_relation_scope_sealed_semantic BEFORE INSERT ON public.software_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('software','relation');

DROP TRIGGER IF EXISTS software_semantic_revision_governance ON public.software_semantic_revision;
CREATE TRIGGER software_semantic_revision_governance BEFORE INSERT ON public.software_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_revision('software');

DROP TRIGGER IF EXISTS software_semantic_revision_head ON public.software_semantic_revision;
CREATE CONSTRAINT TRIGGER software_semantic_revision_head AFTER INSERT ON public.software_semantic_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_semantic_head('software');

DROP TRIGGER IF EXISTS entity_semantic_revision_immutable ON public.entity_semantic_revision;
CREATE TRIGGER entity_semantic_revision_immutable BEFORE UPDATE OR DELETE ON public.entity_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS entity_catalog_relation_immutable ON public.entity_catalog_relation;
CREATE TRIGGER entity_catalog_relation_immutable BEFORE UPDATE OR DELETE ON public.entity_catalog_relation FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS entity_relation_participant_immutable ON public.entity_relation_participant;
CREATE TRIGGER entity_relation_participant_immutable BEFORE UPDATE OR DELETE ON public.entity_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS entity_relation_scope_immutable ON public.entity_relation_scope;
CREATE TRIGGER entity_relation_scope_immutable BEFORE UPDATE OR DELETE ON public.entity_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS entity_fact_value_node_governance ON public.entity_fact_value_node;
CREATE TRIGGER entity_fact_value_node_governance BEFORE INSERT ON public.entity_fact_value_node FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_governed_value('entity');

DROP TRIGGER IF EXISTS entity_fact_sealed_semantic ON public.entity_fact;
CREATE TRIGGER entity_fact_sealed_semantic BEFORE UPDATE OR DELETE ON public.entity_fact FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('entity','fact');

DROP TRIGGER IF EXISTS entity_relation_participant_sealed_semantic ON public.entity_relation_participant;
CREATE TRIGGER entity_relation_participant_sealed_semantic BEFORE INSERT ON public.entity_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('entity','relation');

DROP TRIGGER IF EXISTS entity_relation_scope_sealed_semantic ON public.entity_relation_scope;
CREATE TRIGGER entity_relation_scope_sealed_semantic BEFORE INSERT ON public.entity_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('entity','relation');

DROP TRIGGER IF EXISTS entity_semantic_revision_governance ON public.entity_semantic_revision;
CREATE TRIGGER entity_semantic_revision_governance BEFORE INSERT ON public.entity_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_revision('entity');

DROP TRIGGER IF EXISTS entity_semantic_revision_head ON public.entity_semantic_revision;
CREATE CONSTRAINT TRIGGER entity_semantic_revision_head AFTER INSERT ON public.entity_semantic_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_semantic_head('entity');

DROP TRIGGER IF EXISTS grouping_semantic_revision_immutable ON public.grouping_semantic_revision;
CREATE TRIGGER grouping_semantic_revision_immutable BEFORE UPDATE OR DELETE ON public.grouping_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS grouping_catalog_relation_immutable ON public.grouping_catalog_relation;
CREATE TRIGGER grouping_catalog_relation_immutable BEFORE UPDATE OR DELETE ON public.grouping_catalog_relation FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS grouping_relation_participant_immutable ON public.grouping_relation_participant;
CREATE TRIGGER grouping_relation_participant_immutable BEFORE UPDATE OR DELETE ON public.grouping_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS grouping_relation_scope_immutable ON public.grouping_relation_scope;
CREATE TRIGGER grouping_relation_scope_immutable BEFORE UPDATE OR DELETE ON public.grouping_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS grouping_fact_value_node_governance ON public.grouping_fact_value_node;
CREATE TRIGGER grouping_fact_value_node_governance BEFORE INSERT ON public.grouping_fact_value_node FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_governed_value('grouping');

DROP TRIGGER IF EXISTS grouping_fact_sealed_semantic ON public.grouping_fact;
CREATE TRIGGER grouping_fact_sealed_semantic BEFORE UPDATE OR DELETE ON public.grouping_fact FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('grouping','fact');

DROP TRIGGER IF EXISTS grouping_relation_participant_sealed_semantic ON public.grouping_relation_participant;
CREATE TRIGGER grouping_relation_participant_sealed_semantic BEFORE INSERT ON public.grouping_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('grouping','relation');

DROP TRIGGER IF EXISTS grouping_relation_scope_sealed_semantic ON public.grouping_relation_scope;
CREATE TRIGGER grouping_relation_scope_sealed_semantic BEFORE INSERT ON public.grouping_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('grouping','relation');

DROP TRIGGER IF EXISTS grouping_semantic_revision_governance ON public.grouping_semantic_revision;
CREATE TRIGGER grouping_semantic_revision_governance BEFORE INSERT ON public.grouping_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_revision('grouping');

DROP TRIGGER IF EXISTS grouping_semantic_revision_head ON public.grouping_semantic_revision;
CREATE CONSTRAINT TRIGGER grouping_semantic_revision_head AFTER INSERT ON public.grouping_semantic_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_semantic_head('grouping');

DROP TRIGGER IF EXISTS reference_semantic_revision_immutable ON public.reference_semantic_revision;
CREATE TRIGGER reference_semantic_revision_immutable BEFORE UPDATE OR DELETE ON public.reference_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS reference_catalog_relation_immutable ON public.reference_catalog_relation;
CREATE TRIGGER reference_catalog_relation_immutable BEFORE UPDATE OR DELETE ON public.reference_catalog_relation FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS reference_relation_participant_immutable ON public.reference_relation_participant;
CREATE TRIGGER reference_relation_participant_immutable BEFORE UPDATE OR DELETE ON public.reference_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS reference_relation_scope_immutable ON public.reference_relation_scope;
CREATE TRIGGER reference_relation_scope_immutable BEFORE UPDATE OR DELETE ON public.reference_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS reference_fact_value_node_governance ON public.reference_fact_value_node;
CREATE TRIGGER reference_fact_value_node_governance BEFORE INSERT ON public.reference_fact_value_node FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_governed_value('reference');

DROP TRIGGER IF EXISTS reference_fact_sealed_semantic ON public.reference_fact;
CREATE TRIGGER reference_fact_sealed_semantic BEFORE UPDATE OR DELETE ON public.reference_fact FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('reference','fact');

DROP TRIGGER IF EXISTS reference_relation_participant_sealed_semantic ON public.reference_relation_participant;
CREATE TRIGGER reference_relation_participant_sealed_semantic BEFORE INSERT ON public.reference_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('reference','relation');

DROP TRIGGER IF EXISTS reference_relation_scope_sealed_semantic ON public.reference_relation_scope;
CREATE TRIGGER reference_relation_scope_sealed_semantic BEFORE INSERT ON public.reference_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('reference','relation');

DROP TRIGGER IF EXISTS reference_semantic_revision_governance ON public.reference_semantic_revision;
CREATE TRIGGER reference_semantic_revision_governance BEFORE INSERT ON public.reference_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_revision('reference');

DROP TRIGGER IF EXISTS reference_semantic_revision_head ON public.reference_semantic_revision;
CREATE CONSTRAINT TRIGGER reference_semantic_revision_head AFTER INSERT ON public.reference_semantic_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_semantic_head('reference');

DROP TRIGGER IF EXISTS distribution_semantic_revision_immutable ON public.distribution_semantic_revision;
CREATE TRIGGER distribution_semantic_revision_immutable BEFORE UPDATE OR DELETE ON public.distribution_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS distribution_catalog_relation_immutable ON public.distribution_catalog_relation;
CREATE TRIGGER distribution_catalog_relation_immutable BEFORE UPDATE OR DELETE ON public.distribution_catalog_relation FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS distribution_relation_participant_immutable ON public.distribution_relation_participant;
CREATE TRIGGER distribution_relation_participant_immutable BEFORE UPDATE OR DELETE ON public.distribution_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS distribution_relation_scope_immutable ON public.distribution_relation_scope;
CREATE TRIGGER distribution_relation_scope_immutable BEFORE UPDATE OR DELETE ON public.distribution_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS distribution_fact_value_node_governance ON public.distribution_fact_value_node;
CREATE TRIGGER distribution_fact_value_node_governance BEFORE INSERT ON public.distribution_fact_value_node FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_governed_value('distribution');

DROP TRIGGER IF EXISTS distribution_fact_sealed_semantic ON public.distribution_fact;
CREATE TRIGGER distribution_fact_sealed_semantic BEFORE UPDATE OR DELETE ON public.distribution_fact FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('distribution','fact');

DROP TRIGGER IF EXISTS distribution_relation_participant_sealed_semantic ON public.distribution_relation_participant;
CREATE TRIGGER distribution_relation_participant_sealed_semantic BEFORE INSERT ON public.distribution_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('distribution','relation');

DROP TRIGGER IF EXISTS distribution_relation_scope_sealed_semantic ON public.distribution_relation_scope;
CREATE TRIGGER distribution_relation_scope_sealed_semantic BEFORE INSERT ON public.distribution_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('distribution','relation');

DROP TRIGGER IF EXISTS distribution_semantic_revision_governance ON public.distribution_semantic_revision;
CREATE TRIGGER distribution_semantic_revision_governance BEFORE INSERT ON public.distribution_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_revision('distribution');

DROP TRIGGER IF EXISTS distribution_semantic_revision_head ON public.distribution_semantic_revision;
CREATE CONSTRAINT TRIGGER distribution_semantic_revision_head AFTER INSERT ON public.distribution_semantic_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_semantic_head('distribution');
CREATE OR REPLACE FUNCTION public.catalog_guard_semantic_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF TG_OP='DELETE' OR (TG_OP='UPDATE' AND (NEW.owner_id<>OLD.owner_id OR NEW.semantic_id<>OLD.semantic_id OR NEW.version<>OLD.version+1)) OR (TG_OP='INSERT' AND NEW.version<>1) THEN RAISE EXCEPTION 'Semantic head must advance one immutable revision' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS publishing_semantic_head_governance ON public.publishing_semantic_head;
CREATE TRIGGER publishing_semantic_head_governance BEFORE INSERT OR UPDATE OR DELETE ON public.publishing_semantic_head FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_head();

DROP TRIGGER IF EXISTS music_semantic_head_governance ON public.music_semantic_head;
CREATE TRIGGER music_semantic_head_governance BEFORE INSERT OR UPDATE OR DELETE ON public.music_semantic_head FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_head();

DROP TRIGGER IF EXISTS program_semantic_head_governance ON public.program_semantic_head;
CREATE TRIGGER program_semantic_head_governance BEFORE INSERT OR UPDATE OR DELETE ON public.program_semantic_head FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_head();

DROP TRIGGER IF EXISTS software_semantic_head_governance ON public.software_semantic_head;
CREATE TRIGGER software_semantic_head_governance BEFORE INSERT OR UPDATE OR DELETE ON public.software_semantic_head FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_head();

DROP TRIGGER IF EXISTS entity_semantic_head_governance ON public.entity_semantic_head;
CREATE TRIGGER entity_semantic_head_governance BEFORE INSERT OR UPDATE OR DELETE ON public.entity_semantic_head FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_head();

DROP TRIGGER IF EXISTS grouping_semantic_head_governance ON public.grouping_semantic_head;
CREATE TRIGGER grouping_semantic_head_governance BEFORE INSERT OR UPDATE OR DELETE ON public.grouping_semantic_head FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_head();

DROP TRIGGER IF EXISTS reference_semantic_head_governance ON public.reference_semantic_head;
CREATE TRIGGER reference_semantic_head_governance BEFORE INSERT OR UPDATE OR DELETE ON public.reference_semantic_head FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_head();

DROP TRIGGER IF EXISTS distribution_semantic_head_governance ON public.distribution_semantic_head;
CREATE TRIGGER distribution_semantic_head_governance BEFORE INSERT OR UPDATE OR DELETE ON public.distribution_semantic_head FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_head();

CREATE OR REPLACE FUNCTION public.catalog_guard_definition_constraints()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE kind text; rule jsonb; role jsonb; reference_id text; reference_kind text; rule_position integer:=0; parent_rule jsonb;
BEGIN
 SELECT d.kind INTO kind FROM public.catalog_definition d WHERE d.id=NEW.definition_id;
 IF kind='predicate' AND (jsonb_typeof(NEW.constraints->'roles') IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.constraints->'roles') NOT BETWEEN 1 AND 32) THEN RAISE EXCEPTION 'Predicate needs bounded roles' USING ERRCODE='23514'; END IF;
 IF NEW.value_kind IN ('object','array') AND (jsonb_typeof(NEW.constraints->'rules') IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.constraints->'rules') NOT BETWEEN 1 AND 128) THEN RAISE EXCEPTION 'Structured property needs bounded grammar' USING ERRCODE='23514'; END IF;
 FOR rule IN SELECT value FROM jsonb_array_elements(coalesce(NEW.constraints->'rules','[]'::jsonb)) LOOP
  IF (rule->>'position')::integer IS DISTINCT FROM rule_position OR (rule_position=0 AND (rule->>'parent' IS NOT NULL OR rule->>'memberKey' IS NOT NULL OR rule->>'kind'<>NEW.value_kind)) OR (rule_position>0 AND ((rule->>'parent')::integer IS NULL OR (rule->>'parent')::integer NOT BETWEEN 0 AND rule_position-1)) THEN RAISE EXCEPTION 'Invalid governed grammar order' USING ERRCODE='23514'; END IF;
  IF rule_position>0 THEN
   parent_rule:=NEW.constraints->'rules'->((rule->>'parent')::integer);
   IF parent_rule->>'kind' NOT IN ('object','array') OR (parent_rule->>'kind'='array')<>(rule->>'memberKey' IS NULL) THEN RAISE EXCEPTION 'Governed grammar parent mismatch' USING ERRCODE='23514'; END IF;
  END IF;
  rule_position:=rule_position+1;
 END LOOP;
 FOR role IN SELECT value FROM jsonb_array_elements(coalesce(NEW.constraints->'roles','[]'::jsonb)) LOOP
  SELECT d.kind INTO reference_kind FROM public.catalog_definition_revision r JOIN public.catalog_definition d ON d.id=r.definition_id WHERE r.id=(role->>'roleRevisionId')::uuid;
  IF reference_kind IS DISTINCT FROM 'role' OR role->>'min' IS NULL OR role->>'max' IS NULL OR (role->>'min')::integer NOT BETWEEN 0 AND 128 OR (role->>'max')::integer NOT BETWEEN 1 AND 128 OR (role->>'min')::integer>(role->>'max')::integer THEN RAISE EXCEPTION 'Invalid governed predicate role' USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR reference_id IN SELECT value FROM jsonb_array_elements_text(coalesce(NEW.constraints->'qualifierRevisionIds','[]'::jsonb)) LOOP
  SELECT d.kind INTO reference_kind FROM public.catalog_definition_revision r JOIN public.catalog_definition d ON d.id=r.definition_id WHERE r.id=reference_id::uuid;
  IF reference_kind IS DISTINCT FROM 'property' THEN RAISE EXCEPTION 'Qualifier must name a property revision' USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR reference_id IN SELECT value FROM jsonb_array_elements_text(coalesce(NEW.constraints->'memberRevisionIds','[]'::jsonb)) LOOP
  SELECT d.kind INTO reference_kind FROM public.catalog_definition_revision r JOIN public.catalog_definition d ON d.id=r.definition_id WHERE r.id=reference_id::uuid;
  IF reference_kind IS NULL OR reference_kind NOT IN ('class','vocabulary') THEN RAISE EXCEPTION 'Vocabulary member must exist as a governed meaning' USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR reference_id IN SELECT v FROM (SELECT NEW.constraints->>'vocabularyRevisionId' AS v UNION SELECT value->>'vocabularyRevisionId' FROM jsonb_array_elements(coalesce(NEW.constraints->'rules','[]'::jsonb))) q WHERE v IS NOT NULL LOOP
  SELECT d.kind INTO reference_kind FROM public.catalog_definition_revision r JOIN public.catalog_definition d ON d.id=r.definition_id WHERE r.id=reference_id::uuid;
  IF reference_kind IS DISTINCT FROM 'vocabulary' THEN RAISE EXCEPTION 'Vocabulary reference must name a vocabulary revision' USING ERRCODE='23514'; END IF;
 END LOOP;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS catalog_definition_revision_governance ON public.catalog_definition_revision;
CREATE TRIGGER catalog_definition_revision_governance BEFORE INSERT ON public.catalog_definition_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_definition_constraints();
