SET search_path TO public;

CREATE OR REPLACE FUNCTION public.guard_workload_principal()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE event public.workload_principal_event%ROWTYPE; erased timestamptz; owner_entity uuid;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Workload identities and history are retained' USING ERRCODE='55000'; END IF;
 SELECT erased_at INTO erased FROM public.users WHERE id=NEW.auth_user_id AND principal_kind='service' FOR UPDATE;
 IF NOT FOUND OR (erased IS NOT NULL AND (TG_OP='INSERT' OR NEW.state<>'revoked'))
 THEN RAISE EXCEPTION 'Workloads require a service principal; erased principals may only be revoked' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.credential_epoch<>0 OR NEW.state<>'draft' THEN RAISE EXCEPTION 'Workload admission starts at version zero' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.access_scope s LEFT JOIN public.reference_value r ON r.id=s.unit_ref
   LEFT JOIN public.users a ON a.id=s.auth_user_id LEFT JOIN public.entity_identity e ON e.id=r.target_entity_id
   WHERE s.id=NEW.owner_scope_id AND ((NEW.purpose='system' AND s.platform_root='platform') OR
    (NEW.purpose='installation' AND (a.principal_kind='human' OR (e.shape='organization') OR r.target_realm_id IS NOT NULL))))
  THEN RAISE EXCEPTION 'Workload purpose and owner scope are incompatible' USING ERRCODE='23514'; END IF;
  SELECT r.target_entity_id INTO owner_entity FROM public.access_scope s JOIN public.reference_value r ON r.id=s.unit_ref WHERE s.id=NEW.owner_scope_id;
  IF owner_entity IS NOT NULL THEN
   PERFORM id FROM public.entity_identity WHERE id=owner_entity AND shape='organization' FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Workload owner must remain an organization' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.auth_user_id,NEW.owner_scope_id,NEW.purpose,NEW.system_key) IS DISTINCT FROM ROW(OLD.auth_user_id,OLD.owner_scope_id,OLD.purpose,OLD.system_key)
  OR OLD.state='revoked' OR NEW.version<>OLD.version+1
 THEN RAISE EXCEPTION 'Workload owner, purpose and terminal revocation are immutable' USING ERRCODE='55000'; END IF;
 SELECT * INTO event FROM public.workload_principal_event WHERE auth_user_id=NEW.auth_user_id AND version=NEW.version;
 IF NOT FOUND OR ROW(NEW.state,NEW.credential_epoch) IS DISTINCT FROM ROW(event.state_after,event.credential_epoch_after)
 THEN RAISE EXCEPTION 'Workload control requires its exact receipt' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_workload_principal_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.workload_principal%ROWTYPE; actor_id uuid; expected_state text; expected_epoch bigint; prior_label text;
BEGIN
 PERFORM id FROM public.users WHERE id=NEW.auth_user_id FOR UPDATE;
 SELECT * INTO head FROM public.workload_principal WHERE auth_user_id=NEW.auth_user_id FOR UPDATE;
 IF NOT FOUND OR head.state='revoked' OR NEW.version<>head.version+1 THEN RAISE EXCEPTION 'Workload receipt is stale or revoked' USING ERRCODE='23514'; END IF;
 SELECT auth_user_id INTO actor_id FROM public.access_subject WHERE id=NEW.authority_subject_id;
 IF NOT FOUND OR (actor_id IS NOT NULL AND actor_id<>NEW.operator_auth_user_id)
 THEN RAISE EXCEPTION 'Workload authority subject does not match its operator' USING ERRCODE='23514'; END IF;
 expected_state:=head.state; expected_epoch:=head.credential_epoch;
 IF NEW.operation='create' THEN
  IF head.version<>0 THEN RAISE EXCEPTION 'Workload already exists' USING ERRCODE='23514'; END IF;
  expected_state:=CASE WHEN head.purpose='system' THEN 'active' ELSE 'suspended' END; expected_epoch:=1;
 ELSE
  IF head.version=0 THEN RAISE EXCEPTION 'Workload admission is incomplete' USING ERRCODE='23514'; END IF;
  SELECT label INTO prior_label FROM public.workload_principal_event WHERE auth_user_id=head.auth_user_id AND version=head.version;
  IF NEW.operation<>'rename' AND NEW.label IS DISTINCT FROM prior_label THEN RAISE EXCEPTION 'Lifecycle changes retain workload presentation' USING ERRCODE='23514'; END IF;
  IF NEW.operation='suspend' THEN
   IF head.state<>'active' THEN RAISE EXCEPTION 'Only an active workload can be suspended' USING ERRCODE='23514'; END IF;
   expected_state:='suspended'; expected_epoch:=expected_epoch+1;
  ELSIF NEW.operation='resume' THEN
   IF head.state<>'suspended' THEN RAISE EXCEPTION 'Only a suspended workload can resume' USING ERRCODE='23514'; END IF;
   expected_state:='active';
  ELSIF NEW.operation='revoke' THEN expected_state:='revoked'; expected_epoch:=expected_epoch+1;
  END IF;
 END IF;
 IF ROW(NEW.state_after,NEW.credential_epoch_after) IS DISTINCT FROM ROW(expected_state,expected_epoch)
 THEN RAISE EXCEPTION 'Workload transition does not match its operation' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.complete_workload_principal()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.workload_principal%ROWTYPE; event public.workload_principal_event%ROWTYPE;
