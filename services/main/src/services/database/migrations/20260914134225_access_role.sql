SET search_path TO public;

-- Create "access_role" table
CREATE TABLE "access_role" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "scope_id" uuid NOT NULL,
  "version" bigint NOT NULL DEFAULT 0,
  "active_revision" bigint NULL,
  "state" text NOT NULL DEFAULT 'draft',
  PRIMARY KEY ("id"),
  CONSTRAINT "access_role_state_check" CHECK ((state = ANY (ARRAY['draft'::text, 'active'::text, 'retired'::text])) AND ((state <> 'draft'::text) OR (active_revision IS NULL)) AND ((state <> 'active'::text) OR (active_revision IS NOT NULL))),
  CONSTRAINT "access_role_version_check" CHECK (((version >= 0) AND (version <= '9007199254740991'::bigint)) AND ((active_revision IS NULL) OR ((active_revision >= 1) AND (active_revision <= version))))
);
-- Create index "access_role_scope_idx" to table: "access_role"
CREATE INDEX "access_role_scope_idx" ON "access_role" ("scope_id", "id");
-- Create "access_role_event" table
CREATE TABLE "access_role_event" (
  "role_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  "operation_id" uuid NOT NULL,
  "request_digest" text NOT NULL,
  "operation" text NOT NULL,
  "state_after" text NOT NULL,
  "active_revision" bigint NULL,
  "operator_auth_user_id" uuid NOT NULL,
  "authority_subject_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("role_id", "version"),
  CONSTRAINT "access_role_event_digest_check" CHECK (request_digest ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "access_role_event_operation_check" CHECK (operation = ANY (ARRAY['create'::text, 'revise'::text, 'activate'::text, 'retire'::text])),
  CONSTRAINT "access_role_event_state_check" CHECK (state_after = ANY (ARRAY['draft'::text, 'active'::text, 'retired'::text])),
  CONSTRAINT "access_role_event_version_check" CHECK ((version >= 1) AND (version <= '9007199254740991'::bigint))
);
-- Create index "access_role_event_operation_key" to table: "access_role_event"
CREATE UNIQUE INDEX "access_role_event_operation_key" ON "access_role_event" ("role_id", "operation_id");
-- Create "access_role_permission" table
CREATE TABLE "access_role_permission" (
  "role_id" uuid NOT NULL,
  "revision" bigint NOT NULL,
  "family" text NOT NULL,
  "permission" text NOT NULL,
  PRIMARY KEY ("role_id", "revision", "family", "permission"),
  CONSTRAINT "access_role_permission_registered_check" CHECK (((family = 'unit'::text) AND (permission = ANY (ARRAY['unit.read'::text, 'unit.update'::text, 'unit.metadata-only.update'::text, 'unit.status.update'::text, 'unit.history.restore'::text, 'unit.access.manage'::text, 'unit.ownership.transfer'::text, 'unit.association.manage'::text, 'unit.tag-curation.manage'::text, 'unit.reference-curation.manage'::text, 'unit.realm-publication.manage'::text, 'zone.pages.manage'::text, 'zone.theme.manage'::text, 'realm.contribute'::text, 'realm.units.create'::text, 'realm.post.replies.create'::text, 'realm.settings.update'::text, 'realm.members.read'::text, 'realm.members.manage'::text, 'realm.rules.update'::text, 'realm.pins.manage'::text, 'realm.tags.manage'::text, 'realm.tag-voting.update'::text, 'realm.tag-contexts.manage'::text, 'realm.units.moderate'::text, 'entity.association.credit.request'::text, 'entity.association.credit.direct'::text, 'entity.association.subject.request'::text, 'entity.association.subject.direct'::text]))) OR ((family = 'platform'::text) AND (permission = ANY (ARRAY['platform.access.read'::text, 'platform.access.manage'::text, 'platform.audit.read'::text, 'platform.user.read'::text, 'platform.user.status.update'::text, 'platform.session.read'::text, 'platform.session.revoke'::text, 'entity.associations.override'::text, 'catalog.definition.manage'::text, 'unit.edit'::text, 'platform.development_preview.access'::text, 'platform.custom_theme.external_live.access'::text, 'platform.custom_theme.external_live.access.manage'::text, 'platform.custom_theme.review'::text, 'platform.custom_theme.kill'::text, 'unit.governance.read'::text, 'unit.merge.propose'::text, 'unit.merge.review'::text, 'unit.merge'::text, 'unit.ownership.override'::text, 'unit.license.manage'::text, 'unit.delete'::text, 'unit.restore'::text, 'unit.slug.manage'::text, 'unit.slug.namespace.manage'::text, 'unit.slug.redirect.release'::text, 'platform.api_quota_policy.read'::text, 'platform.api_quota_policy.update'::text, 'platform.user.api_quota.read'::text, 'platform.user.api_quota.update'::text, 'platform.user.api_token.api_quota.read'::text, 'platform.user.api_token.api_quota.update'::text, 'platform.moderate'::text, 'platform.suppress'::text, 'realm.contribute'::text, 'realm.units.create'::text, 'realm.post.replies.create'::text, 'realm.settings.update'::text, 'realm.members.read'::text, 'realm.members.manage'::text, 'realm.rules.update'::text, 'realm.pins.manage'::text, 'realm.tags.manage'::text, 'realm.tag-voting.update'::text, 'realm.tag-contexts.manage'::text, 'realm.units.moderate'::text]))) OR ((family = 'management'::text) AND (permission = ANY (ARRAY['access.role.read'::text, 'access.role.create'::text, 'access.role.update'::text, 'access.role.activate'::text, 'access.role.retire'::text, 'access.role-binding.manage'::text, 'access.assignment-ceiling.manage'::text]))))
);
-- Create "access_role_revision" table
CREATE TABLE "access_role_revision" (
  "role_id" uuid NOT NULL,
  "revision" bigint NOT NULL,
  "label" text NOT NULL,
  "description" text NULL,
  "permission_count" integer NOT NULL,
  "permission_digest" text NOT NULL,
  "sealed" boolean NOT NULL DEFAULT false,
  PRIMARY KEY ("role_id", "revision"),
  CONSTRAINT "access_role_revision_count_check" CHECK ((permission_count >= 0) AND (permission_count <= 82)),
  CONSTRAINT "access_role_revision_description_check" CHECK ((description IS NULL) OR (octet_length(description) <= 4096)),
  CONSTRAINT "access_role_revision_digest_check" CHECK (permission_digest ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "access_role_revision_label_check" CHECK ((length(btrim(label)) > 0) AND (octet_length(label) <= 512))
);
-- Modify "access_role" table
ALTER TABLE "access_role" ADD CONSTRAINT "access_role_active_revision_fk" FOREIGN KEY ("id", "active_revision") REFERENCES "access_role_revision" ("role_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "access_role_scope_id_access_scope_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "access_scope" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "access_role_event" table
ALTER TABLE "access_role_event" ADD CONSTRAINT "access_role_event_active_revision_fk" FOREIGN KEY ("role_id", "active_revision") REFERENCES "access_role_revision" ("role_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "access_role_event_authority_subject_id_access_subject_id_fkey" FOREIGN KEY ("authority_subject_id") REFERENCES "access_subject" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "access_role_event_operator_auth_user_id_users_id_fkey" FOREIGN KEY ("operator_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "access_role_event_role_id_access_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "access_role" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "access_role_permission" table
ALTER TABLE "access_role_permission" ADD CONSTRAINT "access_role_permission_revision_fk" FOREIGN KEY ("role_id", "revision") REFERENCES "access_role_revision" ("role_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "access_role_revision" table
ALTER TABLE "access_role_revision" ADD CONSTRAINT "access_role_revision_event_fk" FOREIGN KEY ("role_id", "revision") REFERENCES "access_role_event" ("role_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT;

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
