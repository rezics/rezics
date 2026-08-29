CREATE OR REPLACE FUNCTION public.protect_custom_theme_revision_package()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'Custom Theme revisions cannot be deleted'
			USING ERRCODE = '23514', CONSTRAINT = 'custom_theme_revision_immutable';
	END IF;
	IF (
		OLD.id,
		OLD.custom_theme_unit_id,
		OLD.target_contract,
		OLD.execution_mode,
		OLD.resource_mode,
		OLD.manifest_document,
		OLD.manifest_sha256,
		OLD.source_archive_sha256,
		OLD.approval_scope,
		OLD.submitted_by_profile_id,
		OLD.created_at
	) IS DISTINCT FROM (
		NEW.id,
		NEW.custom_theme_unit_id,
		NEW.target_contract,
		NEW.execution_mode,
		NEW.resource_mode,
		NEW.manifest_document,
		NEW.manifest_sha256,
		NEW.source_archive_sha256,
		NEW.approval_scope,
		NEW.submitted_by_profile_id,
		NEW.created_at
	) THEN
		RAISE EXCEPTION 'Custom Theme revision package identity is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'custom_theme_revision_package_immutable';
	END IF;
	IF OLD.review_state <> NEW.review_state AND NOT (
		(OLD.review_state = 'pending_automated' AND NEW.review_state = 'pending_human')
		OR (OLD.review_state = 'pending_human' AND NEW.review_state IN ('approved', 'rejected'))
		OR (OLD.review_state = 'approved' AND NEW.review_state IN ('killed', 'revalidation_required'))
		OR (
			OLD.review_state = 'revalidation_required'
			AND NEW.review_state IN ('approved', 'rejected', 'killed')
		)
	) THEN
		RAISE EXCEPTION 'Custom Theme revision review-state transition is invalid'
			USING ERRCODE = '23514', CONSTRAINT = 'custom_theme_revision_state_transition';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_custom_theme_immutable_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	RAISE EXCEPTION '% rows are immutable', TG_TABLE_NAME
		USING ERRCODE = '23514', CONSTRAINT = TG_TABLE_NAME || '_immutable';
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_custom_theme_external_live_grant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF OLD.capability <> 'platform.custom_theme.external_live.access'::public.platform_capability
		AND (TG_OP = 'DELETE' OR NEW.capability <> 'platform.custom_theme.external_live.access'::public.platform_capability)
	THEN
		IF TG_OP = 'DELETE' THEN
			RETURN OLD;
		END IF;
		RETURN NEW;
	END IF;
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'External-live access grant history cannot be deleted'
			USING ERRCODE = '23514', CONSTRAINT = 'platform_capability_grant_custom_theme_history_immutable';
	END IF;
	IF (
		OLD.id,
		OLD.profile_id,
		OLD.capability,
		OLD.granted_by_profile_id,
		OLD.expires_at,
		OLD.created_at
	) IS DISTINCT FROM (
		NEW.id,
		NEW.profile_id,
		NEW.capability,
		NEW.granted_by_profile_id,
		NEW.expires_at,
		NEW.created_at
	) OR OLD.revoked_at IS NOT NULL
		OR NEW.revoked_at IS NULL
		OR NEW.revoked_by_profile_id IS NULL
	THEN
		RAISE EXCEPTION 'External-live access grants permit only one revocation transition'
			USING ERRCODE = '23514', CONSTRAINT = 'platform_capability_grant_custom_theme_lifecycle_immutable';
	END IF;
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS custom_theme_revision_package_immutable ON public.custom_theme_revision;
CREATE TRIGGER custom_theme_revision_package_immutable
BEFORE UPDATE OR DELETE ON public.custom_theme_revision
FOR EACH ROW EXECUTE FUNCTION public.protect_custom_theme_revision_package();

DROP TRIGGER IF EXISTS custom_theme_revision_file_immutable ON public.custom_theme_revision_file;
CREATE TRIGGER custom_theme_revision_file_immutable
BEFORE UPDATE OR DELETE ON public.custom_theme_revision_file
FOR EACH ROW EXECUTE FUNCTION public.reject_custom_theme_immutable_history_mutation();

DROP TRIGGER IF EXISTS custom_theme_revision_review_event_immutable ON public.custom_theme_revision_review_event;
CREATE TRIGGER custom_theme_revision_review_event_immutable
BEFORE UPDATE OR DELETE ON public.custom_theme_revision_review_event
FOR EACH ROW EXECUTE FUNCTION public.reject_custom_theme_immutable_history_mutation();

DROP TRIGGER IF EXISTS unit_presentation_revision_immutable ON public.unit_presentation_revision;
CREATE TRIGGER unit_presentation_revision_immutable
BEFORE UPDATE OR DELETE ON public.unit_presentation_revision
FOR EACH ROW EXECUTE FUNCTION public.reject_custom_theme_immutable_history_mutation();

DROP TRIGGER IF EXISTS platform_capability_grant_custom_theme_lifecycle_guard ON public.platform_capability_grant;
CREATE TRIGGER platform_capability_grant_custom_theme_lifecycle_guard
BEFORE UPDATE OR DELETE ON public.platform_capability_grant
FOR EACH ROW EXECUTE FUNCTION public.protect_custom_theme_external_live_grant();
