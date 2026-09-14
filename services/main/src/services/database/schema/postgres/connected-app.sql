CREATE OR REPLACE FUNCTION public.guard_connected_app_head()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE event public.connected_app_event%ROWTYPE; selected_revision bigint;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'App identities and history are retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.authority_epoch<>0 OR NEW.state<>'draft' OR NEW.trust<>'unreviewed' OR NEW.declared_revision IS NOT NULL
  THEN RAISE EXCEPTION 'App admission starts with an unapproved empty identity' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.access_scope s LEFT JOIN public.reference_value r ON r.id=s.unit_ref
   WHERE s.id=NEW.scope_id AND (s.auth_user_id IS NOT NULL OR r.target_entity_id IS NOT NULL))
  THEN RAISE EXCEPTION 'An App controller must be an account or Entity root' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.id,NEW.scope_id) IS DISTINCT FROM ROW(OLD.id,OLD.scope_id) OR OLD.state='retired'
 THEN RAISE EXCEPTION 'App identity, controller root and retirement are immutable' USING ERRCODE='55000'; END IF;
 IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'App control advances by one' USING ERRCODE='23514'; END IF;
 SELECT * INTO event FROM public.connected_app_event WHERE app_id=NEW.id AND version=NEW.version;
 IF NOT FOUND THEN RAISE EXCEPTION 'App change requires its control receipt' USING ERRCODE='23514'; END IF;
 selected_revision:=CASE WHEN event.operation IN ('create','revise') THEN event.version ELSE event.retained_declared_revision END;
 IF ROW(NEW.state,NEW.trust,NEW.authority_epoch,NEW.declared_revision) IS DISTINCT FROM ROW(event.state_after,event.trust_after,event.authority_epoch_after,selected_revision)
  OR NOT EXISTS(SELECT 1 FROM public.connected_app_revision WHERE app_id=NEW.id AND revision=selected_revision AND sealed)
 THEN RAISE EXCEPTION 'App state and declaration must match the sealed receipt' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_connected_app_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.connected_app%ROWTYPE; actor_id uuid; expected_state text; expected_trust text; expected_epoch bigint;
