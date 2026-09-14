-- Concrete account/Entity rows fence both existing and absent policy selections.
-- These guards serialize policy changes; management admission remains server-owned.
CREATE OR REPLACE FUNCTION public.fence_access_subject_policy()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE subject_id uuid; prior_id uuid; value jsonb;
BEGIN
 value:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 subject_id:=(value->>TG_ARGV[0])::uuid;
 IF TG_OP='UPDATE' THEN
  prior_id:=(to_jsonb(OLD)->>TG_ARGV[0])::uuid;
  IF subject_id IS DISTINCT FROM prior_id THEN RAISE EXCEPTION 'Policy subject identity is immutable' USING ERRCODE='55000'; END IF;
 END IF;
 IF TG_ARGV[1]='principal' THEN
  PERFORM id FROM public.users WHERE id=subject_id FOR NO KEY UPDATE;
 ELSIF TG_ARGV[1]='entity' THEN
  PERFORM id FROM public.entity_identity WHERE id=subject_id FOR NO KEY UPDATE;
 ELSE RAISE EXCEPTION 'Unknown policy fence owner' USING ERRCODE='22023';
 END IF;
 IF NOT FOUND AND TG_OP<>'DELETE' THEN RAISE EXCEPTION 'Policy subject is unavailable' USING ERRCODE='23503'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS user_account_state_authority_fence ON public.user_account_state;
CREATE TRIGGER user_account_state_authority_fence BEFORE INSERT OR UPDATE OR DELETE ON public.user_account_state
FOR EACH ROW EXECUTE FUNCTION public.fence_access_subject_policy('user_id','principal');
DROP TRIGGER IF EXISTS account_enforcement_authority_fence ON public.account_enforcement;
CREATE TRIGGER account_enforcement_authority_fence BEFORE INSERT OR UPDATE OR DELETE ON public.account_enforcement
FOR EACH ROW EXECUTE FUNCTION public.fence_access_subject_policy('auth_user_id','principal');
DROP TRIGGER IF EXISTS entity_participation_authority_fence ON public.entity_participation;
CREATE TRIGGER entity_participation_authority_fence BEFORE INSERT OR UPDATE OR DELETE ON public.entity_participation
FOR EACH ROW EXECUTE FUNCTION public.fence_access_subject_policy('entity_id','entity');
