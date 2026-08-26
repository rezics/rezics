-- Fixed content-label registry and direct Tag application policy.

CREATE OR REPLACE FUNCTION public.guard_tag_directly_applicable_transition()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
	IF NOT OLD.directly_applicable OR NEW.directly_applicable THEN RETURN NEW; END IF;
	IF EXISTS (SELECT 1 FROM public.unit_tag WHERE tag_id = NEW.id)
		OR EXISTS (SELECT 1 FROM public.realm_unit_tag WHERE tag_id = NEW.id)
		OR EXISTS (SELECT 1 FROM public.profile_unit_tag WHERE tag_id = NEW.id)
		OR EXISTS (SELECT 1 FROM public.realm_tag_judgment WHERE tag_id = NEW.id) THEN
		RAISE EXCEPTION 'A directly applied Tag cannot become category-only'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_directly_applicable_in_use';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_content_label_unit_merge()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
	registry_ids constant uuid[] := ARRAY[
		'019b76da-a800-7370-8000-000000000001'::uuid,
		'019b76da-a800-7370-8000-000000000002'::uuid,
		'019b76da-a800-7370-8000-000000000003'::uuid,
		'019b76da-a800-7370-8000-000000000004'::uuid
	];
BEGIN
	IF NEW.source_unit_id = ANY(registry_ids) OR NEW.target_unit_id = ANY(registry_ids) THEN
		RAISE EXCEPTION 'Fixed content-label registry Tags cannot participate in Unit merges'
			USING ERRCODE = '23514', CONSTRAINT = 'content_label_unit_merge_rejected';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_direct_tag_application_policy()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
	content_spoiler_ids constant uuid[] := ARRAY[
		'019b76da-a800-7370-8000-000000000001'::uuid,
		'019b76da-a800-7370-8000-000000000002'::uuid,
		'019b76da-a800-7370-8000-000000000003'::uuid
	];
	nsfw_id constant uuid := '019b76da-a800-7370-8000-000000000004'::uuid;
	registry_ids constant uuid[] := content_spoiler_ids || ARRAY[nsfw_id];
	is_directly_applicable boolean;
BEGIN
	SELECT directly_applicable INTO is_directly_applicable
	FROM public.tag WHERE id = NEW.tag_id FOR SHARE;
	IF NOT NEW.tag_id = ANY(registry_ids) THEN
		IF is_directly_applicable = false THEN
			RAISE EXCEPTION 'Tag % cannot be applied directly', NEW.tag_id
				USING ERRCODE = '23514', CONSTRAINT = 'tag_directly_applicable';
		END IF;
		RETURN NEW;
	END IF;
	IF TG_TABLE_NAME = 'profile_unit_tag' THEN
		RAISE EXCEPTION 'Content labels cannot be private Profile Tags'
			USING ERRCODE = '23514', CONSTRAINT = 'content_label_private_rejected';
	END IF;
	IF TG_TABLE_NAME = 'unit_tag' AND (NEW.created_by_profile_id IS NULL OR NOT NEW.pinned) THEN
		RAISE EXCEPTION 'Global content-label rows require creator attribution and pinning'
			USING ERRCODE = '23514', CONSTRAINT = 'content_label_global_contract';
	END IF;
	IF NEW.tag_id = ANY(content_spoiler_ids) AND NOT EXISTS (
		SELECT 1 FROM public.post WHERE id = NEW.unit_id
	) THEN
		RAISE EXCEPTION 'Content-spoiler labels apply only to post-kind Units'
			USING ERRCODE = '23514', CONSTRAINT = 'content_spoiler_label_post_kind';
	ELSIF NEW.tag_id = nsfw_id AND NOT EXISTS (
		SELECT 1 FROM public.unit WHERE id = NEW.unit_id
			AND status = 'published'::public.unit_status
			AND visibility = 'public'::public.resource_visibility
			AND moderation_status = 'approved'::public.moderation_status
			AND deleted_at IS NULL
			AND kind NOT IN ('slug_namespace', 'profile', 'tag', 'tag_path', 'zone', 'realm', 'realm_rule')
	) THEN
		RAISE EXCEPTION 'The NSFW display label applies only to active public content Units'
			USING ERRCODE = '23514', CONSTRAINT = 'nsfw_label_public_content';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_content_label_judgment()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW.tag_id = ANY(ARRAY[
		'019b76da-a800-7370-8000-000000000001'::uuid,
		'019b76da-a800-7370-8000-000000000002'::uuid,
		'019b76da-a800-7370-8000-000000000003'::uuid,
		'019b76da-a800-7370-8000-000000000004'::uuid
	]) THEN
		RAISE EXCEPTION 'Content-label applicability and spoiler judgments are not permitted'
			USING ERRCODE = '23514', CONSTRAINT = 'content_label_judgment_rejected';
	END IF;
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tag_directly_applicable_transition_guard ON public.tag;
CREATE TRIGGER tag_directly_applicable_transition_guard
BEFORE UPDATE OF directly_applicable ON public.tag
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_directly_applicable_transition();

DROP TRIGGER IF EXISTS unit_merge_operation_content_label_guard ON public.unit_merge_operation;
CREATE TRIGGER unit_merge_operation_content_label_guard
BEFORE INSERT OR UPDATE OF source_unit_id, target_unit_id ON public.unit_merge_operation
FOR EACH ROW EXECUTE FUNCTION public.guard_content_label_unit_merge();

DROP TRIGGER IF EXISTS unit_tag_application_policy_guard ON public.unit_tag;
CREATE TRIGGER unit_tag_application_policy_guard
BEFORE INSERT OR UPDATE ON public.unit_tag
FOR EACH ROW EXECUTE FUNCTION public.guard_direct_tag_application_policy();

DROP TRIGGER IF EXISTS realm_unit_tag_application_policy_guard ON public.realm_unit_tag;
CREATE TRIGGER realm_unit_tag_application_policy_guard
BEFORE INSERT OR UPDATE ON public.realm_unit_tag
FOR EACH ROW EXECUTE FUNCTION public.guard_direct_tag_application_policy();

DROP TRIGGER IF EXISTS profile_unit_tag_application_policy_guard ON public.profile_unit_tag;
CREATE TRIGGER profile_unit_tag_application_policy_guard
BEFORE INSERT OR UPDATE ON public.profile_unit_tag
FOR EACH ROW EXECUTE FUNCTION public.guard_direct_tag_application_policy();

DROP TRIGGER IF EXISTS unit_tag_judgment_content_label_reject ON public.unit_tag_judgment;
CREATE TRIGGER unit_tag_judgment_content_label_reject
BEFORE INSERT OR UPDATE ON public.unit_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.reject_content_label_judgment();

DROP TRIGGER IF EXISTS realm_tag_judgment_content_label_reject ON public.realm_tag_judgment;
CREATE TRIGGER realm_tag_judgment_content_label_reject
BEFORE INSERT OR UPDATE ON public.realm_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.reject_content_label_judgment();
