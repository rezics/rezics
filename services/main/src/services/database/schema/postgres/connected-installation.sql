CREATE OR REPLACE FUNCTION public.guard_connected_installation_head()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE event public.connected_installation_event%ROWTYPE; selected_revision bigint;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Installation identity and history are retained' USING ERRCODE='55000'; END IF;
 PERFORM id FROM public.users WHERE id=NEW.workload_principal_id FOR UPDATE;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.credential_epoch<>0 OR NEW.state<>'draft' OR NEW.approved_revision IS NOT NULL
  THEN RAISE EXCEPTION 'Installation preparation starts without approval' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.workload_principal WHERE auth_user_id=NEW.workload_principal_id AND owner_scope_id=NEW.owner_scope_id AND purpose='installation')
  THEN RAISE EXCEPTION 'Installation must own its exact workload scope' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.id,NEW.app_id,NEW.owner_scope_id,NEW.workload_principal_id) IS DISTINCT FROM ROW(OLD.id,OLD.app_id,OLD.owner_scope_id,OLD.workload_principal_id)
  OR OLD.state='revoked' OR NEW.version<>OLD.version+1
 THEN RAISE EXCEPTION 'Installation identity and terminal revocation are immutable' USING ERRCODE='55000'; END IF;
 SELECT * INTO event FROM public.connected_installation_event WHERE installation_id=NEW.id AND version=NEW.version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Installation change requires its receipt' USING ERRCODE='23514'; END IF;
 selected_revision:=CASE WHEN event.operation='approve' THEN event.version ELSE event.retained_approved_revision END;
 IF ROW(NEW.state,NEW.credential_epoch,NEW.approved_revision) IS DISTINCT FROM ROW(event.state_after,event.credential_epoch_after,selected_revision)
 THEN RAISE EXCEPTION 'Installation state must match its receipt' USING ERRCODE='23514'; END IF;
 IF selected_revision IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.connected_installation_revision WHERE installation_id=NEW.id AND revision=selected_revision AND sealed)
 THEN RAISE EXCEPTION 'Installation must select a sealed approval' USING ERRCODE='23514'; END IF;
 IF NEW.state='active' AND NOT EXISTS(SELECT 1 FROM public.workload_principal WHERE auth_user_id=NEW.workload_principal_id AND purpose='installation' AND state='active')
 THEN RAISE EXCEPTION 'Installation activation requires its active workload' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_connected_installation_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.connected_installation%ROWTYPE; actor_id uuid; expected_state text; expected_epoch bigint;
