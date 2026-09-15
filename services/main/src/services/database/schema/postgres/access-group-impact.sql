-- Every source writer, including SQL lifecycle/pruning writers, participates in
-- the same retained change witnesses. No per-review or per-recipient fanout.
CREATE OR REPLACE FUNCTION public.touch_access_impact_fences()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE old_value jsonb; new_value jsonb; pair record;
BEGIN
 -- A version-zero unselected slot exists only inside the first assignment's
 -- savepoint. It has no recipient effect and cannot commit without its event.
 IF TG_TABLE_NAME='access_group_membership' AND TG_OP='INSERT' AND (to_jsonb(NEW)->>'version')::bigint=0 AND (to_jsonb(NEW)->>'selected')::boolean IS FALSE THEN RETURN NULL; END IF;
 IF TG_OP<>'INSERT' THEN old_value=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN new_value=to_jsonb(NEW); END IF;
 -- Fixed trigger arguments are (kind, UUID column) pairs. Include both old and
 -- new reverse keys so deletion and reference replacement invalidate absence.
 FOR pair IN
  SELECT DISTINCT TG_ARGV[n] AS kind, value::uuid AS key
  FROM generate_series(0,TG_NARGS-1,2) n
  CROSS JOIN LATERAL (VALUES(old_value->>TG_ARGV[n+1]),(new_value->>TG_ARGV[n+1])) v(value)
  WHERE value IS NOT NULL ORDER BY kind,key
 LOOP
  INSERT INTO public.access_impact_fence(kind,key,version,last_writer_xid) VALUES(pair.kind,pair.key,1,pg_current_xact_id()::text)
  ON CONFLICT(kind,key) DO UPDATE SET version=access_impact_fence.version+1,last_writer_xid=pg_current_xact_id()::text;
 END LOOP;
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_impact_fence()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'Impact witnesses cannot be removed or reset' USING ERRCODE='55000'; END IF;
 IF TG_OP='UPDATE' AND (ROW(NEW.kind,NEW.key) IS DISTINCT FROM ROW(OLD.kind,OLD.key) OR NEW.version<>OLD.version+1) THEN
  RAISE EXCEPTION 'Impact witness identity is fixed and version advances by one' USING ERRCODE='23514';
 END IF;
 IF NEW.version>0 AND NEW.last_writer_xid IS DISTINCT FROM pg_current_xact_id()::text THEN
  RAISE EXCEPTION 'Impact witness must retain its actual top-level writer transaction' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS access_impact_fence_guard ON public.access_impact_fence;
