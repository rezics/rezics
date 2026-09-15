CREATE OR REPLACE FUNCTION public.connected_app_client_terms_match_protocol(p_client uuid,p_revision bigint)
RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 SELECT a.revoked_at IS NULL AND t.protocol_credential_epoch=a.credential_epoch AND c.scopes IS NOT NULL
  AND ((h.kind='user' AND coalesce(cardinality(c.client_credentials_scopes),0)=0 AND NOT coalesce('client_credentials'=ANY(c.grant_types),false)) OR
   (h.kind='installation' AND c.client_discovery_id IS NULL AND c.grant_types=ARRAY['client_credentials']::text[]
    AND coalesce(c.token_endpoint_auth_method,'client_secret_basic') IN ('client_secret_basic','client_secret_post','private_key_jwt')))
  AND NOT EXISTS(SELECT 1 FROM unnest(c.scopes) s(value) WHERE s.value IS NULL OR NOT (
   (h.kind='user' AND (s.value='openid' OR (s.value='offline_access' AND t.offline_access))) OR
   EXISTS(SELECT 1 FROM public.connected_app_client_capability v WHERE v.client_id=h.client_id AND v.revision=t.revision AND v.family='api' AND v.capability=s.value)))
  AND NOT EXISTS(SELECT 1 FROM public.connected_app_client_capability v WHERE v.client_id=h.client_id AND v.revision=t.revision AND v.family='api' AND NOT(v.capability=ANY(c.scopes)))
  AND (h.kind='user' OR (NOT t.offline_access AND c.client_credentials_scopes IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM unnest(c.client_credentials_scopes) s(value) WHERE s.value IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.connected_app_client_capability v WHERE v.client_id=h.client_id AND v.revision=t.revision AND v.family='api' AND v.capability=s.value))
   AND NOT EXISTS(SELECT 1 FROM public.connected_app_client_capability v WHERE v.client_id=h.client_id AND v.revision=t.revision AND v.family='api' AND NOT(v.capability=ANY(c.client_credentials_scopes)))))
 FROM public.connected_app_client h JOIN public.connected_app_client_revision t ON t.client_id=h.client_id AND t.revision=p_revision
 JOIN public.oauth_client_authority a ON a.id=h.client_id JOIN public.oauth_client c ON c.id=a.id WHERE h.client_id=p_client
$$;

