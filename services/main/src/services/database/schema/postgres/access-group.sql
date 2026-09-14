CREATE OR REPLACE FUNCTION public.guard_access_group_tree()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Group tree fence is retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 THEN RAISE EXCEPTION 'Group tree starts at version zero' USING ERRCODE='23514'; END IF;
 ELSIF NEW.scope_id<>OLD.scope_id OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Group tree identity is fixed and its version advances by one' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.access_group_required_height(group_id uuid, scope_id uuid)
RETURNS smallint LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 SELECT (coalesce((SELECT subtree_height FROM public.access_group g WHERE g.scope_id=$2 AND g.parent_id=$1 AND g.state='active' ORDER BY subtree_height DESC NULLS LAST,id LIMIT 1),0)+1)::smallint
$$;

CREATE OR REPLACE FUNCTION public.guard_access_group_head()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE receipt public.access_group_event%ROWTYPE; ancestor public.access_group%ROWTYPE; parent_key uuid; parent_depth integer:=0;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Group identity and history are retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.state<>'draft' OR NEW.parent_id IS NOT NULL OR NEW.subtree_height<>1 THEN RAISE EXCEPTION 'Group starts as a reserved identity' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.id,NEW.scope_id) IS DISTINCT FROM ROW(OLD.id,OLD.scope_id) THEN RAISE EXCEPTION 'Group identity and scope are immutable' USING ERRCODE='55000'; END IF;
 PERFORM scope_id FROM public.access_group_tree WHERE scope_id=NEW.scope_id FOR NO KEY UPDATE;
 IF ROW(NEW.version,NEW.state,NEW.parent_id) IS NOT DISTINCT FROM ROW(OLD.version,OLD.state,OLD.parent_id) THEN
  IF NEW.subtree_height<>public.access_group_required_height(NEW.id,NEW.scope_id) THEN RAISE EXCEPTION 'Derived Group height must match its active children' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.state='retired' OR NEW.version<>OLD.version+1 OR NEW.subtree_height<>OLD.subtree_height THEN RAISE EXCEPTION 'Group transition is stale, retired or changes derived height' USING ERRCODE='23514'; END IF;
 SELECT * INTO receipt FROM public.access_group_event WHERE group_id=NEW.id AND version=NEW.version;
 IF NOT FOUND OR ROW(NEW.state,NEW.parent_id) IS DISTINCT FROM ROW(receipt.state_after,receipt.parent_after_id) THEN RAISE EXCEPTION 'Group transition requires its exact snapshot' USING ERRCODE='23514'; END IF;
 -- Advance the tree only with the head effect, after its caller's final pre-change admission.
 UPDATE public.access_group_tree SET version=version+1 WHERE scope_id=NEW.scope_id;
 IF NEW.state='retired' THEN
  IF NEW.parent_id IS NOT NULL OR public.access_group_required_height(NEW.id,NEW.scope_id)<>1 THEN RAISE EXCEPTION 'Retirement detaches only a leaf Group' USING ERRCODE='23514'; END IF;
 ELSE
  parent_key:=NEW.parent_id;
  WHILE parent_key IS NOT NULL LOOP
   parent_depth:=parent_depth+1;
   IF parent_depth+NEW.subtree_height>8 OR parent_key=NEW.id THEN RAISE EXCEPTION 'Group move exceeds depth or creates a cycle' USING ERRCODE='23514'; END IF;
   SELECT * INTO ancestor FROM public.access_group WHERE id=parent_key AND scope_id=NEW.scope_id;
   IF NOT FOUND OR ancestor.state<>'active' THEN RAISE EXCEPTION 'Parent Group must be active in the same scope' USING ERRCODE='23514'; END IF;
   parent_key:=ancestor.parent_id;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_group_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.access_group%ROWTYPE; previous public.access_group_event%ROWTYPE; declared_actor uuid; owner_scope uuid;