CREATE TRIGGER access_impact_fence_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_impact_fence FOR EACH ROW EXECUTE FUNCTION public.guard_access_impact_fence();
DROP TRIGGER IF EXISTS access_impact_fence_truncate_guard ON public.access_impact_fence;
CREATE TRIGGER access_impact_fence_truncate_guard BEFORE TRUNCATE ON public.access_impact_fence FOR EACH STATEMENT EXECUTE FUNCTION public.guard_access_impact_fence();
DROP TRIGGER IF EXISTS access_group_impact ON public.access_group;
CREATE TRIGGER access_group_impact AFTER INSERT OR UPDATE OR DELETE ON public.access_group FOR EACH ROW EXECUTE FUNCTION public.touch_access_impact_fences('group','id','group','parent_id');
DROP TRIGGER IF EXISTS access_group_impact_truncate ON public.access_group;
CREATE TRIGGER access_group_impact_truncate BEFORE TRUNCATE ON public.access_group FOR EACH STATEMENT EXECUTE FUNCTION public.guard_access_impact_fence();
DROP TRIGGER IF EXISTS access_group_tree_impact ON public.access_group_tree;
CREATE TRIGGER access_group_tree_impact AFTER INSERT OR UPDATE OR DELETE ON public.access_group_tree FOR EACH ROW EXECUTE FUNCTION public.touch_access_impact_fences('tree','scope_id');
DROP TRIGGER IF EXISTS access_group_tree_impact_truncate ON public.access_group_tree;
CREATE TRIGGER access_group_tree_impact_truncate BEFORE TRUNCATE ON public.access_group_tree FOR EACH STATEMENT EXECUTE FUNCTION public.guard_access_impact_fence();
DROP TRIGGER IF EXISTS access_group_membership_impact ON public.access_group_membership;
CREATE TRIGGER access_group_membership_impact AFTER INSERT OR UPDATE OR DELETE ON public.access_group_membership FOR EACH ROW EXECUTE FUNCTION public.touch_access_impact_fences('group','group_id','membership','membership_id');
DROP TRIGGER IF EXISTS access_group_membership_impact_truncate ON public.access_group_membership;
CREATE TRIGGER access_group_membership_impact_truncate BEFORE TRUNCATE ON public.access_group_membership FOR EACH STATEMENT EXECUTE FUNCTION public.guard_access_impact_fence();
DROP TRIGGER IF EXISTS access_group_membership_set_impact ON public.access_group_membership_set;
CREATE TRIGGER access_group_membership_set_impact AFTER INSERT OR UPDATE OR DELETE ON public.access_group_membership_set FOR EACH ROW EXECUTE FUNCTION public.touch_access_impact_fences('membership','membership_id');
DROP TRIGGER IF EXISTS access_group_membership_set_impact_truncate ON public.access_group_membership_set;
CREATE TRIGGER access_group_membership_set_impact_truncate BEFORE TRUNCATE ON public.access_group_membership_set FOR EACH STATEMENT EXECUTE FUNCTION public.guard_access_impact_fence();
DROP TRIGGER IF EXISTS access_membership_impact ON public.access_membership;
CREATE TRIGGER access_membership_impact AFTER INSERT OR UPDATE OR DELETE ON public.access_membership FOR EACH ROW EXECUTE FUNCTION public.touch_access_impact_fences('membership','id','tree','scope_id');
DROP TRIGGER IF EXISTS access_membership_impact_truncate ON public.access_membership;
CREATE TRIGGER access_membership_impact_truncate BEFORE TRUNCATE ON public.access_membership FOR EACH STATEMENT EXECUTE FUNCTION public.guard_access_impact_fence();
DROP TRIGGER IF EXISTS access_membership_admission_impact ON public.access_membership_admission;
CREATE TRIGGER access_membership_admission_impact AFTER INSERT OR UPDATE OR DELETE ON public.access_membership_admission FOR EACH ROW EXECUTE FUNCTION public.touch_access_impact_fences('membership','membership_id');
DROP TRIGGER IF EXISTS access_membership_admission_impact_truncate ON public.access_membership_admission;
CREATE TRIGGER access_membership_admission_impact_truncate BEFORE TRUNCATE ON public.access_membership_admission FOR EACH STATEMENT EXECUTE FUNCTION public.guard_access_impact_fence();
DROP TRIGGER IF EXISTS access_role_binding_impact ON public.access_role_binding;
CREATE TRIGGER access_role_binding_impact AFTER INSERT OR UPDATE OR DELETE ON public.access_role_binding FOR EACH ROW EXECUTE FUNCTION public.touch_access_impact_fences('binding','id','group','recipient_group_id');
DROP TRIGGER IF EXISTS access_role_binding_impact_truncate ON public.access_role_binding;
CREATE TRIGGER access_role_binding_impact_truncate BEFORE TRUNCATE ON public.access_role_binding FOR EACH STATEMENT EXECUTE FUNCTION public.guard_access_impact_fence();
DROP TRIGGER IF EXISTS access_role_binding_revision_impact ON public.access_role_binding_revision;
CREATE TRIGGER access_role_binding_revision_impact AFTER INSERT OR UPDATE OR DELETE ON public.access_role_binding_revision FOR EACH ROW EXECUTE FUNCTION public.touch_access_impact_fences('binding','binding_id','group','selection_group_id','membership','membership_id');
DROP TRIGGER IF EXISTS access_role_binding_revision_impact_truncate ON public.access_role_binding_revision;
CREATE TRIGGER access_role_binding_revision_impact_truncate BEFORE TRUNCATE ON public.access_role_binding_revision FOR EACH STATEMENT EXECUTE FUNCTION public.guard_access_impact_fence();
DROP TRIGGER IF EXISTS access_role_binding_permission_impact ON public.access_role_binding_permission;
CREATE TRIGGER access_role_binding_permission_impact AFTER INSERT OR UPDATE OR DELETE ON public.access_role_binding_permission FOR EACH ROW EXECUTE FUNCTION public.touch_access_impact_fences('binding','binding_id');
DROP TRIGGER IF EXISTS access_role_binding_permission_impact_truncate ON public.access_role_binding_permission;
CREATE TRIGGER access_role_binding_permission_impact_truncate BEFORE TRUNCATE ON public.access_role_binding_permission FOR EACH STATEMENT EXECUTE FUNCTION public.guard_access_impact_fence();
DROP TRIGGER IF EXISTS access_role_impact ON public.access_role;
CREATE TRIGGER access_role_impact AFTER INSERT OR UPDATE OR DELETE ON public.access_role FOR EACH ROW EXECUTE FUNCTION public.touch_access_impact_fences('role','id');
DROP TRIGGER IF EXISTS access_role_impact_truncate ON public.access_role;
CREATE TRIGGER access_role_impact_truncate BEFORE TRUNCATE ON public.access_role FOR EACH STATEMENT EXECUTE FUNCTION public.guard_access_impact_fence();
DROP TRIGGER IF EXISTS access_role_revision_impact ON public.access_role_revision;
CREATE TRIGGER access_role_revision_impact AFTER INSERT OR UPDATE OR DELETE ON public.access_role_revision FOR EACH ROW EXECUTE FUNCTION public.touch_access_impact_fences('role','role_id');
DROP TRIGGER IF EXISTS access_role_revision_impact_truncate ON public.access_role_revision;
CREATE TRIGGER access_role_revision_impact_truncate BEFORE TRUNCATE ON public.access_role_revision FOR EACH STATEMENT EXECUTE FUNCTION public.guard_access_impact_fence();
DROP TRIGGER IF EXISTS access_role_permission_impact ON public.access_role_permission;
CREATE TRIGGER access_role_permission_impact AFTER INSERT OR UPDATE OR DELETE ON public.access_role_permission FOR EACH ROW EXECUTE FUNCTION public.touch_access_impact_fences('role','role_id');
DROP TRIGGER IF EXISTS access_role_permission_impact_truncate ON public.access_role_permission;
CREATE TRIGGER access_role_permission_impact_truncate BEFORE TRUNCATE ON public.access_role_permission FOR EACH STATEMENT EXECUTE FUNCTION public.guard_access_impact_fence();
DROP TRIGGER IF EXISTS access_assignment_ceiling_impact ON public.access_assignment_ceiling;
CREATE TRIGGER access_assignment_ceiling_impact AFTER INSERT OR UPDATE OR DELETE ON public.access_assignment_ceiling FOR EACH ROW EXECUTE FUNCTION public.touch_access_impact_fences('ceiling','id','group','recipient_group_id','binding','manager_binding_id');
DROP TRIGGER IF EXISTS access_assignment_ceiling_impact_truncate ON public.access_assignment_ceiling;
CREATE TRIGGER access_assignment_ceiling_impact_truncate BEFORE TRUNCATE ON public.access_assignment_ceiling FOR EACH STATEMENT EXECUTE FUNCTION public.guard_access_impact_fence();
DROP TRIGGER IF EXISTS access_assignment_ceiling_permission_impact ON public.access_assignment_ceiling_permission;
CREATE TRIGGER access_assignment_ceiling_permission_impact AFTER INSERT OR UPDATE OR DELETE ON public.access_assignment_ceiling_permission FOR EACH ROW EXECUTE FUNCTION public.touch_access_impact_fences('ceiling','ceiling_id');
DROP TRIGGER IF EXISTS access_assignment_ceiling_permission_impact_truncate ON public.access_assignment_ceiling_permission;
CREATE TRIGGER access_assignment_ceiling_permission_impact_truncate BEFORE TRUNCATE ON public.access_assignment_ceiling_permission FOR EACH STATEMENT EXECUTE FUNCTION public.guard_access_impact_fence();
DROP TRIGGER IF EXISTS access_representation_impact ON public.access_representation;
CREATE TRIGGER access_representation_impact AFTER INSERT OR UPDATE OR DELETE ON public.access_representation FOR EACH ROW EXECUTE FUNCTION public.touch_access_impact_fences('representation','id','representation','parent_grant_id','group','recipient_group_id','group','parent_selection_group_id','membership','parent_membership_id');
DROP TRIGGER IF EXISTS access_representation_impact_truncate ON public.access_representation;
CREATE TRIGGER access_representation_impact_truncate BEFORE TRUNCATE ON public.access_representation FOR EACH STATEMENT EXECUTE FUNCTION public.guard_access_impact_fence();
DROP TRIGGER IF EXISTS access_representation_revision_impact ON public.access_representation_revision;
CREATE TRIGGER access_representation_revision_impact AFTER INSERT OR UPDATE OR DELETE ON public.access_representation_revision FOR EACH ROW EXECUTE FUNCTION public.touch_access_impact_fences('representation','grant_id','group','selection_group_id','membership','membership_id');
DROP TRIGGER IF EXISTS access_representation_revision_impact_truncate ON public.access_representation_revision;
CREATE TRIGGER access_representation_revision_impact_truncate BEFORE TRUNCATE ON public.access_representation_revision FOR EACH STATEMENT EXECUTE FUNCTION public.guard_access_impact_fence();
DROP TRIGGER IF EXISTS access_representation_permission_impact ON public.access_representation_permission;
CREATE TRIGGER access_representation_permission_impact AFTER INSERT OR UPDATE OR DELETE ON public.access_representation_permission FOR EACH ROW EXECUTE FUNCTION public.touch_access_impact_fences('representation','grant_id');
DROP TRIGGER IF EXISTS access_representation_permission_impact_truncate ON public.access_representation_permission;
CREATE TRIGGER access_representation_permission_impact_truncate BEFORE TRUNCATE ON public.access_representation_permission FOR EACH STATEMENT EXECUTE FUNCTION public.guard_access_impact_fence();

-- Negative manager candidate reads must detect new bindings, not only retained positives.
DROP TRIGGER IF EXISTS access_binding_scope_impact ON public.access_role_binding_scope;
CREATE TRIGGER access_binding_scope_impact AFTER INSERT OR UPDATE OR DELETE ON public.access_role_binding_scope
FOR EACH ROW EXECUTE FUNCTION public.touch_access_impact_fences('binding-scope','scope_id');
DROP TRIGGER IF EXISTS access_binding_scope_impact_truncate ON public.access_role_binding_scope;
CREATE TRIGGER access_binding_scope_impact_truncate BEFORE TRUNCATE ON public.access_role_binding_scope
FOR EACH STATEMENT EXECUTE FUNCTION public.guard_access_impact_fence();