CREATE OR REPLACE FUNCTION public.guard_connected_app_client_head()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE event public.connected_app_client_event%ROWTYPE; protocol public.oauth_client%ROWTYPE; selected_revision bigint;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Client admissions and history are retained' USING ERRCODE='55000'; END IF;
 PERFORM id FROM public.oauth_client_authority WHERE id=NEW.client_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Protocol client control is missing' USING ERRCODE='23503'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.credential_epoch<>0 OR NEW.state<>'draft' OR NEW.terms_revision IS NOT NULL
  THEN RAISE EXCEPTION 'Client admission starts with an open identity' USING ERRCODE='23514'; END IF;
  SELECT * INTO protocol FROM public.oauth_client WHERE id=NEW.client_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Protocol client is missing' USING ERRCODE='23503'; END IF;
  IF protocol.client_discovery_id IS NULL AND protocol.reference_id IS DISTINCT FROM NEW.app_id::text
  THEN RAISE EXCEPTION 'Managed protocol client does not belong to this App' USING ERRCODE='23514'; END IF;
  IF NEW.kind='user' THEN
   IF coalesce(cardinality(protocol.client_credentials_scopes),0)>0 OR coalesce('client_credentials'=ANY(protocol.grant_types),false)
   THEN RAISE EXCEPTION 'User clients cannot acquire autonomous privileges' USING ERRCODE='23514'; END IF;
  ELSE
   IF protocol.client_discovery_id IS NOT NULL OR protocol.grant_types IS DISTINCT FROM ARRAY['client_credentials']::text[]
    OR coalesce(protocol.token_endpoint_auth_method,'client_secret_basic') NOT IN ('client_secret_basic','client_secret_post','private_key_jwt')
   THEN RAISE EXCEPTION 'Installation clients require managed confidential client credentials' USING ERRCODE='23514'; END IF;
   PERFORM auth_user_id FROM public.workload_principal WHERE auth_user_id=NEW.workload_principal_id AND purpose='installation';
   IF NOT FOUND THEN RAISE EXCEPTION 'Installation client must name its installation workload' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.client_id,NEW.app_id,NEW.kind,NEW.workload_principal_id) IS DISTINCT FROM ROW(OLD.client_id,OLD.app_id,OLD.kind,OLD.workload_principal_id)
  OR OLD.state='revoked' OR NEW.version<>OLD.version+1
 THEN RAISE EXCEPTION 'Client admission identity and terminal revocation are immutable' USING ERRCODE='55000'; END IF;
 SELECT * INTO event FROM public.connected_app_client_event WHERE client_id=NEW.client_id AND version=NEW.version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Client change requires its receipt' USING ERRCODE='23514'; END IF;
 selected_revision:=CASE WHEN event.operation IN ('admit','revise') THEN event.version ELSE event.retained_terms_revision END;
 IF ROW(NEW.state,NEW.credential_epoch,NEW.terms_revision) IS DISTINCT FROM ROW(event.state_after,event.credential_epoch_after,selected_revision)
  OR NOT EXISTS(SELECT 1 FROM public.connected_app_client_revision WHERE client_id=NEW.client_id AND revision=selected_revision AND sealed)
 THEN RAISE EXCEPTION 'Client head must select its complete receipt and terms' USING ERRCODE='23514'; END IF;
 IF NEW.state='active' AND public.connected_app_client_terms_match_protocol(NEW.client_id,selected_revision) IS NOT TRUE
 THEN RAISE EXCEPTION 'Client terms no longer match current protocol policy' USING ERRCODE='23514'; END IF;
 IF NEW.state='active' AND OLD.state<>'active' THEN
  IF NOT EXISTS(SELECT 1 FROM public.connected_app WHERE id=NEW.app_id AND state='active' AND trust<>'blocked')
  THEN RAISE EXCEPTION 'Client activation requires an active App' USING ERRCODE='23514'; END IF;
  IF NEW.kind='installation' AND NOT EXISTS(SELECT 1 FROM public.workload_principal WHERE auth_user_id=NEW.workload_principal_id AND state='active' AND purpose='installation')
  THEN RAISE EXCEPTION 'Client activation requires its active installation workload' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_connected_app_client_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.connected_app_client%ROWTYPE; actor_id uuid; expected_state text; expected_epoch bigint;
