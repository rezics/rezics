-- Native owner integrity and derived state. This file is the canonical forward-maintained source.
CREATE OR REPLACE FUNCTION public.enforce_unit_revision_primary_contribution()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
	checked_revision_id uuid;
	checked_kind public.unit_revision_primary_contribution_kind;
	has_credit_attribution boolean;
BEGIN
	checked_revision_id := CASE
		WHEN TG_TABLE_NAME = 'unit_revision'
			THEN NULLIF(to_jsonb(NEW) ->> 'id', '')::uuid
		ELSE NULLIF(to_jsonb(NEW) ->> 'revision_id', '')::uuid
	END;

	SELECT revision.primary_contribution_kind
	INTO checked_kind
	FROM public.unit_revision AS revision
	WHERE revision.id = checked_revision_id;

	SELECT EXISTS (
		SELECT 1
		FROM public.unit_revision_credit_attribution AS attribution
		WHERE attribution.revision_id = checked_revision_id
	)
	INTO has_credit_attribution;

	IF (checked_kind = 'ai'::public.unit_revision_primary_contribution_kind)
		IS DISTINCT FROM has_credit_attribution THEN
		RAISE EXCEPTION 'Revision contribution kind and credit attribution do not agree'
			USING ERRCODE = '23514',
				  CONSTRAINT = 'unit_revision_primary_contribution_integrity',
				  DETAIL = json_build_object(
					  'revisionId', checked_revision_id,
					  'kind', checked_kind,
					  'hasCreditAttribution', has_credit_attribution
				  )::text;
	END IF;
	RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_unit_revision_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
	IF ROW(
		OLD."id",
		OLD."unit_id",
		OLD."parent_revision_id",
		OLD."actor_profile_id",
		OLD."edit_summary",
		OLD."minor",
		OLD."byte_size",
		OLD."created_at",
		OLD."primary_contribution_kind"
	) IS DISTINCT FROM ROW(
		NEW."id",
		NEW."unit_id",
		NEW."parent_revision_id",
		NEW."actor_profile_id",
		NEW."edit_summary",
		NEW."minor",
		NEW."byte_size",
		NEW."created_at",
		NEW."primary_contribution_kind"
	) THEN
		RAISE EXCEPTION 'unit_revision identity is immutable' USING ERRCODE = '55000';
	END IF;
	RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_immutable_history_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
	RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$function$;

DROP TRIGGER IF EXISTS audit_event_append_only ON public.audit_event;
CREATE TRIGGER audit_event_append_only BEFORE DELETE OR UPDATE ON public.audit_event FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();

DROP TRIGGER IF EXISTS revision_content_immutable ON public.revision_content;
CREATE TRIGGER revision_content_immutable BEFORE DELETE OR UPDATE ON public.revision_content FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();

DROP TRIGGER IF EXISTS unit_revision_identity_immutable ON public.unit_revision;
CREATE TRIGGER unit_revision_identity_immutable BEFORE UPDATE ON public.unit_revision FOR EACH ROW EXECUTE FUNCTION public.protect_unit_revision_identity();

DROP TRIGGER IF EXISTS unit_revision_primary_contribution_from_revision ON public.unit_revision;
CREATE CONSTRAINT TRIGGER unit_revision_primary_contribution_from_revision AFTER INSERT ON public.unit_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.enforce_unit_revision_primary_contribution();

DROP TRIGGER IF EXISTS unit_revision_credit_attribution_immutable ON public.unit_revision_credit_attribution;
CREATE TRIGGER unit_revision_credit_attribution_immutable BEFORE DELETE OR UPDATE ON public.unit_revision_credit_attribution FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();

DROP TRIGGER IF EXISTS unit_revision_primary_contribution_from_credit ON public.unit_revision_credit_attribution;
CREATE CONSTRAINT TRIGGER unit_revision_primary_contribution_from_credit AFTER INSERT ON public.unit_revision_credit_attribution DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.enforce_unit_revision_primary_contribution();

DROP TRIGGER IF EXISTS unit_revision_slot_immutable ON public.unit_revision_slot;
CREATE TRIGGER unit_revision_slot_immutable BEFORE DELETE OR UPDATE ON public.unit_revision_slot FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();

DROP TRIGGER IF EXISTS unit_revision_tag_immutable ON public.unit_revision_tag;
CREATE TRIGGER unit_revision_tag_immutable BEFORE DELETE OR UPDATE ON public.unit_revision_tag FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
