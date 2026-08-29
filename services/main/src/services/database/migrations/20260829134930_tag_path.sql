SET search_path TO public;

-- Structural Tag Paths, immutable semantic definitions, global Applications,
-- and definition-scale inference closure. Path length never drives Unit fan-out.

CREATE OR REPLACE FUNCTION public.guard_tag_path_definition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	member_count integer;
	valid_relation_count integer;
BEGIN
	IF TG_OP <> 'INSERT' THEN
		RAISE EXCEPTION 'Tag Path definitions are immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_definition_immutable';
	END IF;
	IF NOT EXISTS (
		SELECT 1 FROM public.unit WHERE id = NEW.id AND kind = 'tag_path'
	) THEN
		RAISE EXCEPTION 'Tag Path identity must reference a tag_path Unit'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_unit_kind';
	END IF;
	SELECT count(DISTINCT node.id)
	INTO member_count
	FROM unnest(NEW.member_node_ids) AS member(node_id)
	JOIN public.vocabulary_node AS node ON node.id = member.node_id
	WHERE node.status = 'active';
	IF member_count <> cardinality(NEW.member_node_ids) THEN
		RAISE EXCEPTION 'Every Path member must be a distinct active vocabulary node'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_member_eligibility';
	END IF;
	SELECT count(*)
	INTO valid_relation_count
	FROM generate_subscripts(NEW.relation_ids, 1) AS position(ordinal)
	JOIN public.tag_relation AS relation
		ON relation.id = NEW.relation_ids[position.ordinal]
		AND relation.parent_node_id = NEW.member_node_ids[position.ordinal]
		AND relation.child_node_id = NEW.member_node_ids[position.ordinal + 1]
		AND relation.status = 'active';
	IF valid_relation_count <> cardinality(NEW.relation_ids) THEN
		RAISE EXCEPTION 'Every Path edge must reference the active typed relation between adjacent nodes'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_relation_adjacency';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.project_tag_path_definition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	INSERT INTO public.tag_path_member(path_id, ordinal, node_id, incoming_relation_id)
	SELECT NEW.id,
		member.ordinality - 1,
		member.node_id,
		CASE WHEN member.ordinality = 1 THEN NULL
			ELSE NEW.relation_ids[member.ordinality - 1]
		END
	FROM unnest(NEW.member_node_ids) WITH ORDINALITY AS member(node_id, ordinality);
	INSERT INTO public.tag_path_vote_stat(path_id, terminal_node_id)
	VALUES (NEW.id, NEW.terminal_node_id);
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_path_projection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF pg_trigger_depth() < 2 THEN
		RAISE EXCEPTION '% is a rebuildable Tag Path projection', TG_TABLE_NAME
			USING ERRCODE = '23514', CONSTRAINT = TG_TABLE_NAME || '_projection_only';
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_path_vote_stat_projection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF pg_trigger_depth() < 2 THEN
		RAISE EXCEPTION 'tag_path_vote_stat is a trigger-owned ranking projection'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_vote_stat_projection_only';
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_vocabulary_node_path_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM public.tag_path_member WHERE node_id = OLD.id LIMIT 1
	) AND (TG_OP = 'DELETE' OR NEW.status <> 'active' OR NEW.kind <> OLD.kind) THEN
		RAISE EXCEPTION 'A vocabulary node used by a Path cannot be deleted, retired, or retyped'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_member_lifecycle';
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_relation_path_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM public.tag_path_member WHERE incoming_relation_id = OLD.id LIMIT 1
	) AND (
		TG_OP = 'DELETE' OR NEW.status <> 'active'
		OR (NEW.parent_node_id, NEW.child_node_id, NEW.relation_kind, NEW.revision)
			IS DISTINCT FROM
			(OLD.parent_node_id, OLD.child_node_id, OLD.relation_kind, OLD.revision)
	) THEN
		RAISE EXCEPTION 'A typed relation used by a Path is immutable and active'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_relation_lifecycle';
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_relation_graph()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	replaced_relation_id uuid := CASE WHEN TG_OP = 'UPDATE' THEN OLD.id ELSE NULL END;
BEGIN
	IF NEW.status <> 'active' THEN RETURN NEW; END IF;
	-- Relation writes are definition-scale and rare. Serializing them closes the
	-- write-skew window in which two concurrent inverse edges could both pass a
	-- read-only cycle check.
	PERFORM pg_advisory_xact_lock(hashtextextended('tag-relation-graph'::text, 0));
	IF EXISTS (
		WITH RECURSIVE descendant(node_id) AS (
			SELECT NEW.child_node_id
			UNION
			SELECT relation.child_node_id
			FROM descendant
			JOIN public.tag_relation AS relation
				ON relation.parent_node_id = descendant.node_id
			WHERE relation.status = 'active'
				AND (replaced_relation_id IS NULL OR relation.id <> replaced_relation_id)
		)
		SELECT 1 FROM descendant WHERE node_id = NEW.parent_node_id
	) THEN
		RAISE EXCEPTION 'Tag relation would create a vocabulary cycle'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_relation_cycle';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_tag_path_vote_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.path_id ELSE NEW.path_id END;
	score_delta bigint := 0;
	count_delta bigint := 0;
