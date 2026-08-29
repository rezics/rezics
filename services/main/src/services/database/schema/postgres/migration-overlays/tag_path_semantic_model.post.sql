-- Every released Tag has a sealed simple Expression. The claim key is semantic
-- data; localized titles continue to be resolved from Tag localizations.
INSERT INTO public.tag_expression(
	expression_kind, canonical_claim_key, focus_tag_id, created_at
)
SELECT 'simple', 'tag:' || tag.id::text, tag.id, tag.created_at
FROM public.tag AS tag
ON CONFLICT (canonical_claim_key) DO NOTHING;

INSERT INTO public.tag_expression_argument(expression_id, role, ordinal, tag_id)
SELECT expression.id, 'focus', 0, expression.focus_tag_id
FROM public.tag_expression AS expression
WHERE expression.expression_kind = 'simple'
ON CONFLICT DO NOTHING;

UPDATE public.tag_expression
SET sealed_at = COALESCE(sealed_at, created_at)
WHERE expression_kind = 'simple' AND sealed_at IS NULL;

INSERT INTO public.tag_expression_presentation_revision(
	expression_id, revision, created_at
)
SELECT expression.id, 1, expression.created_at
FROM public.tag_expression AS expression
WHERE expression.expression_kind = 'simple'
	AND NOT EXISTS (
		SELECT 1
		FROM public.tag_expression_presentation_revision AS presentation
		WHERE presentation.expression_id = expression.id
	);

INSERT INTO public.tag_expression_label_component(
	presentation_revision_id, ordinal, tag_id, semantic_role, component_kind
)
SELECT presentation.id, 0, expression.focus_tag_id, 'focus', 'required'
FROM public.tag_expression_presentation_revision AS presentation
JOIN public.tag_expression AS expression ON expression.id = presentation.expression_id
WHERE expression.expression_kind = 'simple'
	AND presentation.revision = 1
ON CONFLICT DO NOTHING;

UPDATE public.tag_expression_presentation_revision AS presentation
SET sealed_at = COALESCE(presentation.sealed_at, presentation.created_at)
FROM public.tag_expression AS expression
WHERE expression.id = presentation.expression_id
	AND expression.expression_kind = 'simple'
	AND presentation.sealed_at IS NULL;

-- Populate direct assertion projections set-wise from their released sources.
INSERT INTO public.unit_expression_assertion(
	unit_id, expression_id, direct, path_application_count, created_at, updated_at
)
SELECT direct_tag.unit_id, expression.id, true, 0,
	direct_tag.created_at, direct_tag.updated_at
FROM public.unit_tag AS direct_tag
JOIN public.tag_expression AS expression
	ON expression.expression_kind = 'simple'
	AND expression.focus_tag_id = direct_tag.tag_id
ON CONFLICT (unit_id, expression_id) DO UPDATE SET
	direct = true,
	updated_at = GREATEST(
		public.unit_expression_assertion.updated_at,
		EXCLUDED.updated_at
	);

INSERT INTO public.realm_unit_expression_assertion(
	realm_id, unit_id, expression_id, direct, path_application_count,
	created_at, updated_at
)
SELECT direct_tag.realm_id, direct_tag.unit_id, expression.id, true, 0,
	direct_tag.created_at, direct_tag.updated_at
FROM public.realm_unit_tag AS direct_tag
JOIN public.tag_expression AS expression
	ON expression.expression_kind = 'simple'
	AND expression.focus_tag_id = direct_tag.tag_id
ON CONFLICT (realm_id, unit_id, expression_id) DO UPDATE SET
	direct = true,
	updated_at = GREATEST(
		public.realm_unit_expression_assertion.updated_at,
		EXCLUDED.updated_at
	);

DROP FUNCTION IF EXISTS public.reject_conflicting_structure_application_vote();
DROP FUNCTION IF EXISTS public.reject_conflicting_direct_tag_vote();
DROP FUNCTION IF EXISTS public.protect_immutable_unit_structure();
DROP FUNCTION IF EXISTS public.project_unit_structure_definition();
DROP FUNCTION IF EXISTS public.prepare_unit_structure_definition();
DROP FUNCTION IF EXISTS public.maintain_unit_structure_vote_stat();
DROP FUNCTION IF EXISTS public.maintain_unit_structure_application_vote_stat();
DROP FUNCTION IF EXISTS public.maintain_structure_application_support();
DROP FUNCTION IF EXISTS public.maintain_effective_tag_from_structure_support();
DROP FUNCTION IF EXISTS public.refresh_unit_structure_vote_stat(uuid);
DROP FUNCTION IF EXISTS public.refresh_unit_structure_application_vote_stat(uuid, uuid);
DROP FUNCTION IF EXISTS public.lock_unit_structure_definition_key(uuid);
