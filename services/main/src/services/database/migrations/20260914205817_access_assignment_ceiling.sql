SET search_path TO public;

CREATE TABLE "access_assignment_ceiling" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"scope_id" uuid NOT NULL,
	"manager_binding_id" uuid NOT NULL,
	"manager_terms_revision" bigint NOT NULL,
	"role_id" uuid NOT NULL,
	"target_path" text[] NOT NULL,
	"recipient_kind" text NOT NULL,
	"recipient_subject_id" uuid,
	"recipient_group_id" uuid,
	"recipient_scope_id" uuid,
	"member_subject_kind" text,
	"valid_from" timestamp(3) with time zone NOT NULL,
	"valid_until" timestamp(3) with time zone,
	"maximum_grant_duration_seconds" integer,
	"grant_not_after" timestamp(3) with time zone,
	"permission_count" integer NOT NULL,
	"permission_digest" text NOT NULL,
	"sealed" boolean DEFAULT false NOT NULL,
	"version" bigint DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "access_assignment_ceiling_version_check" CHECK ("version" between 0 and 2 and "manager_terms_revision" between 1 and 9007199254740991),
	CONSTRAINT "access_assignment_ceiling_state_check" CHECK (("version"=0 and "state"='draft' and not "sealed") or ("version"=1 and "state"='active' and "sealed") or ("version"=2 and "state"='revoked' and "sealed")),
	CONSTRAINT "access_assignment_ceiling_recipient_check" CHECK (
		("recipient_kind"='subject' and "recipient_subject_id" is not null and "recipient_group_id" is null and "recipient_scope_id" is null and "member_subject_kind" is null)
		or ("recipient_kind"='group' and "recipient_subject_id" is null and "recipient_group_id" is not null and "recipient_scope_id" is not null and "member_subject_kind" is null)
		or ("recipient_kind"='all-members' and "recipient_subject_id" is null and "recipient_group_id" is null and "recipient_scope_id" is not null and "member_subject_kind" is null)
		or ("recipient_kind"='scope-members' and "recipient_subject_id" is null and "recipient_group_id" is null and "recipient_scope_id" is not null and "member_subject_kind" is not null and "member_subject_kind" in ('principal','entity'))),
	CONSTRAINT "access_assignment_ceiling_path_check" CHECK (cardinality("target_path") between 0 and 8 and coalesce(array_ndims("target_path"),1)=1 and array_position("target_path",null) is null),
	CONSTRAINT "access_assignment_ceiling_validity_check" CHECK (isfinite("valid_from") and ("valid_until" is null or (isfinite("valid_until") and "valid_until">"valid_from"))),
	CONSTRAINT "access_assignment_ceiling_grant_lifetime_check" CHECK (("maximum_grant_duration_seconds" is null or "maximum_grant_duration_seconds">0) and ("grant_not_after" is null or isfinite("grant_not_after"))),
	CONSTRAINT "access_assignment_ceiling_count_check" CHECK ("permission_count" between 0 and 82),
	CONSTRAINT "access_assignment_ceiling_digest_check" CHECK ("permission_digest" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "access_assignment_ceiling_event" (
	"ceiling_id" uuid,
	"version" bigint,
	"operation_id" uuid NOT NULL,
	"request_digest" text NOT NULL,
	"operation" text NOT NULL,
	"operator_auth_user_id" uuid NOT NULL,
	"authority_subject_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_assignment_ceiling_event_pkey" PRIMARY KEY("ceiling_id","version"),
	CONSTRAINT "access_assignment_ceiling_event_version_check" CHECK (("operation"='create' and "version"=1) or ("operation"='revoke' and "version"=2)),
	CONSTRAINT "access_assignment_ceiling_event_digest_check" CHECK ("request_digest" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "access_assignment_ceiling_permission" (
	"ceiling_id" uuid,
	"family" text,
	"permission" text,
	CONSTRAINT "access_assignment_ceiling_permission_pkey" PRIMARY KEY("ceiling_id","family","permission"),
	CONSTRAINT "access_assignment_ceiling_permission_check" CHECK ((((("family" = 'unit') and ("permission" in ('unit.read', 'unit.update', 'unit.metadata-only.update', 'unit.status.update', 'unit.history.restore', 'unit.access.manage', 'unit.ownership.transfer', 'unit.association.manage', 'unit.tag-curation.manage', 'unit.reference-curation.manage', 'unit.realm-publication.manage', 'zone.pages.manage', 'zone.theme.manage', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate', 'entity.association.credit.request', 'entity.association.credit.direct', 'entity.association.subject.request', 'entity.association.subject.direct')))) or ((("family" = 'platform') and ("permission" in ('platform.access.read', 'platform.access.manage', 'platform.audit.read', 'platform.user.read', 'platform.user.status.update', 'platform.session.read', 'platform.session.revoke', 'entity.associations.override', 'catalog.definition.manage', 'unit.edit', 'platform.development_preview.access', 'platform.custom_theme.external_live.access', 'platform.custom_theme.external_live.access.manage', 'platform.custom_theme.review', 'platform.custom_theme.kill', 'unit.governance.read', 'unit.merge.propose', 'unit.merge.review', 'unit.merge', 'unit.ownership.override', 'unit.license.manage', 'unit.delete', 'unit.restore', 'unit.slug.manage', 'unit.slug.namespace.manage', 'unit.slug.redirect.release', 'platform.api_quota_policy.read', 'platform.api_quota_policy.update', 'platform.user.api_quota.read', 'platform.user.api_quota.update', 'platform.user.api_token.api_quota.read', 'platform.user.api_token.api_quota.update', 'platform.moderate', 'platform.suppress', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate')))) or ((("family" = 'management') and ("permission" in ('access.role.read', 'access.role.create', 'access.role.update', 'access.role.activate', 'access.role.retire', 'access.role-binding.manage', 'access.assignment-ceiling.manage'))))))
);

CREATE INDEX "access_assignment_ceiling_manager_idx" ON "access_assignment_ceiling" ("scope_id","manager_binding_id","role_id","id");
CREATE INDEX "access_assignment_ceiling_role_idx" ON "access_assignment_ceiling" ("role_id","scope_id","id");
CREATE INDEX "access_assignment_ceiling_subject_idx" ON "access_assignment_ceiling" ("recipient_subject_id","id") WHERE "recipient_subject_id" is not null;
CREATE INDEX "access_assignment_ceiling_recipient_scope_idx" ON "access_assignment_ceiling" ("recipient_scope_id","id") WHERE "recipient_scope_id" is not null;
CREATE UNIQUE INDEX "access_assignment_ceiling_event_operation_key" ON "access_assignment_ceiling_event" ("ceiling_id","operation_id");
ALTER TABLE "access_assignment_ceiling" ADD CONSTRAINT "access_assignment_ceiling_UE1hcFIFUNPr_fkey" FOREIGN KEY ("scope_id") REFERENCES "access_role_binding_scope"("scope_id") ON DELETE RESTRICT;
ALTER TABLE "access_assignment_ceiling" ADD CONSTRAINT "access_assignment_ceiling_ezwNQcWWZlIK_fkey" FOREIGN KEY ("manager_binding_id") REFERENCES "access_role_binding"("id") ON DELETE RESTRICT;
ALTER TABLE "access_assignment_ceiling" ADD CONSTRAINT "access_assignment_ceiling_role_id_access_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "access_role"("id") ON DELETE RESTRICT;
ALTER TABLE "access_assignment_ceiling" ADD CONSTRAINT "access_assignment_ceiling_kh2vth2En9bh_fkey" FOREIGN KEY ("recipient_subject_id") REFERENCES "access_subject"("id") ON DELETE RESTRICT;
ALTER TABLE "access_assignment_ceiling" ADD CONSTRAINT "access_assignment_ceiling_8GAtcxJdhsyv_fkey" FOREIGN KEY ("recipient_scope_id") REFERENCES "access_scope"("id") ON DELETE RESTRICT;
ALTER TABLE "access_assignment_ceiling" ADD CONSTRAINT "access_assignment_ceiling_manager_terms_fk" FOREIGN KEY ("manager_binding_id","manager_terms_revision") REFERENCES "access_role_binding_revision"("binding_id","revision") ON DELETE RESTRICT;
ALTER TABLE "access_assignment_ceiling" ADD CONSTRAINT "access_assignment_ceiling_group_fk" FOREIGN KEY ("recipient_group_id","recipient_scope_id") REFERENCES "access_group"("id","scope_id") ON DELETE RESTRICT;
ALTER TABLE "access_assignment_ceiling_event" ADD CONSTRAINT "access_assignment_ceiling_event_4IRRfMNhAwUo_fkey" FOREIGN KEY ("ceiling_id") REFERENCES "access_assignment_ceiling"("id") ON DELETE RESTRICT;
ALTER TABLE "access_assignment_ceiling_event" ADD CONSTRAINT "access_assignment_ceiling_event_Lsr4s3XLzl3I_fkey" FOREIGN KEY ("operator_auth_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "access_assignment_ceiling_event" ADD CONSTRAINT "access_assignment_ceiling_event_laoiTQH4tOzE_fkey" FOREIGN KEY ("authority_subject_id") REFERENCES "access_subject"("id") ON DELETE RESTRICT;
ALTER TABLE "access_assignment_ceiling_permission" ADD CONSTRAINT "access_assignment_ceiling_permission_CUHTbDcwksN5_fkey" FOREIGN KEY ("ceiling_id") REFERENCES "access_assignment_ceiling"("id") ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.guard_access_assignment_ceiling()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE event_kind text; actual_count integer; actual_digest text;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Assignment approvals and revocation history are retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.state<>'draft' OR NEW.sealed THEN RAISE EXCEPTION 'Assignment approval starts unsealed' USING ERRCODE='23514'; END IF;
  IF cardinality(NEW.target_path)>0 AND array_lower(NEW.target_path,1)<>1 THEN RAISE EXCEPTION 'Assignment paths use canonical array bounds' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(NEW.target_path) segment WHERE segment !~ '^[a-z0-9][a-z0-9-]{0,255}$') THEN RAISE EXCEPTION 'Invalid assignment target path' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.access_role_binding WHERE id=NEW.manager_binding_id AND target_scope_id=NEW.scope_id) THEN RAISE EXCEPTION 'Manager binding must belong to the approving authority scope' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF (to_jsonb(NEW)-'version'-'state'-'sealed') IS DISTINCT FROM (to_jsonb(OLD)-'version'-'state'-'sealed') OR NEW.version<>OLD.version+1 OR OLD.state='revoked' THEN RAISE EXCEPTION 'Assignment approval terms are immutable and revocation is terminal' USING ERRCODE='55000'; END IF;
 SELECT operation INTO event_kind FROM public.access_assignment_ceiling_event WHERE ceiling_id=NEW.id AND version=NEW.version;
 IF event_kind IS NULL OR (event_kind='create')<>(NEW.state='active') OR NOT NEW.sealed THEN RAISE EXCEPTION 'Assignment approval transition requires its exact receipt' USING ERRCODE='23514'; END IF;
 IF event_kind='create' THEN
  SELECT count(*)::integer,encode(sha256(convert_to(coalesce(string_agg(family||':'||permission,E'\n' ORDER BY family COLLATE "C",permission COLLATE "C"),''),'UTF8')),'hex') INTO actual_count,actual_digest FROM public.access_assignment_ceiling_permission WHERE ceiling_id=NEW.id;
  IF actual_count<>NEW.permission_count OR actual_digest<>NEW.permission_digest THEN RAISE EXCEPTION 'Assignment permission approval is incomplete' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.access_role_binding WHERE id=NEW.manager_binding_id AND target_scope_id=NEW.scope_id AND state='active' AND terms_revision=NEW.manager_terms_revision) THEN RAISE EXCEPTION 'Assignment approval requires its current manager binding terms' USING ERRCODE='23514'; END IF;
 END IF;
 UPDATE public.access_role_binding_scope SET version=version+1 WHERE scope_id=NEW.scope_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Assignment scope fence is missing' USING ERRCODE='23503'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_assignment_ceiling_permission()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE sealed boolean;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Assignment permission approvals are immutable' USING ERRCODE='55000'; END IF;
 SELECT c.sealed INTO sealed FROM public.access_assignment_ceiling c WHERE id=NEW.ceiling_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Assignment approval is missing' USING ERRCODE='23503'; END IF;
 IF sealed THEN RAISE EXCEPTION 'Sealed assignment approvals cannot gain permissions' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_assignment_ceiling_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.access_assignment_ceiling%ROWTYPE; actor_id uuid;
BEGIN
 SELECT * INTO head FROM public.access_assignment_ceiling WHERE id=NEW.ceiling_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Assignment approval is missing' USING ERRCODE='23503'; END IF;
 PERFORM scope_id FROM public.access_role_binding_scope WHERE scope_id=head.scope_id FOR NO KEY UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Assignment scope fence is missing' USING ERRCODE='23503'; END IF;
 SELECT * INTO head FROM public.access_assignment_ceiling WHERE id=NEW.ceiling_id FOR UPDATE;
 SELECT auth_user_id INTO actor_id FROM public.access_subject WHERE id=NEW.authority_subject_id;
 IF NOT FOUND OR (actor_id IS NOT NULL AND actor_id<>NEW.operator_auth_user_id) THEN RAISE EXCEPTION 'Assignment approval actor does not match its selected subject' USING ERRCODE='23514'; END IF;
 IF NEW.version<>head.version+1 OR (NEW.operation='create')<>(head.state='draft') OR head.state='revoked' THEN RAISE EXCEPTION 'Assignment approval receipt is stale' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.complete_access_assignment_ceiling()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE version bigint;
BEGIN
 IF TG_TABLE_NAME='access_assignment_ceiling' THEN
  SELECT c.version INTO version FROM public.access_assignment_ceiling c WHERE id=NEW.id;
 ELSE
  SELECT c.version INTO version FROM public.access_assignment_ceiling c WHERE id=NEW.ceiling_id;
 END IF;
 IF version IS NULL OR version=0 OR version<NEW.version THEN RAISE EXCEPTION 'Assignment approval must complete its sealed transition' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS access_assignment_ceiling_guard ON public.access_assignment_ceiling;
CREATE TRIGGER access_assignment_ceiling_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_assignment_ceiling FOR EACH ROW EXECUTE FUNCTION public.guard_access_assignment_ceiling();
DROP TRIGGER IF EXISTS access_assignment_ceiling_permission_guard ON public.access_assignment_ceiling_permission;
CREATE TRIGGER access_assignment_ceiling_permission_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_assignment_ceiling_permission FOR EACH ROW EXECUTE FUNCTION public.guard_access_assignment_ceiling_permission();
DROP TRIGGER IF EXISTS access_assignment_ceiling_event_guard ON public.access_assignment_ceiling_event;
CREATE TRIGGER access_assignment_ceiling_event_guard BEFORE INSERT ON public.access_assignment_ceiling_event FOR EACH ROW EXECUTE FUNCTION public.guard_access_assignment_ceiling_event();
DROP TRIGGER IF EXISTS access_assignment_ceiling_event_immutable ON public.access_assignment_ceiling_event;
CREATE TRIGGER access_assignment_ceiling_event_immutable BEFORE UPDATE OR DELETE ON public.access_assignment_ceiling_event FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
DROP TRIGGER IF EXISTS access_assignment_ceiling_complete ON public.access_assignment_ceiling;
CREATE CONSTRAINT TRIGGER access_assignment_ceiling_complete AFTER INSERT OR UPDATE ON public.access_assignment_ceiling DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_access_assignment_ceiling();
DROP TRIGGER IF EXISTS access_assignment_ceiling_event_complete ON public.access_assignment_ceiling_event;
CREATE CONSTRAINT TRIGGER access_assignment_ceiling_event_complete AFTER INSERT ON public.access_assignment_ceiling_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_access_assignment_ceiling();