BEGIN
 SELECT * INTO head FROM public.workload_principal WHERE auth_user_id=NEW.auth_user_id;
 IF NOT FOUND OR head.version=0 THEN RAISE EXCEPTION 'Workload admission must complete its first receipt' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='workload_principal_event' THEN
  IF head.version<NEW.version THEN RAISE EXCEPTION 'Workload receipt must advance its head' USING ERRCODE='23514'; END IF;
 ELSIF NEW.version>0 THEN
  SELECT * INTO event FROM public.workload_principal_event WHERE auth_user_id=NEW.auth_user_id AND version=NEW.version;
  IF NOT FOUND OR ROW(NEW.state,NEW.credential_epoch) IS DISTINCT FROM ROW(event.state_after,event.credential_epoch_after)
  THEN RAISE EXCEPTION 'Workload history must preserve every transition' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.guard_interactive_principal_credential()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM id FROM public.users WHERE id=NEW.user_id AND principal_kind='human' AND erased_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Interactive credentials require an unerased human principal' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.id,NEW.user_id) IS DISTINCT FROM ROW(OLD.id,OLD.user_id)
  THEN RAISE EXCEPTION 'Interactive credential identity and owner are immutable' USING ERRCODE='55000'; END IF;
  IF TG_TABLE_NAME='sessions' AND NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN RAISE EXCEPTION 'Session authentication time cannot be refreshed by metadata update' USING ERRCODE='55000'; END IF;
  IF TG_TABLE_NAME='accounts' THEN
   IF ROW(NEW.issuer,NEW.provider_id,NEW.account_id) IS DISTINCT FROM ROW(OLD.issuer,OLD.provider_id,OLD.account_id)
   THEN RAISE EXCEPTION 'Linked credential identity cannot be reassigned' USING ERRCODE='55000'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS workload_principal_guard ON public.workload_principal;
CREATE TRIGGER workload_principal_guard BEFORE INSERT OR UPDATE OR DELETE ON public.workload_principal FOR EACH ROW EXECUTE FUNCTION public.guard_workload_principal();
DROP TRIGGER IF EXISTS workload_principal_event_guard ON public.workload_principal_event;
CREATE TRIGGER workload_principal_event_guard BEFORE INSERT ON public.workload_principal_event FOR EACH ROW EXECUTE FUNCTION public.guard_workload_principal_event();
DROP TRIGGER IF EXISTS workload_principal_event_immutable ON public.workload_principal_event;
CREATE TRIGGER workload_principal_event_immutable BEFORE UPDATE OR DELETE ON public.workload_principal_event FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
DROP TRIGGER IF EXISTS workload_principal_complete ON public.workload_principal;
CREATE CONSTRAINT TRIGGER workload_principal_complete AFTER INSERT OR UPDATE ON public.workload_principal DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_workload_principal();
DROP TRIGGER IF EXISTS workload_principal_event_complete ON public.workload_principal_event;
CREATE CONSTRAINT TRIGGER workload_principal_event_complete AFTER INSERT ON public.workload_principal_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_workload_principal();
DROP TRIGGER IF EXISTS sessions_principal_kind_guard ON public.sessions;
CREATE TRIGGER sessions_principal_kind_guard BEFORE INSERT OR UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.guard_interactive_principal_credential();
DROP TRIGGER IF EXISTS accounts_principal_kind_guard ON public.accounts;
CREATE TRIGGER accounts_principal_kind_guard BEFORE INSERT OR UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.guard_interactive_principal_credential();
