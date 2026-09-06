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
