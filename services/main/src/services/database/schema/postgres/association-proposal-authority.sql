-- Two-sided consent retains the private authority admitted by the initiating request.
CREATE OR REPLACE FUNCTION public.association_proposal_guard_authority()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE creator_auth uuid;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.source_unit_id,NEW.target_unit_id,NEW.context_post_id,NEW.kind,NEW.role,NEW.direction,NEW.created_by_profile_id,NEW.creator_authority,NEW.expires_at,NEW.created_at) IS DISTINCT FROM
 (OLD.source_unit_id,OLD.target_unit_id,OLD.context_post_id,OLD.kind,OLD.role,OLD.direction,OLD.created_by_profile_id,OLD.creator_authority,OLD.expires_at,OLD.created_at) THEN
  RAISE EXCEPTION 'Association proposal admission and scope are immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP='INSERT' THEN
  -- Stored generated FK columns are not available to BEFORE triggers; validate the authoritative JSON.
  creator_auth := (NEW.creator_authority->'principal'->>'authUserId')::uuid;
  PERFORM 1 FROM public.auth_entity a JOIN public.users u ON u.id=a.auth_user_id
   WHERE a.auth_user_id=creator_auth AND a.entity_id=NEW.created_by_profile_id AND a.state='active' AND u.erased_at IS NULL FOR SHARE OF a,u;
  IF NOT FOUND THEN RAISE EXCEPTION 'Association creator must be the admitted account self identity' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.resolution IS NOT NULL THEN
  IF TG_OP='UPDATE' AND OLD.resolution IS NOT NULL THEN RAISE EXCEPTION 'Association resolution is immutable' USING ERRCODE='23514'; END IF;
  PERFORM 1 FROM public.auth_entity a JOIN public.users u ON u.id=a.auth_user_id
   WHERE a.auth_user_id=NEW.resolved_by_auth_user_id AND a.entity_id=NEW.resolved_by_profile_id AND a.state='active' AND u.erased_at IS NULL FOR SHARE OF a,u;
  IF NOT FOUND THEN RAISE EXCEPTION 'Association resolver must be an active account self identity' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS association_proposal_authority_guard ON public.unit_association_proposal;
CREATE TRIGGER association_proposal_authority_guard BEFORE INSERT OR UPDATE ON public.unit_association_proposal FOR EACH ROW EXECUTE FUNCTION public.association_proposal_guard_authority();
