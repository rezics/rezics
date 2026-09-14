CREATE OR REPLACE FUNCTION public.guard_api_key_authority()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Credential control identities are retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'Credential authority begins at version zero' USING ERRCODE='23514'; END IF;
 ELSIF ROW(NEW.id,NEW.user_id) IS DISTINCT FROM ROW(OLD.id,OLD.user_id) OR NEW.version<>OLD.version+1 OR OLD.revoked_at IS NOT NULL THEN
  RAISE EXCEPTION 'Credential owner is immutable and revocation is terminal' USING ERRCODE='55000';
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.fence_api_key_authority()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  PERFORM id FROM public.users WHERE id=NEW.reference_id AND principal_kind='human' AND erased_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Personal API keys require an unerased human principal' USING ERRCODE='23514'; END IF;
  INSERT INTO public.api_key_authority(id,user_id) VALUES(NEW.id,NEW.reference_id);
  RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.id,NEW.reference_id) IS DISTINCT FROM ROW(OLD.id,OLD.reference_id) THEN RAISE EXCEPTION 'Personal credential identities cannot change owners' USING ERRCODE='55000'; END IF;
  IF ROW(NEW.config_id,NEW.key,NEW.enabled,NEW.expires_at,NEW.permissions,NEW.metadata,NEW.rate_limit_enabled,NEW.rate_limit_time_window,NEW.rate_limit_max)
    IS NOT DISTINCT FROM ROW(OLD.config_id,OLD.key,OLD.enabled,OLD.expires_at,OLD.permissions,OLD.metadata,OLD.rate_limit_enabled,OLD.rate_limit_time_window,OLD.rate_limit_max) THEN RETURN NEW; END IF;
 END IF;
 UPDATE public.api_key_authority SET version=version+1,revoked_at=CASE WHEN TG_OP='DELETE' THEN clock_timestamp() ELSE NULL END
 WHERE id=OLD.id AND user_id=OLD.reference_id AND revoked_at IS NULL;
 IF NOT FOUND THEN
  -- Bounded erasure may remove an already logically revoked provider record.
  IF TG_OP<>'DELETE' OR NOT EXISTS(SELECT 1 FROM public.api_key_authority WHERE id=OLD.id AND user_id=OLD.reference_id AND revoked_at IS NOT NULL) THEN
   RAISE EXCEPTION 'Credential authority is missing or revoked' USING ERRCODE='23514';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS api_key_authority_guard ON public.api_key_authority;
CREATE TRIGGER api_key_authority_guard BEFORE INSERT OR UPDATE OR DELETE ON public.api_key_authority FOR EACH ROW EXECUTE FUNCTION public.guard_api_key_authority();
DROP TRIGGER IF EXISTS apikey_authority_fence ON public.apikeys;
CREATE TRIGGER apikey_authority_fence BEFORE INSERT OR UPDATE OR DELETE ON public.apikeys FOR EACH ROW EXECUTE FUNCTION public.fence_api_key_authority();