BEGIN
 SELECT * INTO head FROM public.connected_installation WHERE id=NEW.installation_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Installation is missing' USING ERRCODE='23503'; END IF;
 PERFORM id FROM public.users WHERE id=head.workload_principal_id FOR UPDATE;
 SELECT * INTO head FROM public.connected_installation WHERE id=NEW.installation_id FOR UPDATE;
 IF head.state='revoked' OR NEW.version<>head.version+1 THEN RAISE EXCEPTION 'Installation receipt is stale or revoked' USING ERRCODE='23514'; END IF;
 SELECT auth_user_id INTO actor_id FROM public.access_subject WHERE id=NEW.authority_subject_id;
 IF NOT FOUND OR (actor_id IS NOT NULL AND actor_id<>NEW.operator_auth_user_id)
 THEN RAISE EXCEPTION 'Installation authority subject does not match its operator' USING ERRCODE='23514'; END IF;
 expected_state:=head.state; expected_epoch:=head.credential_epoch;
 IF NEW.operation='prepare' THEN
  IF head.version<>0 THEN RAISE EXCEPTION 'Installation already exists' USING ERRCODE='23514'; END IF;
  expected_state:='pending'; expected_epoch:=1;
 ELSE
  IF head.version=0 THEN RAISE EXCEPTION 'Installation preparation is incomplete' USING ERRCODE='23514'; END IF;
  IF NEW.operation='approve' THEN expected_state:='active'; expected_epoch:=expected_epoch+1;
  ELSIF NEW.operation='suspend' THEN
   IF head.state<>'active' THEN RAISE EXCEPTION 'Only an active installation can suspend' USING ERRCODE='23514'; END IF;
   expected_state:='suspended'; expected_epoch:=expected_epoch+1;
  ELSIF NEW.operation='resume' THEN
   IF head.state<>'suspended' THEN RAISE EXCEPTION 'Only a suspended installation can resume' USING ERRCODE='23514'; END IF;
   expected_state:='active';
  ELSIF NEW.operation='revoke' THEN expected_state:='revoked'; expected_epoch:=expected_epoch+1;
  END IF;
 END IF;
 IF ROW(NEW.state_after,NEW.credential_epoch_after) IS DISTINCT FROM ROW(expected_state,expected_epoch)
  OR (NEW.operation NOT IN ('prepare','approve') AND NEW.retained_approved_revision IS DISTINCT FROM head.approved_revision)
 THEN RAISE EXCEPTION 'Installation lifecycle does not match its operation' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_connected_installation_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE parent public.connected_app_revision%ROWTYPE; owner_workload uuid; amount integer; digest text;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Installation approvals are retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.sealed OR NOT EXISTS(SELECT 1 FROM public.connected_installation_event WHERE installation_id=NEW.installation_id AND version=NEW.revision AND operation='approve')
  THEN RAISE EXCEPTION 'Installation approval requires its open receipt' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.sealed OR NOT NEW.sealed OR (to_jsonb(NEW)-'sealed') IS DISTINCT FROM (to_jsonb(OLD)-'sealed')
 THEN RAISE EXCEPTION 'Installation approvals can only be sealed once' USING ERRCODE='55000'; END IF;
 SELECT * INTO parent FROM public.connected_app_revision WHERE app_id=NEW.app_id AND revision=NEW.app_revision AND sealed;
 IF NOT FOUND OR (NEW.attribution_entity_id IS NOT NULL AND NOT parent.entity_disclosure)
 THEN RAISE EXCEPTION 'Installation approval exceeds the App declaration' USING ERRCODE='23514'; END IF;
 SELECT workload_principal_id INTO owner_workload FROM public.connected_installation WHERE id=NEW.installation_id;
 PERFORM scope_id FROM public.access_role_binding_scope WHERE scope_id IN (
  SELECT h.target_scope_id FROM public.connected_installation_binding b JOIN public.access_role_binding h ON h.id=b.binding_id
  WHERE b.installation_id=NEW.installation_id AND b.revision=NEW.revision) ORDER BY scope_id FOR SHARE;
 PERFORM id FROM public.access_role_binding WHERE id IN (
  SELECT binding_id FROM public.connected_installation_binding WHERE installation_id=NEW.installation_id AND revision=NEW.revision) ORDER BY id FOR SHARE;
 SELECT count(*)::integer,encode(sha256(convert_to(coalesce(string_agg(family||':'||capability,E'\n' ORDER BY family COLLATE "C",capability COLLATE "C"),''),'UTF8')),'hex')
 INTO amount,digest FROM public.connected_installation_capability WHERE installation_id=NEW.installation_id AND revision=NEW.revision;
 IF amount<>NEW.capability_count OR digest<>NEW.capability_digest OR EXISTS(
  SELECT 1 FROM public.connected_installation_capability v WHERE v.installation_id=NEW.installation_id AND v.revision=NEW.revision AND NOT EXISTS(
   SELECT 1 FROM public.connected_app_capability a WHERE a.app_id=NEW.app_id AND a.revision=NEW.app_revision AND a.family=v.family AND a.capability=v.capability))
 THEN RAISE EXCEPTION 'Installation capability snapshot is incomplete or exceeds the App declaration' USING ERRCODE='23514'; END IF;
 SELECT count(*)::integer,encode(sha256(convert_to(coalesce(string_agg(binding_id::text||':'||terms_revision::text,E'\n' ORDER BY binding_id),''),'UTF8')),'hex')
 INTO amount,digest FROM public.connected_installation_binding WHERE installation_id=NEW.installation_id AND revision=NEW.revision;
 IF amount<>NEW.binding_count OR digest<>NEW.binding_digest THEN RAISE EXCEPTION 'Installation binding snapshot is incomplete' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.connected_installation_binding b LEFT JOIN public.access_role_binding h ON h.id=b.binding_id
  LEFT JOIN public.access_role_binding_revision t ON t.binding_id=b.binding_id AND t.revision=b.terms_revision
  LEFT JOIN public.access_subject s ON s.id=h.recipient_subject_id
  WHERE b.installation_id=NEW.installation_id AND b.revision=NEW.revision AND
   (h.id IS NULL OR h.state<>'active' OR h.terms_revision<>b.terms_revision OR h.recipient_kind<>'subject' OR s.auth_user_id IS DISTINCT FROM owner_workload
    OR t.binding_id IS NULL OR NOT t.sealed OR t.permission_policy<>'frozen-ceiling'))
 THEN RAISE EXCEPTION 'Installation grants must be current frozen bindings to its workload' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.connected_installation_binding b JOIN public.access_role_binding_permission p ON p.binding_id=b.binding_id AND p.revision=b.terms_revision
  WHERE b.installation_id=NEW.installation_id AND b.revision=NEW.revision AND NOT EXISTS(
   SELECT 1 FROM public.connected_installation_capability v WHERE v.installation_id=NEW.installation_id AND v.revision=NEW.revision AND v.family=p.family AND v.capability=p.permission))
 THEN RAISE EXCEPTION 'Installation binding permissions exceed the approved capability ceiling' USING ERRCODE='23514'; END IF;
 SELECT count(*)::integer,encode(sha256(convert_to(coalesce(string_agg(grant_id::text||':'||terms_revision::text,E'\n' ORDER BY grant_id),''),'UTF8')),'hex')
 INTO amount,digest FROM public.connected_installation_attribution WHERE installation_id=NEW.installation_id AND revision=NEW.revision;
 IF amount<>NEW.attribution_count OR digest<>NEW.attribution_digest THEN RAISE EXCEPTION 'Installation attribution snapshot is incomplete' USING ERRCODE='23514'; END IF;
 IF NEW.attribution_entity_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.connected_installation_attribution a JOIN public.access_representation r ON r.id=a.grant_id
  WHERE a.installation_id=NEW.installation_id AND a.revision=NEW.revision AND r.entity_id=NEW.attribution_entity_id)
 THEN RAISE EXCEPTION 'Attribution context must include the selected Entity' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_connected_installation_member()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE is_sealed boolean;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Installation approval members are immutable' USING ERRCODE='55000'; END IF;
 SELECT sealed INTO is_sealed FROM public.connected_installation_revision WHERE installation_id=NEW.installation_id AND revision=NEW.revision FOR UPDATE;
 IF NOT FOUND OR is_sealed THEN RAISE EXCEPTION 'Installation member requires an open approval' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='connected_installation_binding' THEN
  IF (SELECT count(*) FROM (SELECT 1 FROM public.connected_installation_binding WHERE installation_id=NEW.installation_id AND revision=NEW.revision LIMIT 64) b)>=64
  THEN RAISE EXCEPTION 'Installation binding budget exceeded' USING ERRCODE='54000'; END IF;
 ELSIF TG_TABLE_NAME='connected_installation_attribution' THEN
  IF (SELECT count(*) FROM (SELECT 1 FROM public.connected_installation_attribution WHERE installation_id=NEW.installation_id AND revision=NEW.revision LIMIT 8) a)>=8
  THEN RAISE EXCEPTION 'Installation attribution budget exceeded' USING ERRCODE='54000'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.complete_connected_installation()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.connected_installation%ROWTYPE; event public.connected_installation_event%ROWTYPE; owner_id uuid;
