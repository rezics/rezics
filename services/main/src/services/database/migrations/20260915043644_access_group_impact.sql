SET search_path TO public;

CREATE TABLE "access_group_impact_fact" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"review_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL
);

CREATE TABLE "access_group_impact_node" (
	"review_id" uuid,
	"kind" text,
	"key" uuid,
	"stage" integer DEFAULT 0 NOT NULL,
	"cursor" jsonb,
	"payload" jsonb,
	CONSTRAINT "access_group_impact_node_pkey" PRIMARY KEY("review_id","kind","key"),
	CONSTRAINT "access_group_impact_node_kind_check" CHECK ("kind" in ('subtree','group','group-context','binding','binding-context','role','ceiling','representation','representation-context','membership')),
	CONSTRAINT "access_group_impact_node_stage_check" CHECK ("stage" between -1 and 16)
);

CREATE TABLE "access_group_impact_review" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"scope_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"operator_auth_user_id" uuid NOT NULL,
	"authority_subject_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"proposed_parent_id" uuid,
	"expected_group_version" bigint NOT NULL,
	"expected_tree_version" bigint NOT NULL,
	"status" text DEFAULT 'discovering' NOT NULL,
	"reason" text,
	"base_snapshot" text NOT NULL,
	"witness_count" integer DEFAULT 0 NOT NULL,
	"page_version" integer DEFAULT 0 NOT NULL,
	"node_count" integer DEFAULT 0 NOT NULL,
	"fact_count" integer DEFAULT 0 NOT NULL,
	"work_count" integer DEFAULT 0 NOT NULL,
	"byte_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp(3) with time zone NOT NULL,
	"valid_until" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "access_group_impact_proposal_check" CHECK ("operation" in ('reparent','retire') and ("operation"<>'retire' or "proposed_parent_id" is null) and "expected_group_version" between 1 and 9007199254740991 and "expected_tree_version" between 0 and 9007199254740991),
	CONSTRAINT "access_group_impact_status_check" CHECK (("status" in ('discovering','complete') and "reason" is null) or ("status"='invalidated' and "reason" is not null and "reason" in ('changed','expired')) or ("status"='unavailable' and "reason" is not null and "reason" in ('budget','missing'))),
	CONSTRAINT "access_group_impact_budget_check" CHECK ("witness_count" between 0 and 8193 and "node_count" between 0 and 4096 and "fact_count" between 0 and 32768 and "work_count" between 0 and 65536 and "byte_count" between 0 and 16777216 and "page_version" between 0 and 65536),
	CONSTRAINT "access_group_impact_snapshot_check" CHECK (octet_length("base_snapshot") between 1 and 65536 and pg_snapshot_xmax("base_snapshot"::pg_snapshot)>=pg_snapshot_xmin("base_snapshot"::pg_snapshot)),
	CONSTRAINT "access_group_impact_time_check" CHECK (isfinite("expires_at") and isfinite("valid_until") and "valid_until"<="expires_at")
);

CREATE TABLE "access_group_impact_witness" (
	"review_id" uuid,
	"kind" text,
	"key" uuid,
	"version" bigint NOT NULL,
	CONSTRAINT "access_group_impact_witness_pkey" PRIMARY KEY("review_id","kind","key")
);

CREATE TABLE "access_impact_fence" (
	"kind" text,
	"key" uuid,
	"version" bigint DEFAULT 0 NOT NULL,
	"last_writer_xid" text,
	CONSTRAINT "access_impact_fence_pkey" PRIMARY KEY("kind","key"),
	CONSTRAINT "access_impact_fence_kind_check" CHECK ("kind" in ('group','tree','membership','binding','role','ceiling','representation')),
	CONSTRAINT "access_impact_fence_writer_check" CHECK (("version"=0 and "last_writer_xid" is null) or ("version">0 and "last_writer_xid" is not null and "last_writer_xid"::xid8>'0'::xid8)),
	CONSTRAINT "access_impact_fence_version_check" CHECK ("version" between 0 and 9007199254740991)
);

