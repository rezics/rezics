SET search_path TO public;

CREATE TABLE "access_group_impact_effect" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"review_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"decision" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"ceiling_id" uuid,
	CONSTRAINT "access_group_impact_effect_ceiling_check" CHECK (("decision"='covered')=("ceiling_id" is not null)),
	CONSTRAINT "access_group_impact_effect_ordinal_check" CHECK ("ordinal" between 1 and 4096),
	CONSTRAINT "access_group_impact_effect_decision_check" CHECK ("decision" in ('pending','not-required','covered','denied','unavailable'))
);

CREATE TABLE "access_group_impact_evaluation" (
	"review_id" uuid PRIMARY KEY,
	"status" text NOT NULL,
	"reason" text,
	"page_version" integer DEFAULT 0 NOT NULL,
	"cursor" integer DEFAULT 0 NOT NULL,
	"effect_count" integer DEFAULT 0 NOT NULL,
	"byte_count" integer DEFAULT 0 NOT NULL,
	"manager_digest" text NOT NULL,
	"effect_digest" text NOT NULL,
	CONSTRAINT "access_group_evaluation_status_check" CHECK ("status" in ('evaluating','complete','denied','unavailable','invalidated')),
	CONSTRAINT "access_group_evaluation_digest_check" CHECK ("manager_digest" ~ '^[0-9a-f]{64}$' and "effect_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "access_group_evaluation_completion_check" CHECK ("status"<>'complete' or ("cursor"="effect_count" and "reason" is null and "byte_count">0)),
	CONSTRAINT "access_group_evaluation_budget_check" CHECK ("cursor" between 0 and "effect_count" and "effect_count" between 0 and 4096 and "byte_count" between 0 and 16777216 and "page_version" between 0 and 4096)
);

CREATE UNIQUE INDEX "access_group_impact_effect_page_key" ON "access_group_impact_effect" ("review_id","ordinal");
CREATE INDEX "unit_access_restriction_impact_idx" ON "unit_access_restriction" ("unit_id","id") WHERE "revoked_at" is null;
ALTER TABLE "access_group_impact_effect" ADD CONSTRAINT "access_group_impact_effect_SK7Lxf0xFEWE_fkey" FOREIGN KEY ("review_id") REFERENCES "access_group_impact_evaluation"("review_id") ON DELETE CASCADE;
ALTER TABLE "access_group_impact_effect" ADD CONSTRAINT "access_group_impact_effect_8y0c0GRkigsO_fkey" FOREIGN KEY ("ceiling_id") REFERENCES "access_assignment_ceiling"("id") ON DELETE RESTRICT;
ALTER TABLE "access_group_impact_evaluation" ADD CONSTRAINT "access_group_impact_evaluation_DXShR9LTr2K4_fkey" FOREIGN KEY ("review_id") REFERENCES "access_group_impact_review"("id") ON DELETE CASCADE;
ALTER TABLE "access_group_impact_node" DROP CONSTRAINT "access_group_impact_node_kind_check", ADD CONSTRAINT "access_group_impact_node_kind_check" CHECK ("kind" in ('roster','scope-roster','subtree','group','group-context','binding','binding-context','role','ceiling','representation','representation-context','membership'));
ALTER TABLE "access_impact_fence" DROP CONSTRAINT "access_impact_fence_kind_check", ADD CONSTRAINT "access_impact_fence_kind_check" CHECK ("kind" in ('group','tree','binding-scope','membership','binding','role','ceiling','representation'));

-- Every source writer, including SQL lifecycle/pruning writers, participates in
-- the same retained change witnesses. No per-review or per-recipient fanout.
CREATE OR REPLACE FUNCTION public.touch_access_impact_fences()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE old_value jsonb; new_value jsonb; pair record;
BEGIN
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