BEGIN
 IF TG_TABLE_NAME='connected_installation' THEN owner_id:=NEW.id; ELSE owner_id:=NEW.installation_id; END IF;
 SELECT * INTO head FROM public.connected_installation WHERE id=owner_id;
 IF NOT FOUND OR head.version=0 THEN RAISE EXCEPTION 'Installation must complete its preparation' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='connected_installation_event' THEN
  IF head.version<NEW.version THEN RAISE EXCEPTION 'Installation receipt must advance its head' USING ERRCODE='23514'; END IF;
  IF NEW.operation='approve' AND NOT EXISTS(SELECT 1 FROM public.connected_installation_revision WHERE installation_id=owner_id AND revision=NEW.version AND sealed)
  THEN RAISE EXCEPTION 'Installation approval receipt must be sealed' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='connected_installation_revision' THEN
  IF NOT EXISTS(SELECT 1 FROM public.connected_installation_revision WHERE installation_id=owner_id AND revision=NEW.revision AND sealed)
  THEN RAISE EXCEPTION 'Installation approval must be sealed before commit' USING ERRCODE='23514'; END IF;
 ELSIF NEW.version>0 THEN
  SELECT * INTO event FROM public.connected_installation_event WHERE installation_id=owner_id AND version=NEW.version;
  IF NOT FOUND OR ROW(NEW.state,NEW.credential_epoch,NEW.approved_revision) IS DISTINCT FROM
   ROW(event.state_after,event.credential_epoch_after,CASE WHEN event.operation='approve' THEN event.version ELSE event.retained_approved_revision END)
  THEN RAISE EXCEPTION 'Installation history must preserve every transition' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS connected_installation_head_guard ON public.connected_installation;