CREATE INDEX "access_assignment_ceiling_binding_page_idx" ON "access_assignment_ceiling" ("manager_binding_id","id");
CREATE INDEX "access_group_children_page_idx" ON "access_group" ("scope_id","parent_id","id") WHERE "state"='active';
CREATE UNIQUE INDEX "access_group_impact_fact_page_key" ON "access_group_impact_fact" ("review_id","ordinal");
CREATE INDEX "access_group_impact_pending_idx" ON "access_group_impact_node" ("review_id","kind","key") WHERE "stage">=0;
CREATE INDEX "access_group_impact_expiry_idx" ON "access_group_impact_review" ("expires_at","id");
CREATE INDEX "access_group_impact_reviewer_idx" ON "access_group_impact_review" ("operator_auth_user_id","expires_at","id");
CREATE INDEX "access_representation_group_page_idx" ON "access_representation" ("recipient_group_id","id") WHERE "recipient_group_id" is not null;
CREATE INDEX "access_representation_child_page_idx" ON "access_representation" ("parent_grant_id","id") WHERE "parent_grant_id" is not null;
CREATE INDEX "access_representation_parent_selection_page_idx" ON "access_representation" ("parent_selection_group_id","id") WHERE "parent_selection_group_id" is not null;
CREATE INDEX "access_representation_selection_page_idx" ON "access_representation_revision" ("selection_group_id","grant_id","revision") WHERE "selection_group_id" is not null;
CREATE INDEX "access_role_binding_group_page_idx" ON "access_role_binding" ("recipient_group_id","id") WHERE "recipient_group_id" is not null;
CREATE INDEX "access_role_binding_selection_page_idx" ON "access_role_binding_revision" ("selection_group_id","binding_id","revision") WHERE "selection_group_id" is not null;
ALTER TABLE "access_group_impact_fact" ADD CONSTRAINT "access_group_impact_fact_pRzGYPSGoCCm_fkey" FOREIGN KEY ("review_id") REFERENCES "access_group_impact_review"("id") ON DELETE CASCADE;
ALTER TABLE "access_group_impact_node" ADD CONSTRAINT "access_group_impact_node_sKIJaA5U0lZI_fkey" FOREIGN KEY ("review_id") REFERENCES "access_group_impact_review"("id") ON DELETE CASCADE;
ALTER TABLE "access_group_impact_review" ADD CONSTRAINT "access_group_impact_review_operator_auth_user_id_users_id_fkey" FOREIGN KEY ("operator_auth_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "access_group_impact_review" ADD CONSTRAINT "access_group_impact_review_oc4BdiL5Qap3_fkey" FOREIGN KEY ("authority_subject_id") REFERENCES "access_subject"("id") ON DELETE RESTRICT;
ALTER TABLE "access_group_impact_review" ADD CONSTRAINT "access_group_impact_review_x0SarYBNFtd9_fkey" FOREIGN KEY ("proposed_parent_id") REFERENCES "access_group"("id") ON DELETE RESTRICT;
ALTER TABLE "access_group_impact_review" ADD CONSTRAINT "access_group_impact_review_Ijf1y3zTnw2x_fkey" FOREIGN KEY ("group_id","scope_id") REFERENCES "access_group"("id","scope_id") ON DELETE RESTRICT;
ALTER TABLE "access_group_impact_witness" ADD CONSTRAINT "access_group_impact_witness_tcrUYknY38kJ_fkey" FOREIGN KEY ("review_id") REFERENCES "access_group_impact_review"("id") ON DELETE CASCADE;
ALTER TABLE "access_group_impact_witness" ADD CONSTRAINT "access_group_impact_witness_8hTQ0ZUUIKml_fkey" FOREIGN KEY ("kind","key") REFERENCES "access_impact_fence"("kind","key") ON DELETE RESTRICT;

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
CREATE TRIGGER access_membership_impact AFTER INSERT OR UPDATE OR DELETE ON public.access_membership FOR EACH ROW EXECUTE FUNCTION public.touch_access_impact_fences('membership','id');
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