BEGIN
	PERFORM public.lock_vote_hot_key('tag_path_vote:' || key_id::text, 0);
	IF TG_OP <> 'INSERT' THEN
		score_delta := score_delta - OLD.value;
		count_delta := count_delta - 1;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		score_delta := score_delta + NEW.value;
		count_delta := count_delta + 1;
	END IF;
	UPDATE public.tag_path_vote_stat
	SET score = score + score_delta,
		vote_count = vote_count + count_delta,
		updated_at = clock_timestamp()
	WHERE path_id = key_id;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_expression_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'Tag Expression history is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_immutable';
	END IF;
	IF (
		OLD.id, OLD.expression_kind, OLD.canonical_claim_key, OLD.focus_tag_id,
		OLD.created_by_profile_id, OLD.created_at
	) IS DISTINCT FROM (
		NEW.id, NEW.expression_kind, NEW.canonical_claim_key, NEW.focus_tag_id,
		NEW.created_by_profile_id, NEW.created_at
	) THEN
		RAISE EXCEPTION 'Tag Expression semantics are immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_semantics_immutable';
	END IF;
	IF OLD.sealed_at IS NULL AND NEW.sealed_at IS NOT NULL
		AND OLD.status = NEW.status AND OLD.retired_at IS NOT DISTINCT FROM NEW.retired_at THEN
		RETURN NEW;
	END IF;
	IF OLD.sealed_at IS NOT NULL AND NEW.sealed_at = OLD.sealed_at
		AND OLD.status = 'active' AND NEW.status = 'retired'
		AND OLD.retired_at IS NULL AND NEW.retired_at IS NOT NULL THEN
		RETURN NEW;
	END IF;
	RAISE EXCEPTION 'Invalid Tag Expression lifecycle transition'
		USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_lifecycle';
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_expression_argument_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF TG_OP <> 'INSERT' OR EXISTS (
		SELECT 1 FROM public.tag_expression
		WHERE id = NEW.expression_id AND sealed_at IS NOT NULL
	) THEN
		RAISE EXCEPTION 'Sealed Tag Expression arguments are immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_argument_immutable';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_expression_presentation_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'Tag Expression presentation history is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_presentation_immutable';
	END IF;
	IF (
		OLD.id, OLD.expression_id, OLD.revision, OLD.created_by_profile_id, OLD.created_at
	) IS DISTINCT FROM (
		NEW.id, NEW.expression_id, NEW.revision, NEW.created_by_profile_id, NEW.created_at
	) THEN
		RAISE EXCEPTION 'Presentation revision identity is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_presentation_identity_immutable';
	END IF;
	IF OLD.sealed_at IS NULL AND NEW.sealed_at IS NOT NULL
		AND OLD.status = NEW.status AND OLD.retired_at IS NOT DISTINCT FROM NEW.retired_at THEN
		RETURN NEW;
	END IF;
	IF OLD.sealed_at IS NOT NULL AND NEW.sealed_at = OLD.sealed_at
		AND OLD.status = 'active' AND NEW.status = 'retired'
		AND OLD.retired_at IS NULL AND NEW.retired_at IS NOT NULL THEN
		RETURN NEW;
	END IF;
	RAISE EXCEPTION 'Invalid presentation revision lifecycle transition'
		USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_presentation_lifecycle';
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_expression_presentation_component_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	presentation_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.presentation_revision_id
		ELSE NEW.presentation_revision_id END;