BEGIN
 SELECT scope_id INTO owner_scope FROM public.access_group WHERE id=NEW.group_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Group identity is missing' USING ERRCODE='23503'; END IF;
 -- Head effects advance this row; a stale stronger-isolation snapshot cannot lock an older tree.
 PERFORM scope_id FROM public.access_group_tree WHERE scope_id=owner_scope FOR NO KEY UPDATE;
 SELECT * INTO head FROM public.access_group WHERE id=NEW.group_id FOR UPDATE;
 SELECT auth_user_id INTO declared_actor FROM public.access_subject WHERE id=NEW.authority_subject_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Authority subject is missing' USING ERRCODE='23503'; END IF;
 IF declared_actor IS NOT NULL AND declared_actor<>NEW.operator_auth_user_id THEN RAISE EXCEPTION 'Direct authority cannot name another private actor' USING ERRCODE='23514'; END IF;
 IF NEW.version<>head.version+1 OR head.state='retired' THEN RAISE EXCEPTION 'Group receipt is stale or retired' USING ERRCODE='23514'; END IF;
 IF NEW.operation='create' THEN
  IF head.version<>0 OR head.state<>'draft' THEN RAISE EXCEPTION 'Group already exists' USING ERRCODE='23514'; END IF;
 ELSE
  IF head.state<>'active' THEN RAISE EXCEPTION 'Group must be active' USING ERRCODE='23514'; END IF;
  SELECT * INTO previous FROM public.access_group_event WHERE group_id=head.id AND version=head.version;
  IF NEW.operation='update' THEN
   IF NEW.parent_after_id IS DISTINCT FROM head.parent_id OR ROW(NEW.label,NEW.description) IS NOT DISTINCT FROM ROW(previous.label,previous.description) THEN RAISE EXCEPTION 'Metadata update preserves topology and changes presentation' USING ERRCODE='23514'; END IF;
  ELSE
   IF ROW(NEW.label,NEW.description) IS DISTINCT FROM ROW(previous.label,previous.description) THEN RAISE EXCEPTION 'Topology transition preserves presentation' USING ERRCODE='23514'; END IF;
   IF NEW.operation='reparent' AND NEW.parent_after_id IS NOT DISTINCT FROM head.parent_id THEN RAISE EXCEPTION 'Reparent requires a changed parent' USING ERRCODE='23514'; END IF;
   IF NEW.operation='retire' AND NEW.parent_after_id IS NOT NULL THEN RAISE EXCEPTION 'Retirement detaches the Group' USING ERRCODE='23514'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.refresh_access_group_ancestor_height()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE parent_key uuid; required_height smallint;
BEGIN
 IF TG_OP='UPDATE' AND OLD.state='active' AND (OLD.parent_id IS DISTINCT FROM NEW.parent_id OR NEW.state<>'active') THEN
  parent_key:=OLD.parent_id;
  IF parent_key IS NOT NULL THEN
   required_height:=public.access_group_required_height(parent_key,NEW.scope_id);
   UPDATE public.access_group SET subtree_height=required_height WHERE id=parent_key AND subtree_height<>required_height;
  END IF;
 END IF;
 IF NEW.state='active' AND NEW.parent_id IS NOT NULL THEN
  required_height:=public.access_group_required_height(NEW.parent_id,NEW.scope_id);
  UPDATE public.access_group SET subtree_height=required_height WHERE id=NEW.parent_id AND subtree_height<>required_height;
 END IF;
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.validate_access_group_history()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE final_version bigint; receipt public.access_group_event%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='access_group' THEN
  SELECT version INTO final_version FROM public.access_group WHERE id=NEW.id;
  IF final_version=0 THEN RAISE EXCEPTION 'A Group identity must complete creation' USING ERRCODE='23514'; END IF;
  IF NEW.version>0 THEN
   SELECT * INTO receipt FROM public.access_group_event WHERE group_id=NEW.id AND version=NEW.version;
   IF NOT FOUND OR ROW(receipt.state_after,receipt.parent_after_id) IS DISTINCT FROM ROW(NEW.state,NEW.parent_id) THEN RAISE EXCEPTION 'Group head requires its exact snapshot' USING ERRCODE='23514'; END IF;
  END IF;
 ELSE
  SELECT version INTO final_version FROM public.access_group WHERE id=NEW.group_id;
  IF final_version<NEW.version THEN RAISE EXCEPTION 'Group receipt must advance its head' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS access_group_tree_guard ON public.access_group_tree;
CREATE TRIGGER access_group_tree_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_group_tree FOR EACH ROW EXECUTE FUNCTION public.guard_access_group_tree();
DROP TRIGGER IF EXISTS access_group_head_guard ON public.access_group;
CREATE TRIGGER access_group_head_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_group FOR EACH ROW EXECUTE FUNCTION public.guard_access_group_head();
DROP TRIGGER IF EXISTS access_group_height_refresh ON public.access_group;
CREATE TRIGGER access_group_height_refresh AFTER INSERT OR UPDATE ON public.access_group FOR EACH ROW EXECUTE FUNCTION public.refresh_access_group_ancestor_height();
DROP TRIGGER IF EXISTS access_group_event_guard ON public.access_group_event;
CREATE TRIGGER access_group_event_guard BEFORE INSERT ON public.access_group_event FOR EACH ROW EXECUTE FUNCTION public.guard_access_group_event();
DROP TRIGGER IF EXISTS access_group_event_immutable ON public.access_group_event;
CREATE TRIGGER access_group_event_immutable BEFORE UPDATE OR DELETE ON public.access_group_event FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
DROP TRIGGER IF EXISTS access_group_head_complete ON public.access_group;
CREATE CONSTRAINT TRIGGER access_group_head_complete AFTER INSERT OR UPDATE ON public.access_group DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_group_history();
DROP TRIGGER IF EXISTS access_group_event_complete ON public.access_group_event;
CREATE CONSTRAINT TRIGGER access_group_event_complete AFTER INSERT ON public.access_group_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_group_history();