BEGIN
 PERFORM id FROM public.oauth_client_authority WHERE id=NEW.client_id FOR UPDATE;
 SELECT * INTO head FROM public.connected_app_client WHERE client_id=NEW.client_id FOR UPDATE;
 IF NOT FOUND OR head.state='revoked' OR NEW.version<>head.version+1 THEN RAISE EXCEPTION 'Client receipt is stale or revoked' USING ERRCODE='23514'; END IF;
 SELECT auth_user_id INTO actor_id FROM public.access_subject WHERE id=NEW.authority_subject_id;
 IF NOT FOUND OR (actor_id IS NOT NULL AND actor_id<>NEW.operator_auth_user_id)
 THEN RAISE EXCEPTION 'Client authority subject does not match its operator' USING ERRCODE='23514'; END IF;
 expected_state:=head.state; expected_epoch:=head.credential_epoch;
 IF NEW.operation='admit' THEN
  IF head.version<>0 THEN RAISE EXCEPTION 'Client is already admitted' USING ERRCODE='23514'; END IF;
  expected_state:=CASE WHEN head.kind='user' THEN 'active' ELSE 'disabled' END; expected_epoch:=1;
 ELSE
  IF head.version=0 THEN RAISE EXCEPTION 'Client admission is incomplete' USING ERRCODE='23514'; END IF;
  IF NEW.operation='disable' THEN
   IF head.state<>'active' THEN RAISE EXCEPTION 'Only an active client can be disabled' USING ERRCODE='23514'; END IF;
   expected_state:='disabled'; expected_epoch:=expected_epoch+1;
  ELSIF NEW.operation='enable' THEN
   IF head.state<>'disabled' THEN RAISE EXCEPTION 'Only a disabled client can be enabled' USING ERRCODE='23514'; END IF;
   expected_state:='active';
  ELSIF NEW.operation='revoke' THEN expected_state:='revoked'; expected_epoch:=expected_epoch+1;
  END IF;
 END IF;
 IF ROW(NEW.state_after,NEW.credential_epoch_after) IS DISTINCT FROM ROW(expected_state,expected_epoch)
  OR (NEW.operation NOT IN ('admit','revise') AND NEW.retained_terms_revision IS DISTINCT FROM head.terms_revision)
 THEN RAISE EXCEPTION 'Client lifecycle does not match its operation' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_connected_app_client_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE parent public.connected_app_revision%ROWTYPE; amount integer; digest text;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Client terms are retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.sealed OR NOT EXISTS(SELECT 1 FROM public.connected_app_client_event WHERE client_id=NEW.client_id AND version=NEW.revision AND operation IN ('admit','revise'))
  THEN RAISE EXCEPTION 'Client terms require their open receipt' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.sealed OR NOT NEW.sealed OR ROW(NEW.client_id,NEW.revision,NEW.app_id,NEW.app_revision,NEW.protocol_credential_epoch,NEW.offline_access,NEW.entity_disclosure,NEW.capability_count,NEW.capability_digest)
  IS DISTINCT FROM ROW(OLD.client_id,OLD.revision,OLD.app_id,OLD.app_revision,OLD.protocol_credential_epoch,OLD.offline_access,OLD.entity_disclosure,OLD.capability_count,OLD.capability_digest)
 THEN RAISE EXCEPTION 'Client terms can only be sealed once' USING ERRCODE='55000'; END IF;
 SELECT * INTO parent FROM public.connected_app_revision WHERE app_id=NEW.app_id AND revision=NEW.app_revision AND sealed;
 IF NOT FOUND OR (NEW.offline_access AND NOT parent.offline_access) OR (NEW.entity_disclosure AND NOT parent.entity_disclosure)
 THEN RAISE EXCEPTION 'Client terms exceed the selected App declaration' USING ERRCODE='23514'; END IF;
 SELECT count(*)::integer,encode(sha256(convert_to(coalesce(string_agg(family||':'||capability,E'\n' ORDER BY family COLLATE "C",capability COLLATE "C"),''),'UTF8')),'hex')
 INTO amount,digest FROM public.connected_app_client_capability WHERE client_id=NEW.client_id AND revision=NEW.revision;
 IF amount<>NEW.capability_count OR digest<>NEW.capability_digest OR EXISTS(
  SELECT 1 FROM public.connected_app_client_capability v WHERE v.client_id=NEW.client_id AND v.revision=NEW.revision AND NOT EXISTS(
   SELECT 1 FROM public.connected_app_capability a WHERE a.app_id=NEW.app_id AND a.revision=NEW.app_revision AND a.family=v.family AND a.capability=v.capability))
 THEN RAISE EXCEPTION 'Client capability snapshot is incomplete or exceeds the App declaration' USING ERRCODE='23514'; END IF;
 IF public.connected_app_client_terms_match_protocol(NEW.client_id,NEW.revision) IS NOT TRUE
 THEN RAISE EXCEPTION 'Client capability snapshot does not match protocol limits' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_connected_app_client_capability()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE is_sealed boolean;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Client capability history is immutable' USING ERRCODE='55000'; END IF;
 SELECT sealed INTO is_sealed FROM public.connected_app_client_revision WHERE client_id=NEW.client_id AND revision=NEW.revision FOR UPDATE;
 IF NOT FOUND OR is_sealed THEN RAISE EXCEPTION 'Client capability requires open terms' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.complete_connected_app_client()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.connected_app_client%ROWTYPE; event public.connected_app_client_event%ROWTYPE;