BEGIN
	IF TG_OP <> 'INSERT' OR EXISTS (
		SELECT 1 FROM public.tag_expression_presentation_revision
		WHERE id = presentation_id AND sealed_at IS NOT NULL
	) THEN
		RAISE EXCEPTION 'Sealed presentation components are immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_presentation_component_immutable';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_tag_expression_projection_rebuild(
	target_expression_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
	-- Do not create definition-only queue noise. Both probes use the inverse
	-- Expression indexes and stop after the first asserting authority key.
	IF NOT EXISTS (
		SELECT 1 FROM public.unit_expression_assertion
		WHERE expression_id = target_expression_id LIMIT 1
	) AND NOT EXISTS (
		SELECT 1 FROM public.realm_unit_expression_assertion
		WHERE expression_id = target_expression_id LIMIT 1
	) THEN
		RETURN;
	END IF;
	INSERT INTO public.tag_expression_projection_rebuild(
		expression_id, global_cursor_unit_id, global_complete,
		realm_cursor_realm_id, realm_cursor_unit_id, realm_complete,
		attempt_count, available_at, last_error_message, requested_at, updated_at
	) VALUES (
		target_expression_id, NULL, false, NULL, NULL, false,
		0, clock_timestamp(), NULL, clock_timestamp(), clock_timestamp()
	)
	ON CONFLICT (expression_id) DO UPDATE SET
		global_cursor_unit_id = NULL,
		global_complete = false,
		realm_cursor_realm_id = NULL,
		realm_cursor_unit_id = NULL,
		realm_complete = false,
		attempt_count = 0,
		available_at = EXCLUDED.available_at,
		last_error_message = NULL,
		requested_at = EXCLUDED.requested_at,
		updated_at = EXCLUDED.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_tag_expression_effective_tags(
	target_expression_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
	effective_tag_count integer;
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM public.tag_expression
		WHERE id = $1 AND sealed_at IS NOT NULL
	) THEN
		RAISE EXCEPTION 'Cannot build inference closure for an unsealed Expression'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_unsealed';
	END IF;
	DELETE FROM public.tag_expression_effective_tag
	WHERE expression_id = $1;
	IF EXISTS (
		SELECT 1 FROM public.tag_expression
		WHERE id = $1 AND status = 'retired'
	) THEN
		PERFORM public.enqueue_tag_expression_projection_rebuild($1);
		RETURN;
	END IF;
	INSERT INTO public.tag_expression_effective_tag(expression_id, tag_id, evidence_kind)
	WITH RECURSIVE reachable(expression_id, evidence_kind, trail, depth) AS (
		SELECT rule.target_expression_id,
			rule.inference_kind,
			ARRAY[$1, rule.target_expression_id],
			1
		FROM public.tag_expression_inference_rule AS rule
		WHERE rule.source_expression_id = $1
			AND rule.target_expression_id IS NOT NULL
			AND rule.status = 'active'
		UNION ALL
		SELECT rule.target_expression_id,
			CASE WHEN reachable.evidence_kind = 'retrieval_only'
				OR rule.inference_kind = 'retrieval_only'
				THEN 'retrieval_only' ELSE 'entailed' END,
			reachable.trail || rule.target_expression_id,
			reachable.depth + 1
		FROM reachable
		JOIN public.tag_expression_inference_rule AS rule
			ON rule.source_expression_id = reachable.expression_id
		WHERE rule.target_expression_id IS NOT NULL
			AND rule.status = 'active'
			AND reachable.depth < 64
			AND NOT rule.target_expression_id = ANY(reachable.trail)
	), candidates(tag_id, evidence_kind) AS (
		SELECT expression.focus_tag_id, 'primary'::text
		FROM public.tag_expression AS expression
		WHERE expression.id = $1
		UNION ALL
		SELECT rule.target_tag_id, rule.inference_kind
		FROM public.tag_expression_inference_rule AS rule
		WHERE rule.source_expression_id = $1
			AND rule.target_tag_id IS NOT NULL AND rule.status = 'active'
		UNION ALL
		SELECT expression.focus_tag_id, reachable.evidence_kind
		FROM reachable
		JOIN public.tag_expression AS expression ON expression.id = reachable.expression_id
		WHERE expression.status = 'active' AND expression.sealed_at IS NOT NULL
		UNION ALL
		SELECT rule.target_tag_id,
			CASE WHEN reachable.evidence_kind = 'retrieval_only'
				OR rule.inference_kind = 'retrieval_only'
				THEN 'retrieval_only' ELSE 'entailed' END
		FROM reachable
		JOIN public.tag_expression_inference_rule AS rule
			ON rule.source_expression_id = reachable.expression_id
		WHERE rule.target_tag_id IS NOT NULL AND rule.status = 'active'
	), strongest AS (
		SELECT DISTINCT ON (tag_id) tag_id, evidence_kind
		FROM candidates
		WHERE tag_id IS NOT NULL
		ORDER BY tag_id,
			CASE evidence_kind WHEN 'primary' THEN 0 WHEN 'entailed' THEN 1 ELSE 2 END
	)
	SELECT $1, tag_id, evidence_kind FROM strongest
	LIMIT 257;
	GET DIAGNOSTICS effective_tag_count = ROW_COUNT;
	IF effective_tag_count > 256 THEN
		RAISE EXCEPTION 'Expression inference closure exceeds 256 Effective Tags'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_effective_tag_limit';
	END IF;
	PERFORM public.enqueue_tag_expression_projection_rebuild($1);
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_tag_expression_inference_closure()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	changed_expression_id uuid;
	impacted_expression_id uuid;
BEGIN
	-- OLD and NEW are polymorphic records. PostgreSQL resolves every field used by
	-- one expression against the firing table, including unreachable CASE arms,
	-- so table-specific fields must only be touched in separate statements.
	IF TG_TABLE_NAME = 'tag_expression' THEN
		IF TG_OP = 'DELETE' THEN
			changed_expression_id := OLD.id;
		ELSE
			changed_expression_id := NEW.id;
			IF NEW.sealed_at IS NULL THEN RETURN NULL; END IF;
		END IF;
	ELSIF TG_TABLE_NAME = 'tag_expression_inference_rule' THEN
		IF TG_OP = 'DELETE' THEN
			changed_expression_id := OLD.source_expression_id;
		ELSE
			changed_expression_id := NEW.source_expression_id;
		END IF;
	ELSE
		RAISE EXCEPTION 'Unsupported inference closure trigger source: %', TG_TABLE_NAME
			USING ERRCODE = '55000';
	END IF;
	FOR impacted_expression_id IN
		WITH RECURSIVE impacted(expression_id, trail, depth) AS (
			SELECT changed_expression_id, ARRAY[changed_expression_id], 0
			UNION ALL
			SELECT rule.source_expression_id,
				impacted.trail || rule.source_expression_id,
				impacted.depth + 1
			FROM impacted
			JOIN public.tag_expression_inference_rule AS rule
				ON rule.target_expression_id = impacted.expression_id
			WHERE rule.status = 'active' AND impacted.depth < 64
				AND NOT rule.source_expression_id = ANY(impacted.trail)
		)
		SELECT DISTINCT expression_id FROM impacted ORDER BY expression_id
	LOOP
		IF EXISTS (
			SELECT 1 FROM public.tag_expression
			WHERE id = impacted_expression_id AND sealed_at IS NOT NULL
		) THEN
			PERFORM public.rebuild_tag_expression_effective_tags(impacted_expression_id);
		END IF;
	END LOOP;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_expression_inference_graph()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	replaced_rule_id uuid := CASE WHEN TG_OP = 'UPDATE' THEN OLD.id ELSE NULL END;
	active_rule_count integer;
	ancestor_count integer;
	descendant_count integer;
	would_cycle boolean;
BEGIN
	IF NEW.status <> 'active' THEN RETURN NEW; END IF;
	-- Definition writes are rare. Serialize graph changes so concurrent inverse
	-- rules cannot both pass the cycle or fan-out checks under snapshot isolation.
	PERFORM pg_advisory_xact_lock(hashtextextended('tag-expression-inference-graph'::text, 0));
	SELECT count(*) INTO active_rule_count
	FROM (
		SELECT 1
		FROM public.tag_expression_inference_rule AS rule
		WHERE rule.source_expression_id = NEW.source_expression_id
			AND rule.status = 'active'
			AND (replaced_rule_id IS NULL OR rule.id <> replaced_rule_id)
		LIMIT 16
	) AS active_rule;
	IF active_rule_count >= 16 THEN
		RAISE EXCEPTION 'Expression has reached the 16 active inference-rule limit'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_inference_rule_limit';
	END IF;
	IF NEW.target_expression_id IS NULL THEN RETURN NEW; END IF;
	WITH RECURSIVE descendant(expression_id) AS (
			SELECT NEW.target_expression_id
			UNION
			SELECT rule.target_expression_id
			FROM descendant
			JOIN public.tag_expression_inference_rule AS rule
				ON rule.source_expression_id = descendant.expression_id
			WHERE rule.status = 'active'
				AND rule.target_expression_id IS NOT NULL
				AND (replaced_rule_id IS NULL OR rule.id <> replaced_rule_id)
		)
	SELECT count(*), coalesce(bool_or(expression_id = NEW.source_expression_id), false)
	INTO descendant_count, would_cycle
	FROM (SELECT expression_id FROM descendant LIMIT 65) AS bounded_descendant;
	IF would_cycle THEN
		RAISE EXCEPTION 'Inference rule would create an Expression cycle'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_inference_cycle';
	END IF;
	IF descendant_count > 64 THEN
		RAISE EXCEPTION 'Expression inference reach exceeds 64 downstream Expressions'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_inference_descendant_limit';
	END IF;
	WITH RECURSIVE ancestor(expression_id) AS (
		SELECT NEW.source_expression_id
		UNION
		SELECT rule.source_expression_id
		FROM ancestor
		JOIN public.tag_expression_inference_rule AS rule
			ON rule.target_expression_id = ancestor.expression_id
		WHERE rule.status = 'active'
			AND (replaced_rule_id IS NULL OR rule.id <> replaced_rule_id)
	)
	SELECT count(*) INTO ancestor_count
	FROM (SELECT expression_id FROM ancestor LIMIT 65) AS bounded_ancestor;
	IF ancestor_count > 64 THEN
		RAISE EXCEPTION 'Expression inference reach exceeds 64 upstream Expressions'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_inference_ancestor_limit';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_expression_inference_rule_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'Inference-rule revision history is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_inference_rule_immutable';
	END IF;
	IF (
		OLD.id, OLD.source_expression_id, OLD.target_tag_id, OLD.target_expression_id,
		OLD.inference_kind, OLD.revision, OLD.provenance, OLD.created_by_profile_id, OLD.created_at
	) IS DISTINCT FROM (
		NEW.id, NEW.source_expression_id, NEW.target_tag_id, NEW.target_expression_id,
		NEW.inference_kind, NEW.revision, NEW.provenance, NEW.created_by_profile_id, NEW.created_at
	) OR NOT (
		OLD.status = 'active' AND NEW.status = 'retired'
		AND OLD.retired_at IS NULL AND NEW.retired_at IS NOT NULL
	) THEN
		RAISE EXCEPTION 'Inference rules can only transition from active to retired'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_inference_rule_lifecycle';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_path_sense_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	valid_binding_count integer;
	stored_binding_count integer;
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'Path Sense history is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_sense_immutable';
	END IF;
	IF (
		OLD.id, OLD.path_id, OLD.expression_id, OLD.scope, OLD.realm_id,
		OLD.binding_signature, OLD.provenance, OLD.created_by_profile_id, OLD.created_at
	) IS DISTINCT FROM (
		NEW.id, NEW.path_id, NEW.expression_id, NEW.scope, NEW.realm_id,
		NEW.binding_signature, NEW.provenance, NEW.created_by_profile_id, NEW.created_at
	) THEN
		RAISE EXCEPTION 'Path Sense semantics are immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_sense_semantics_immutable';
	END IF;
	IF OLD.sealed_at IS NULL AND NEW.sealed_at IS NOT NULL
		AND OLD.status = NEW.status AND OLD.retired_at IS NOT DISTINCT FROM NEW.retired_at THEN
		SELECT count(*) INTO stored_binding_count
		FROM public.tag_path_sense_binding WHERE sense_id = NEW.id;
		SELECT count(*) INTO valid_binding_count
		FROM public.tag_path_sense_binding AS binding
		JOIN public.tag_path_member AS member
			ON member.path_id = NEW.path_id AND member.ordinal = binding.member_ordinal
		JOIN public.tag_expression_argument AS argument
			ON argument.expression_id = NEW.expression_id
			AND argument.role = binding.argument_role
			AND argument.ordinal = binding.argument_ordinal
			AND argument.tag_id = member.node_id
		WHERE binding.sense_id = NEW.id;
		IF stored_binding_count = 0 OR valid_binding_count <> stored_binding_count THEN
			RAISE EXCEPTION 'Every Path Sense binding must match a Path concept and Expression argument'
				USING ERRCODE = '23514', CONSTRAINT = 'tag_path_sense_binding_invalid';
		END IF;
		RETURN NEW;
	END IF;
	IF OLD.sealed_at IS NOT NULL AND NEW.sealed_at = OLD.sealed_at
		AND OLD.status = 'active' AND NEW.status = 'retired'
		AND OLD.retired_at IS NULL AND NEW.retired_at IS NOT NULL THEN
		RETURN NEW;
	END IF;
	RAISE EXCEPTION 'Invalid Path Sense lifecycle transition'
		USING ERRCODE = '23514', CONSTRAINT = 'tag_path_sense_lifecycle';
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_path_sense_binding_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF TG_OP <> 'INSERT' OR EXISTS (
		SELECT 1 FROM public.tag_path_sense WHERE id = NEW.sense_id AND sealed_at IS NOT NULL
	) THEN
		RAISE EXCEPTION 'Sealed Path Sense bindings are immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_sense_binding_immutable';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_unit_tag_path_application()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF TG_OP = 'INSERT' AND NOT EXISTS (
		SELECT 1 FROM public.tag_path_sense
		WHERE id = NEW.sense_id AND scope = 'global' AND status = 'active' AND sealed_at IS NOT NULL
	) THEN
		RAISE EXCEPTION 'A global Application requires an active sealed global Path Sense'
			USING ERRCODE = '23514', CONSTRAINT = 'unit_tag_path_application_sense_scope';
	END IF;
	IF TG_OP = 'UPDATE' AND (OLD.id, OLD.unit_id, OLD.sense_id, OLD.created_by_profile_id, OLD.created_at)
		IS DISTINCT FROM
		(NEW.id, NEW.unit_id, NEW.sense_id, NEW.created_by_profile_id, NEW.created_at) THEN
		RAISE EXCEPTION 'Path Application identity is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'unit_tag_path_application_identity_immutable';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_application_expression()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	target_unit_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	target_sense_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.sense_id ELSE NEW.sense_id END;
	target_expression_id uuid;
BEGIN
	SELECT expression_id INTO target_expression_id
	FROM public.tag_path_sense WHERE id = target_sense_id;
	IF target_expression_id IS NOT NULL THEN
		PERFORM public.refresh_unit_expression_assertion(target_unit_id, target_expression_id);
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_tag_path_application_judgment_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_application uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.application_id ELSE NEW.application_id END;
	score_delta bigint := 0;
	count_delta bigint := 0;
	spoiler_delta bigint := 0;
	none_delta bigint := 0;
	minor_delta bigint := 0;
	major_delta bigint := 0;
	old_accepted boolean;
	new_accepted boolean;
	current_score bigint;
	current_count bigint;
	target_unit_id uuid;
	target_expression_id uuid;
	target_path_id uuid;
BEGIN
	PERFORM public.lock_vote_hot_key('unit_path_application:' || key_application::text, 0);
	SELECT score, vote_count, score > 0 AND vote_count > 0
	INTO current_score, current_count, old_accepted
	FROM public.unit_tag_path_application_judgment_stat
	WHERE application_id = key_application;
	current_score := coalesce(current_score, 0);
	current_count := coalesce(current_count, 0);
	old_accepted := coalesce(old_accepted, false);
	IF TG_OP <> 'INSERT' THEN
		IF OLD.fit_vote IS NOT NULL THEN
			score_delta := score_delta - OLD.fit_vote; count_delta := count_delta - 1;
		END IF;
		IF OLD.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta - 1;
			IF OLD.spoiler_level = 0 THEN none_delta := none_delta - 1;
			ELSIF OLD.spoiler_level = 1 THEN minor_delta := minor_delta - 1;
			ELSE major_delta := major_delta - 1;
			END IF;
		END IF;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		IF NEW.fit_vote IS NOT NULL THEN
			score_delta := score_delta + NEW.fit_vote; count_delta := count_delta + 1;
		END IF;
		IF NEW.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta + 1;
			IF NEW.spoiler_level = 0 THEN none_delta := none_delta + 1;
			ELSIF NEW.spoiler_level = 1 THEN minor_delta := minor_delta + 1;
			ELSE major_delta := major_delta + 1;
			END IF;
		END IF;
	END IF;
	INSERT INTO public.unit_tag_path_application_judgment_stat(
		application_id, score, vote_count, spoiler_vote_count,
		spoiler_none_count, spoiler_minor_count, spoiler_major_count, updated_at
	) VALUES (
		key_application, score_delta, count_delta, spoiler_delta,
		none_delta, minor_delta, major_delta, clock_timestamp()
	)
	ON CONFLICT (application_id) DO UPDATE SET
		score = unit_tag_path_application_judgment_stat.score + EXCLUDED.score,
		vote_count = unit_tag_path_application_judgment_stat.vote_count + EXCLUDED.vote_count,
		spoiler_vote_count = unit_tag_path_application_judgment_stat.spoiler_vote_count + EXCLUDED.spoiler_vote_count,
		spoiler_none_count = unit_tag_path_application_judgment_stat.spoiler_none_count + EXCLUDED.spoiler_none_count,
		spoiler_minor_count = unit_tag_path_application_judgment_stat.spoiler_minor_count + EXCLUDED.spoiler_minor_count,
		spoiler_major_count = unit_tag_path_application_judgment_stat.spoiler_major_count + EXCLUDED.spoiler_major_count,
		updated_at = EXCLUDED.updated_at;
	new_accepted := current_score + score_delta > 0 AND current_count + count_delta > 0;
	IF old_accepted <> new_accepted THEN
		SELECT application.unit_id, sense.expression_id, sense.path_id
		INTO target_unit_id, target_expression_id, target_path_id
		FROM public.unit_tag_path_application AS application
		JOIN public.tag_path_sense AS sense ON sense.id = application.sense_id
		WHERE application.id = key_application;
		IF target_path_id IS NOT NULL THEN
			UPDATE public.tag_path_vote_stat
			SET usage_count = usage_count + CASE WHEN new_accepted THEN 1 ELSE -1 END,
				updated_at = clock_timestamp()
			WHERE path_id = target_path_id;
			PERFORM public.refresh_unit_expression_assertion(target_unit_id, target_expression_id);
		END IF;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_unit_tag_path_application_judgment_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF (OLD.application_id, OLD.profile_id) IS DISTINCT FROM (NEW.application_id, NEW.profile_id) THEN
		RAISE EXCEPTION 'Application judgment identity is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'unit_tag_path_application_judgment_identity_immutable';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_path_merge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'Tag Path merge history is append-only'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_merge_append_only';
	END IF;
	IF TG_OP = 'UPDATE' AND (
		(OLD.source_path_id, OLD.target_path_id, OLD.reason, OLD.proposal_source_kind,
			OLD.proposal_provenance, OLD.proposed_by_profile_id, OLD.created_at)
		IS DISTINCT FROM
		(NEW.source_path_id, NEW.target_path_id, NEW.reason, NEW.proposal_source_kind,
			NEW.proposal_provenance, NEW.proposed_by_profile_id, NEW.created_at)
		OR NOT (
			(OLD.status = 'proposed' AND NEW.status IN ('accepted', 'rejected'))
			OR (OLD.status = 'accepted' AND NEW.status = 'reversed')
		)
	) THEN
		RAISE EXCEPTION 'Invalid Tag Path merge transition'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_merge_transition';
	END IF;
	IF NEW.status = 'accepted' AND EXISTS (
		WITH RECURSIVE chain(path_id, trail, depth) AS (
			SELECT NEW.target_path_id, ARRAY[NEW.target_path_id], 0
			UNION ALL
			SELECT merge.target_path_id, chain.trail || merge.target_path_id, chain.depth + 1
			FROM chain
			JOIN public.tag_path_merge AS merge
				ON merge.source_path_id = chain.path_id AND merge.status = 'accepted'
			WHERE chain.depth < 64 AND NOT merge.target_path_id = ANY(chain.trail)
		)
		SELECT 1 FROM chain WHERE path_id = NEW.source_path_id
	) THEN
		RAISE EXCEPTION 'Tag Path merge would create a cycle'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_merge_cycle';
	END IF;
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tag_path_definition_guard ON public.tag_path;
CREATE TRIGGER tag_path_definition_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_path
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_definition();

DROP TRIGGER IF EXISTS tag_path_definition_project ON public.tag_path;
CREATE TRIGGER tag_path_definition_project
AFTER INSERT ON public.tag_path
FOR EACH ROW EXECUTE FUNCTION public.project_tag_path_definition();

DROP TRIGGER IF EXISTS tag_path_member_projection_guard ON public.tag_path_member;
CREATE TRIGGER tag_path_member_projection_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_path_member
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_projection();

DROP TRIGGER IF EXISTS vocabulary_node_path_lifecycle_guard ON public.vocabulary_node;
CREATE TRIGGER vocabulary_node_path_lifecycle_guard
BEFORE UPDATE OR DELETE ON public.vocabulary_node
FOR EACH ROW EXECUTE FUNCTION public.guard_vocabulary_node_path_lifecycle();

DROP TRIGGER IF EXISTS tag_relation_path_lifecycle_guard ON public.tag_relation;
CREATE TRIGGER tag_relation_path_lifecycle_guard
BEFORE UPDATE OR DELETE ON public.tag_relation
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_relation_path_lifecycle();

DROP TRIGGER IF EXISTS tag_relation_graph_guard ON public.tag_relation;
CREATE TRIGGER tag_relation_graph_guard
BEFORE INSERT OR UPDATE ON public.tag_relation
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_relation_graph();

DROP TRIGGER IF EXISTS tag_path_vote_stat_maintain ON public.tag_path_vote;
CREATE TRIGGER tag_path_vote_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.tag_path_vote
FOR EACH ROW EXECUTE FUNCTION public.maintain_tag_path_vote_stat();

DROP TRIGGER IF EXISTS tag_path_vote_stat_projection_guard ON public.tag_path_vote_stat;
CREATE TRIGGER tag_path_vote_stat_projection_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_path_vote_stat
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_vote_stat_projection();

DROP TRIGGER IF EXISTS tag_expression_mutation_guard ON public.tag_expression;
CREATE TRIGGER tag_expression_mutation_guard
BEFORE UPDATE OR DELETE ON public.tag_expression
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_expression_mutation();

DROP TRIGGER IF EXISTS tag_expression_argument_mutation_guard ON public.tag_expression_argument;
CREATE TRIGGER tag_expression_argument_mutation_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_expression_argument
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_expression_argument_mutation();

DROP TRIGGER IF EXISTS tag_expression_presentation_mutation_guard ON public.tag_expression_presentation_revision;
CREATE TRIGGER tag_expression_presentation_mutation_guard
BEFORE UPDATE OR DELETE ON public.tag_expression_presentation_revision
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_expression_presentation_mutation();

DROP TRIGGER IF EXISTS tag_expression_label_component_mutation_guard ON public.tag_expression_label_component;
CREATE TRIGGER tag_expression_label_component_mutation_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_expression_label_component
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_expression_presentation_component_mutation();

DROP TRIGGER IF EXISTS tag_expression_group_key_mutation_guard ON public.tag_expression_group_key;
CREATE TRIGGER tag_expression_group_key_mutation_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_expression_group_key
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_expression_presentation_component_mutation();

DROP TRIGGER IF EXISTS tag_expression_closure_from_definition ON public.tag_expression;
CREATE TRIGGER tag_expression_closure_from_definition
AFTER UPDATE OF sealed_at, status ON public.tag_expression
FOR EACH ROW EXECUTE FUNCTION public.maintain_tag_expression_inference_closure();

DROP TRIGGER IF EXISTS tag_expression_inference_rule_mutation_guard ON public.tag_expression_inference_rule;
CREATE TRIGGER tag_expression_inference_rule_mutation_guard
BEFORE UPDATE OR DELETE ON public.tag_expression_inference_rule
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_expression_inference_rule_mutation();

DROP TRIGGER IF EXISTS tag_expression_inference_graph_guard ON public.tag_expression_inference_rule;
CREATE TRIGGER tag_expression_inference_graph_guard
BEFORE INSERT OR UPDATE ON public.tag_expression_inference_rule
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_expression_inference_graph();

DROP TRIGGER IF EXISTS tag_expression_closure_from_rule ON public.tag_expression_inference_rule;
CREATE TRIGGER tag_expression_closure_from_rule
AFTER INSERT OR UPDATE OR DELETE ON public.tag_expression_inference_rule
FOR EACH ROW EXECUTE FUNCTION public.maintain_tag_expression_inference_closure();

DROP TRIGGER IF EXISTS tag_path_sense_mutation_guard ON public.tag_path_sense;
CREATE TRIGGER tag_path_sense_mutation_guard
BEFORE UPDATE OR DELETE ON public.tag_path_sense
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_sense_mutation();

DROP TRIGGER IF EXISTS tag_path_sense_binding_mutation_guard ON public.tag_path_sense_binding;
CREATE TRIGGER tag_path_sense_binding_mutation_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_path_sense_binding
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_sense_binding_mutation();

DROP TRIGGER IF EXISTS unit_tag_path_application_guard ON public.unit_tag_path_application;
CREATE TRIGGER unit_tag_path_application_guard
BEFORE INSERT OR UPDATE ON public.unit_tag_path_application
FOR EACH ROW EXECUTE FUNCTION public.guard_unit_tag_path_application();

DROP TRIGGER IF EXISTS unit_tag_path_application_expression_maintain ON public.unit_tag_path_application;
CREATE TRIGGER unit_tag_path_application_expression_maintain
AFTER INSERT OR DELETE ON public.unit_tag_path_application
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_application_expression();

DROP TRIGGER IF EXISTS unit_tag_path_application_judgment_identity_guard ON public.unit_tag_path_application_judgment;
CREATE TRIGGER unit_tag_path_application_judgment_identity_guard
BEFORE UPDATE ON public.unit_tag_path_application_judgment
FOR EACH ROW EXECUTE FUNCTION public.protect_unit_tag_path_application_judgment_identity();

DROP TRIGGER IF EXISTS unit_tag_path_application_judgment_stat_maintain ON public.unit_tag_path_application_judgment;
CREATE TRIGGER unit_tag_path_application_judgment_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.unit_tag_path_application_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_tag_path_application_judgment_stat();

DROP TRIGGER IF EXISTS tag_path_merge_guard ON public.tag_path_merge;
CREATE TRIGGER tag_path_merge_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_path_merge
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_merge();

-- The simple Expressions were seeded before the closure function existed.
-- Rebuild the definition-scale closure after installing canonical Tag Path SQL.
SELECT public.rebuild_tag_expression_effective_tags(expression.id)
FROM public.tag_expression AS expression
WHERE expression.status = 'active' AND expression.sealed_at IS NOT NULL
ORDER BY expression.id;