CREATE TRIGGER connected_installation_head_guard BEFORE INSERT OR UPDATE OR DELETE ON public.connected_installation FOR EACH ROW EXECUTE FUNCTION public.guard_connected_installation_head();
DROP TRIGGER IF EXISTS connected_installation_event_guard ON public.connected_installation_event;
CREATE TRIGGER connected_installation_event_guard BEFORE INSERT ON public.connected_installation_event FOR EACH ROW EXECUTE FUNCTION public.guard_connected_installation_event();
DROP TRIGGER IF EXISTS connected_installation_event_immutable ON public.connected_installation_event;
CREATE TRIGGER connected_installation_event_immutable BEFORE UPDATE OR DELETE ON public.connected_installation_event FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
DROP TRIGGER IF EXISTS connected_installation_revision_guard ON public.connected_installation_revision;
CREATE TRIGGER connected_installation_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON public.connected_installation_revision FOR EACH ROW EXECUTE FUNCTION public.guard_connected_installation_revision();
DROP TRIGGER IF EXISTS connected_installation_capability_guard ON public.connected_installation_capability;
CREATE TRIGGER connected_installation_capability_guard BEFORE INSERT OR UPDATE OR DELETE ON public.connected_installation_capability FOR EACH ROW EXECUTE FUNCTION public.guard_connected_installation_member();
DROP TRIGGER IF EXISTS connected_installation_binding_guard ON public.connected_installation_binding;
CREATE TRIGGER connected_installation_binding_guard BEFORE INSERT OR UPDATE OR DELETE ON public.connected_installation_binding FOR EACH ROW EXECUTE FUNCTION public.guard_connected_installation_member();
DROP TRIGGER IF EXISTS connected_installation_attribution_guard ON public.connected_installation_attribution;
CREATE TRIGGER connected_installation_attribution_guard BEFORE INSERT OR UPDATE OR DELETE ON public.connected_installation_attribution FOR EACH ROW EXECUTE FUNCTION public.guard_connected_installation_member();
DROP TRIGGER IF EXISTS connected_installation_head_complete ON public.connected_installation;
CREATE CONSTRAINT TRIGGER connected_installation_head_complete AFTER INSERT OR UPDATE ON public.connected_installation DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_connected_installation();
DROP TRIGGER IF EXISTS connected_installation_event_complete ON public.connected_installation_event;
CREATE CONSTRAINT TRIGGER connected_installation_event_complete AFTER INSERT ON public.connected_installation_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_connected_installation();
DROP TRIGGER IF EXISTS connected_installation_revision_complete ON public.connected_installation_revision;
CREATE CONSTRAINT TRIGGER connected_installation_revision_complete AFTER INSERT OR UPDATE ON public.connected_installation_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_connected_installation();
