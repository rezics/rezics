CREATE OR REPLACE FUNCTION public.guard_access_role_head()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE receipt public.access_role_event%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Role identity and history are retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.state<>'draft' OR NEW.active_revision IS NOT NULL THEN RAISE EXCEPTION 'Role creation begins with an unactivated identity' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.id,NEW.scope_id) IS DISTINCT FROM ROW(OLD.id,OLD.scope_id) OR OLD.state='retired' THEN
  RAISE EXCEPTION 'Role identity and retirement are immutable' USING ERRCODE='55000';
 END IF;
 IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Role version must advance by one' USING ERRCODE='23514'; END IF;
 SELECT * INTO receipt FROM public.access_role_event WHERE role_id=NEW.id AND version=NEW.version;
 IF NOT FOUND OR ROW(receipt.state_after,receipt.active_revision) IS DISTINCT FROM ROW(NEW.state,NEW.active_revision) THEN
  RAISE EXCEPTION 'Role transition requires its exact receipt' USING ERRCODE='23514';
 END IF;
 IF NEW.active_revision IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.access_role_revision WHERE role_id=NEW.id AND revision=NEW.active_revision AND sealed) THEN
  RAISE EXCEPTION 'Role activation requires a sealed exact definition' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_role_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.access_role%ROWTYPE; declared_actor uuid;
BEGIN
 SELECT * INTO head FROM public.access_role WHERE id=NEW.role_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Role identity is missing' USING ERRCODE='23503'; END IF;
 SELECT auth_user_id INTO declared_actor FROM public.access_subject WHERE id=NEW.authority_subject_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Authority subject is missing' USING ERRCODE='23503'; END IF;
 IF declared_actor IS NOT NULL AND declared_actor<>NEW.operator_auth_user_id THEN RAISE EXCEPTION 'Direct authority cannot name a different private actor' USING ERRCODE='23514'; END IF;
 IF head.state='retired' OR NEW.version<>head.version+1 THEN RAISE EXCEPTION 'Role receipt is stale or retired' USING ERRCODE='23514'; END IF;
 IF NEW.operation='create' THEN
  IF head.version<>0 OR NEW.state_after<>'draft' OR NEW.active_revision IS NOT NULL THEN RAISE EXCEPTION 'Invalid role creation receipt' USING ERRCODE='23514'; END IF;
 ELSIF NEW.operation='revise' THEN
  IF head.version=0 OR NEW.state_after<>head.state OR NEW.active_revision IS DISTINCT FROM head.active_revision THEN RAISE EXCEPTION 'A proposed definition does not change activation' USING ERRCODE='23514'; END IF;
 ELSIF NEW.operation='activate' THEN
  IF head.version=0 OR NEW.state_after<>'active' OR NEW.active_revision IS NULL OR NOT EXISTS(SELECT 1 FROM public.access_role_revision WHERE role_id=head.id AND revision=NEW.active_revision AND sealed) THEN RAISE EXCEPTION 'Activation requires a complete definition' USING ERRCODE='23514'; END IF;
 ELSIF NEW.operation='retire' THEN
  IF head.version=0 OR NEW.state_after<>'retired' OR NEW.active_revision IS DISTINCT FROM head.active_revision THEN RAISE EXCEPTION 'Retirement retains the last selected definition' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_role_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE event_kind text; actual_count integer; actual_digest text;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Role definitions are immutable' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  SELECT operation INTO event_kind FROM public.access_role_event WHERE role_id=NEW.role_id AND version=NEW.revision;
  IF event_kind IS NULL THEN RAISE EXCEPTION 'Definition receipt is missing' USING ERRCODE='23503'; END IF;
  IF event_kind NOT IN ('create','revise') OR NEW.sealed THEN RAISE EXCEPTION 'Definition must be written before sealing under its creation receipt' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.sealed OR NOT NEW.sealed OR (to_jsonb(NEW)-'sealed') IS DISTINCT FROM (to_jsonb(OLD)-'sealed') THEN
  RAISE EXCEPTION 'Only sealing can change a role definition' USING ERRCODE='55000';
 END IF;
 SELECT count(*)::integer, encode(sha256(convert_to(coalesce(string_agg(family||':'||permission,E'\n' ORDER BY family COLLATE "C",permission COLLATE "C"),''),'UTF8')),'hex')
 INTO actual_count,actual_digest FROM public.access_role_permission WHERE role_id=NEW.role_id AND revision=NEW.revision;
 IF actual_count<>NEW.permission_count OR actual_digest<>NEW.permission_digest THEN RAISE EXCEPTION 'Role permission snapshot is incomplete or inconsistent' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_role_permission()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE is_sealed boolean;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Role permission history is immutable' USING ERRCODE='55000'; END IF;
 SELECT sealed INTO is_sealed FROM public.access_role_revision WHERE role_id=NEW.role_id AND revision=NEW.revision FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Role definition is missing' USING ERRCODE='23503'; END IF;
 IF is_sealed THEN RAISE EXCEPTION 'A sealed definition cannot gain permissions' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.validate_access_role_history()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE final_version bigint; receipt public.access_role_event%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='access_role' THEN
  SELECT version INTO final_version FROM public.access_role WHERE id=NEW.id;
  IF final_version=0 THEN RAISE EXCEPTION 'Role creation requires a complete first definition' USING ERRCODE='23514'; END IF;
  IF NEW.version>0 THEN
   SELECT * INTO receipt FROM public.access_role_event WHERE role_id=NEW.id AND version=NEW.version;
   IF NOT FOUND OR ROW(receipt.state_after,receipt.active_revision) IS DISTINCT FROM ROW(NEW.state,NEW.active_revision) THEN RAISE EXCEPTION 'Role history must preserve every head transition' USING ERRCODE='23514'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='access_role_event' THEN
  SELECT version INTO final_version FROM public.access_role WHERE id=NEW.role_id;
  IF final_version<NEW.version THEN RAISE EXCEPTION 'A role receipt must advance the head' USING ERRCODE='23514'; END IF;
  IF NEW.operation IN ('create','revise') AND NOT EXISTS(SELECT 1 FROM public.access_role_revision WHERE role_id=NEW.role_id AND revision=NEW.version AND sealed) THEN RAISE EXCEPTION 'A definition receipt requires its complete sealed snapshot' USING ERRCODE='23514'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.access_role_revision WHERE role_id=NEW.role_id AND revision=NEW.revision AND sealed) THEN RAISE EXCEPTION 'Role definitions must be sealed before commit' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS access_role_head_guard ON public.access_role;