BEGIN
 SELECT * INTO head FROM public.connected_app_client WHERE client_id=NEW.client_id;
 IF NOT FOUND OR head.version=0 THEN RAISE EXCEPTION 'Client admission must complete its first terms' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='connected_app_client_event' THEN
  IF head.version<NEW.version THEN RAISE EXCEPTION 'Client receipt must advance its head' USING ERRCODE='23514'; END IF;
  IF NEW.operation IN ('admit','revise') AND NOT EXISTS(SELECT 1 FROM public.connected_app_client_revision WHERE client_id=NEW.client_id AND revision=NEW.version AND sealed)
  THEN RAISE EXCEPTION 'Client receipt must seal its terms' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='connected_app_client_revision' THEN
  IF NOT EXISTS(SELECT 1 FROM public.connected_app_client_revision WHERE client_id=NEW.client_id AND revision=NEW.revision AND sealed)
  THEN RAISE EXCEPTION 'Client terms must be sealed before commit' USING ERRCODE='23514'; END IF;
 ELSIF NEW.version>0 THEN
  SELECT * INTO event FROM public.connected_app_client_event WHERE client_id=NEW.client_id AND version=NEW.version;
  IF NOT FOUND OR ROW(NEW.state,NEW.credential_epoch,NEW.terms_revision) IS DISTINCT FROM
   ROW(event.state_after,event.credential_epoch_after,CASE WHEN event.operation IN ('admit','revise') THEN event.version ELSE event.retained_terms_revision END)
  THEN RAISE EXCEPTION 'Client history must preserve every transition' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS connected_app_client_head_guard ON public.connected_app_client;
CREATE TRIGGER connected_app_client_head_guard BEFORE INSERT OR UPDATE OR DELETE ON public.connected_app_client FOR EACH ROW EXECUTE FUNCTION public.guard_connected_app_client_head();
DROP TRIGGER IF EXISTS connected_app_client_event_guard ON public.connected_app_client_event;
CREATE TRIGGER connected_app_client_event_guard BEFORE INSERT ON public.connected_app_client_event FOR EACH ROW EXECUTE FUNCTION public.guard_connected_app_client_event();
DROP TRIGGER IF EXISTS connected_app_client_event_immutable ON public.connected_app_client_event;
CREATE TRIGGER connected_app_client_event_immutable BEFORE UPDATE OR DELETE ON public.connected_app_client_event FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
DROP TRIGGER IF EXISTS connected_app_client_revision_guard ON public.connected_app_client_revision;
CREATE TRIGGER connected_app_client_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON public.connected_app_client_revision FOR EACH ROW EXECUTE FUNCTION public.guard_connected_app_client_revision();
DROP TRIGGER IF EXISTS connected_app_client_capability_guard ON public.connected_app_client_capability;
CREATE TRIGGER connected_app_client_capability_guard BEFORE INSERT OR UPDATE OR DELETE ON public.connected_app_client_capability FOR EACH ROW EXECUTE FUNCTION public.guard_connected_app_client_capability();
DROP TRIGGER IF EXISTS connected_app_client_head_complete ON public.connected_app_client;
CREATE CONSTRAINT TRIGGER connected_app_client_head_complete AFTER INSERT OR UPDATE ON public.connected_app_client DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_connected_app_client();
DROP TRIGGER IF EXISTS connected_app_client_event_complete ON public.connected_app_client_event;
CREATE CONSTRAINT TRIGGER connected_app_client_event_complete AFTER INSERT ON public.connected_app_client_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_connected_app_client();
DROP TRIGGER IF EXISTS connected_app_client_revision_complete ON public.connected_app_client_revision;
CREATE CONSTRAINT TRIGGER connected_app_client_revision_complete AFTER INSERT OR UPDATE ON public.connected_app_client_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_connected_app_client();
