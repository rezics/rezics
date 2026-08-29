-- Tag Path was an unreleased development preview. Remove its source facts and
-- projections rather than guessing semantic Expressions for legacy routes.
DROP TABLE IF EXISTS public.content_pack_unit_tag_path_evidence CASCADE;
DROP TABLE IF EXISTS public.content_pack_tag_path_definition_evidence CASCADE;
DROP TABLE IF EXISTS public.realm_unit_tag_path_support CASCADE;
DROP TABLE IF EXISTS public.realm_unit_tag_path_judgment_stat CASCADE;
DROP TABLE IF EXISTS public.realm_unit_tag_path_judgment CASCADE;
DROP TABLE IF EXISTS public.realm_unit_tag_path CASCADE;
DROP TABLE IF EXISTS public.realm_tag_path_vote_stat CASCADE;
DROP TABLE IF EXISTS public.realm_tag_path_vote CASCADE;
DROP TABLE IF EXISTS public.realm_tag_path CASCADE;
DROP TABLE IF EXISTS public.unit_tag_path_support CASCADE;
DROP TABLE IF EXISTS public.unit_tag_path_judgment_stat CASCADE;
DROP TABLE IF EXISTS public.unit_tag_path_judgment CASCADE;
DROP TABLE IF EXISTS public.unit_tag_path CASCADE;
DROP TABLE IF EXISTS public.tag_path_vote_stat CASCADE;
DROP TABLE IF EXISTS public.tag_path_vote CASCADE;
DROP TABLE IF EXISTS public.tag_path_merge CASCADE;
DROP TABLE IF EXISTS public.tag_path_edge CASCADE;
DROP TABLE IF EXISTS public.tag_path_member CASCADE;
DROP TABLE IF EXISTS public.tag_path CASCADE;
DROP TABLE IF EXISTS public.unit_effective_tag_vote CASCADE;

-- The Path subtype is owned by the preview. Other released Unit kinds and all
-- direct Tag assertions are outside this destructive boundary.
DELETE FROM public.unit WHERE kind = 'tag_path';

-- Preserve only released direct evidence in rebuildable effective projections.
DELETE FROM public.unit_effective_tag WHERE NOT direct;
UPDATE public.unit_effective_tag SET path_support_count = 0 WHERE direct;
DELETE FROM public.realm_unit_effective_tag WHERE NOT direct;
UPDATE public.realm_unit_effective_tag SET path_support_count = 0 WHERE direct;

-- Existing Tags become concept vocabulary nodes before the new composite
-- foreign key is installed. Guide nodes deliberately have no Unit identity.
CREATE TABLE public.vocabulary_node (
	id uuid PRIMARY KEY DEFAULT uuidv7(),
	kind text NOT NULL,
	status text NOT NULL DEFAULT 'active',
	created_by_profile_id uuid,
	created_at timestamptz(3) NOT NULL DEFAULT now(),
	retired_at timestamptz(3)
);

INSERT INTO public.vocabulary_node(id, kind, status, created_at)
SELECT tag.id, 'concept', 'active', tag.created_at
FROM public.tag AS tag;

ALTER TABLE public.tag
	ADD COLUMN node_kind text NOT NULL DEFAULT 'concept';

-- Remove obsolete preview/effective-fan-out routines. Canonical SQL later in
-- this migration installs only the semantic-model routines.
DROP FUNCTION IF EXISTS public.guard_content_pack_unit_tag_path_evidence_retarget() CASCADE;
DROP FUNCTION IF EXISTS public.guard_tag_path_member_lifecycle() CASCADE;
DROP FUNCTION IF EXISTS public.maintain_realm_unit_tag_path_judgment_stat() CASCADE;
DROP FUNCTION IF EXISTS public.maintain_realm_unit_tag_path_support() CASCADE;
DROP FUNCTION IF EXISTS public.maintain_unit_effective_tag_from_direct() CASCADE;
DROP FUNCTION IF EXISTS public.maintain_unit_effective_tag_vote_from_direct() CASCADE;
DROP FUNCTION IF EXISTS public.maintain_unit_effective_tag_vote_from_path() CASCADE;
DROP FUNCTION IF EXISTS public.maintain_unit_tag_fit_stat() CASCADE;
DROP FUNCTION IF EXISTS public.maintain_unit_tag_path_judgment_stat() CASCADE;
DROP FUNCTION IF EXISTS public.maintain_unit_tag_path_support() CASCADE;
DROP FUNCTION IF EXISTS public.maintain_unit_tag_spoiler_stat() CASCADE;
DROP FUNCTION IF EXISTS public.protect_realm_tag_path_judgment_identity() CASCADE;
DROP FUNCTION IF EXISTS public.protect_unit_tag_path_judgment_identity() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_realm_unit_effective_tag() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_unit_effective_tag_context(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.refresh_unit_effective_tag_from_path_support() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_unit_effective_tag_vote(uuid, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.lock_unit_effective_tag_key(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.lock_unit_effective_tag_vote_key(uuid, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.maintain_effective_tag_from_direct_context() CASCADE;
DROP FUNCTION IF EXISTS public.maintain_effective_tag_from_direct_vote() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_unit_effective_tag(uuid, uuid) CASCADE;