BEGIN
 SELECT * INTO head FROM public.connected_app WHERE id=NEW.app_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'App identity is missing' USING ERRCODE='23503'; END IF;
 IF head.state='retired' OR NEW.version<>head.version+1 THEN RAISE EXCEPTION 'App receipt is stale or retired' USING ERRCODE='23514'; END IF;
 SELECT auth_user_id INTO actor_id FROM public.access_subject WHERE id=NEW.authority_subject_id;
 IF NOT FOUND OR (actor_id IS NOT NULL AND actor_id<>NEW.operator_auth_user_id)
 THEN RAISE EXCEPTION 'App authority subject does not match its operator' USING ERRCODE='23514'; END IF;
 expected_state:=head.state; expected_trust:=head.trust; expected_epoch:=head.authority_epoch;
 IF NEW.operation='create' THEN
  IF head.version<>0 THEN RAISE EXCEPTION 'App already exists' USING ERRCODE='23514'; END IF;
  expected_state:='active'; expected_trust:='unreviewed'; expected_epoch:=1;
 ELSE
  IF head.version=0 THEN RAISE EXCEPTION 'App first declaration is missing' USING ERRCODE='23514'; END IF;
  IF NEW.operation='disable' THEN
   IF head.state<>'active' THEN RAISE EXCEPTION 'Only an active App can be disabled' USING ERRCODE='23514'; END IF;
   expected_state:='disabled'; expected_epoch:=expected_epoch+1;
  ELSIF NEW.operation='enable' THEN
   IF head.state<>'disabled' OR head.trust='blocked' THEN RAISE EXCEPTION 'App cannot be enabled' USING ERRCODE='23514'; END IF;
   expected_state:='active';
  ELSIF NEW.operation='retire' THEN
   expected_state:='retired'; expected_epoch:=expected_epoch+1;
  ELSIF NEW.operation='set-trust' THEN
   IF NEW.trust_after=head.trust THEN RAISE EXCEPTION 'App trust is unchanged' USING ERRCODE='23514'; END IF;
   expected_trust:=NEW.trust_after;
   IF expected_trust='blocked' THEN expected_state:='disabled'; expected_epoch:=expected_epoch+1; END IF;
  END IF;
 END IF;
 IF ROW(NEW.state_after,NEW.trust_after,NEW.authority_epoch_after) IS DISTINCT FROM ROW(expected_state,expected_trust,expected_epoch)
  OR (NEW.operation NOT IN ('create','revise') AND NEW.retained_declared_revision IS DISTINCT FROM head.declared_revision)
 THEN RAISE EXCEPTION 'App transition does not match its declared operation' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_connected_app_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE amount integer; digest text;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'App declarations are retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.sealed OR NOT EXISTS(SELECT 1 FROM public.connected_app_event WHERE app_id=NEW.app_id AND version=NEW.revision AND operation IN ('create','revise'))
  THEN RAISE EXCEPTION 'An App declaration needs its open revision receipt' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.sealed OR NOT NEW.sealed OR ROW(NEW.app_id,NEW.revision,NEW.label,NEW.description,NEW.offline_access,NEW.entity_disclosure,NEW.capability_count,NEW.capability_digest)
  IS DISTINCT FROM ROW(OLD.app_id,OLD.revision,OLD.label,OLD.description,OLD.offline_access,OLD.entity_disclosure,OLD.capability_count,OLD.capability_digest)
 THEN RAISE EXCEPTION 'App declarations only transition from open to sealed' USING ERRCODE='55000'; END IF;
 SELECT count(*)::integer,encode(sha256(convert_to(coalesce(string_agg(family||':'||capability,E'\n' ORDER BY family COLLATE "C",capability COLLATE "C"),''),'UTF8')),'hex')
 INTO amount,digest FROM public.connected_app_capability WHERE app_id=NEW.app_id AND revision=NEW.revision;
 IF amount<>NEW.capability_count OR digest<>NEW.capability_digest THEN RAISE EXCEPTION 'App capability snapshot is incomplete' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_connected_app_capability()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE is_sealed boolean;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'App capability history is immutable' USING ERRCODE='55000'; END IF;
 SELECT sealed INTO is_sealed FROM public.connected_app_revision WHERE app_id=NEW.app_id AND revision=NEW.revision FOR UPDATE;
 IF NOT FOUND OR is_sealed THEN RAISE EXCEPTION 'App capability requires an open declaration' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.complete_connected_app()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.connected_app%ROWTYPE; event public.connected_app_event%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='connected_app' THEN
  SELECT * INTO head FROM public.connected_app WHERE id=NEW.id;
  IF NOT FOUND OR head.version=0 THEN RAISE EXCEPTION 'App admission must complete its first declaration' USING ERRCODE='23514'; END IF;
  IF NEW.version>0 THEN
   SELECT * INTO event FROM public.connected_app_event WHERE app_id=NEW.id AND version=NEW.version;
   IF NOT FOUND OR ROW(NEW.state,NEW.trust,NEW.authority_epoch,NEW.declared_revision) IS DISTINCT FROM
    ROW(event.state_after,event.trust_after,event.authority_epoch_after,CASE WHEN event.operation IN ('create','revise') THEN event.version ELSE event.retained_declared_revision END)
   THEN RAISE EXCEPTION 'App history must retain every control transition' USING ERRCODE='23514'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='connected_app_event' THEN
  SELECT * INTO head FROM public.connected_app WHERE id=NEW.app_id;
  IF NOT FOUND OR head.version<NEW.version THEN RAISE EXCEPTION 'App receipt must advance its head' USING ERRCODE='23514'; END IF;
  IF NEW.operation IN ('create','revise') AND NOT EXISTS(SELECT 1 FROM public.connected_app_revision WHERE app_id=NEW.app_id AND revision=NEW.version AND sealed)
  THEN RAISE EXCEPTION 'App declaration receipt must be sealed' USING ERRCODE='23514'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.connected_app_revision WHERE app_id=NEW.app_id AND revision=NEW.revision AND sealed)
  THEN RAISE EXCEPTION 'App declarations must be sealed before commit' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS connected_app_head_guard ON public.connected_app;
CREATE TRIGGER connected_app_head_guard BEFORE INSERT OR UPDATE OR DELETE ON public.connected_app FOR EACH ROW EXECUTE FUNCTION public.guard_connected_app_head();
DROP TRIGGER IF EXISTS connected_app_event_guard ON public.connected_app_event;
CREATE TRIGGER connected_app_event_guard BEFORE INSERT ON public.connected_app_event FOR EACH ROW EXECUTE FUNCTION public.guard_connected_app_event();
DROP TRIGGER IF EXISTS connected_app_event_immutable ON public.connected_app_event;
CREATE TRIGGER connected_app_event_immutable BEFORE UPDATE OR DELETE ON public.connected_app_event FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
DROP TRIGGER IF EXISTS connected_app_revision_guard ON public.connected_app_revision;
CREATE TRIGGER connected_app_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON public.connected_app_revision FOR EACH ROW EXECUTE FUNCTION public.guard_connected_app_revision();
DROP TRIGGER IF EXISTS connected_app_capability_guard ON public.connected_app_capability;
CREATE TRIGGER connected_app_capability_guard BEFORE INSERT OR UPDATE OR DELETE ON public.connected_app_capability FOR EACH ROW EXECUTE FUNCTION public.guard_connected_app_capability();
DROP TRIGGER IF EXISTS connected_app_head_complete ON public.connected_app;
CREATE CONSTRAINT TRIGGER connected_app_head_complete AFTER INSERT OR UPDATE ON public.connected_app DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_connected_app();
DROP TRIGGER IF EXISTS connected_app_event_complete ON public.connected_app_event;
CREATE CONSTRAINT TRIGGER connected_app_event_complete AFTER INSERT ON public.connected_app_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_connected_app();
DROP TRIGGER IF EXISTS connected_app_revision_complete ON public.connected_app_revision;
CREATE CONSTRAINT TRIGGER connected_app_revision_complete AFTER INSERT OR UPDATE ON public.connected_app_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_connected_app();