CREATE TRIGGER access_role_head_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_role FOR EACH ROW EXECUTE FUNCTION public.guard_access_role_head();
DROP TRIGGER IF EXISTS access_role_event_guard ON public.access_role_event;
CREATE TRIGGER access_role_event_guard BEFORE INSERT ON public.access_role_event FOR EACH ROW EXECUTE FUNCTION public.guard_access_role_event();
DROP TRIGGER IF EXISTS access_role_event_immutable ON public.access_role_event;
CREATE TRIGGER access_role_event_immutable BEFORE UPDATE OR DELETE ON public.access_role_event FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
DROP TRIGGER IF EXISTS access_role_revision_guard ON public.access_role_revision;
CREATE TRIGGER access_role_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_role_revision FOR EACH ROW EXECUTE FUNCTION public.guard_access_role_revision();
DROP TRIGGER IF EXISTS access_role_permission_guard ON public.access_role_permission;
CREATE TRIGGER access_role_permission_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_role_permission FOR EACH ROW EXECUTE FUNCTION public.guard_access_role_permission();
DROP TRIGGER IF EXISTS access_role_head_complete ON public.access_role;
CREATE CONSTRAINT TRIGGER access_role_head_complete AFTER INSERT OR UPDATE ON public.access_role DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_role_history();
DROP TRIGGER IF EXISTS access_role_event_complete ON public.access_role_event;
CREATE CONSTRAINT TRIGGER access_role_event_complete AFTER INSERT ON public.access_role_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_role_history();
DROP TRIGGER IF EXISTS access_role_revision_complete ON public.access_role_revision;
CREATE CONSTRAINT TRIGGER access_role_revision_complete AFTER INSERT OR UPDATE ON public.access_role_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_role_history();
