CREATE OR REPLACE FUNCTION public.guard_oauth_client_secret_policy()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE event public.oauth_client_secret_event%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Client secret policy history is retained' USING ERRCODE='55000'; END IF;
 PERFORM id FROM public.oauth_client_authority WHERE id=NEW.client_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Client control identity is missing' USING ERRCODE='23503'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.state<>'draft' OR NEW.secret_digest IS NOT NULL OR NEW.valid_from IS NOT NULL OR NEW.valid_until IS NOT NULL
  THEN RAISE EXCEPTION 'Client secret policy starts without issued material' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.client_id<>OLD.client_id OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Client secret identity is fixed and control advances by one' USING ERRCODE='23514'; END IF;
 SELECT * INTO event FROM public.oauth_client_secret_event WHERE client_id=NEW.client_id AND version=NEW.version;
 IF NOT FOUND OR ROW(NEW.state,NEW.secret_digest,NEW.valid_from,NEW.valid_until) IS DISTINCT FROM ROW(event.state_after,event.secret_digest,event.valid_from,event.valid_until)
 THEN RAISE EXCEPTION 'Client secret head requires its exact receipt' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_oauth_client_secret_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.oauth_client_secret_policy%ROWTYPE; actor_id uuid;
BEGIN
 PERFORM id FROM public.oauth_client_authority WHERE id=NEW.client_id FOR UPDATE;
 SELECT * INTO head FROM public.oauth_client_secret_policy WHERE client_id=NEW.client_id FOR UPDATE;
 IF NOT FOUND OR NEW.version<>head.version+1 THEN RAISE EXCEPTION 'Client secret receipt is stale' USING ERRCODE='23514'; END IF;
 SELECT auth_user_id INTO actor_id FROM public.access_subject WHERE id=NEW.authority_subject_id;
 IF NOT FOUND OR (actor_id IS NOT NULL AND actor_id<>NEW.operator_auth_user_id)
 THEN RAISE EXCEPTION 'Secret authority subject does not match its operator' USING ERRCODE='23514'; END IF;
 IF NEW.operation='retire' THEN
  IF head.state<>'active' OR ROW(NEW.secret_digest,NEW.valid_from,NEW.valid_until) IS DISTINCT FROM ROW(head.secret_digest,head.valid_from,head.valid_until)
  THEN RAISE EXCEPTION 'Secret retirement must retain the retired material and lifetime' USING ERRCODE='23514'; END IF;
 ELSE
  IF (NEW.operation='issue') IS DISTINCT FROM (head.version=0) OR (NEW.operation='rotate' AND NEW.secret_digest IS NOT DISTINCT FROM head.secret_digest)
  THEN RAISE EXCEPTION 'Rotation must issue new secret material' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.oauth_client c JOIN public.oauth_client_authority a ON a.id=c.id
   WHERE c.id=NEW.client_id AND a.revoked_at IS NULL AND c.client_discovery_id IS NULL
    AND coalesce(c.token_endpoint_auth_method,'client_secret_basic') IN ('client_secret_basic','client_secret_post') AND c.client_secret=NEW.secret_digest)
  THEN RAISE EXCEPTION 'Secret receipt must match the current managed protocol secret' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.complete_oauth_client_secret_policy()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.oauth_client_secret_policy%ROWTYPE; event public.oauth_client_secret_event%ROWTYPE;
BEGIN
 SELECT * INTO head FROM public.oauth_client_secret_policy WHERE client_id=NEW.client_id;
 IF NOT FOUND OR head.version=0 THEN RAISE EXCEPTION 'Client secret policy must complete its first issuance' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='oauth_client_secret_event' THEN
  IF head.version<NEW.version THEN RAISE EXCEPTION 'Secret receipt must advance its head' USING ERRCODE='23514'; END IF;
 ELSIF NEW.version>0 THEN
  SELECT * INTO event FROM public.oauth_client_secret_event WHERE client_id=NEW.client_id AND version=NEW.version;
  IF NOT FOUND OR ROW(NEW.state,NEW.secret_digest,NEW.valid_from,NEW.valid_until) IS DISTINCT FROM ROW(event.state_after,event.secret_digest,event.valid_from,event.valid_until)
  THEN RAISE EXCEPTION 'Client secret history must preserve each transition' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.oauth_client_secret_is_current(p_client uuid)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 WITH evaluated AS MATERIALIZED(SELECT clock_timestamp() AS now)
 SELECT EXISTS(SELECT 1 FROM public.oauth_client c JOIN public.oauth_client_authority a ON a.id=c.id CROSS JOIN evaluated
  WHERE c.id=p_client AND a.revoked_at IS NULL AND c.disabled=false AND c.client_discovery_id IS NULL
   AND coalesce(c.token_endpoint_auth_method,'client_secret_basic') IN ('client_secret_basic','client_secret_post')
   AND EXISTS(SELECT 1 FROM public.oauth_client_secret_policy p WHERE p.client_id=c.id AND p.state='active' AND p.secret_digest=c.client_secret
    AND p.valid_from<=evaluated.now AND p.valid_until>evaluated.now))
$$;

DROP TRIGGER IF EXISTS oauth_client_secret_policy_guard ON public.oauth_client_secret_policy;
CREATE TRIGGER oauth_client_secret_policy_guard BEFORE INSERT OR UPDATE OR DELETE ON public.oauth_client_secret_policy FOR EACH ROW EXECUTE FUNCTION public.guard_oauth_client_secret_policy();
DROP TRIGGER IF EXISTS oauth_client_secret_event_guard ON public.oauth_client_secret_event;
CREATE TRIGGER oauth_client_secret_event_guard BEFORE INSERT ON public.oauth_client_secret_event FOR EACH ROW EXECUTE FUNCTION public.guard_oauth_client_secret_event();
DROP TRIGGER IF EXISTS oauth_client_secret_event_immutable ON public.oauth_client_secret_event;
CREATE TRIGGER oauth_client_secret_event_immutable BEFORE UPDATE OR DELETE ON public.oauth_client_secret_event FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
DROP TRIGGER IF EXISTS oauth_client_secret_policy_complete ON public.oauth_client_secret_policy;
CREATE CONSTRAINT TRIGGER oauth_client_secret_policy_complete AFTER INSERT OR UPDATE ON public.oauth_client_secret_policy DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_oauth_client_secret_policy();
DROP TRIGGER IF EXISTS oauth_client_secret_event_complete ON public.oauth_client_secret_event;
CREATE CONSTRAINT TRIGGER oauth_client_secret_event_complete AFTER INSERT ON public.oauth_client_secret_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_oauth_client_secret_policy();
