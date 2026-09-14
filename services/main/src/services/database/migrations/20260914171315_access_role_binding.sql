SET search_path TO public;

-- Create "access_role_binding" table
CREATE TABLE "access_role_binding" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "target_scope_id" uuid NOT NULL,
  "role_id" uuid NOT NULL,
  "recipient_kind" text NOT NULL,
  "recipient_subject_id" uuid NULL,
  "recipient_group_id" uuid NULL,
  "recipient_scope_id" uuid NULL,
  "version" bigint NOT NULL DEFAULT 0,
  "terms_revision" bigint NULL,
  "state" text NOT NULL DEFAULT 'draft',
  PRIMARY KEY ("id"),
  CONSTRAINT "access_role_binding_recipient_check" CHECK (((recipient_kind = 'subject'::text) AND (recipient_subject_id IS NOT NULL) AND (recipient_group_id IS NULL) AND (recipient_scope_id IS NULL)) OR ((recipient_kind = 'group'::text) AND (recipient_subject_id IS NULL) AND (recipient_group_id IS NOT NULL) AND (recipient_scope_id IS NOT NULL)) OR ((recipient_kind = 'all-members'::text) AND (recipient_subject_id IS NULL) AND (recipient_group_id IS NULL) AND (recipient_scope_id IS NOT NULL))),
  CONSTRAINT "access_role_binding_state_check" CHECK (((state = 'draft'::text) AND (terms_revision IS NULL)) OR ((state = ANY (ARRAY['active'::text, 'revoked'::text])) AND (terms_revision IS NOT NULL))),
  CONSTRAINT "access_role_binding_version_check" CHECK (((version >= 0) AND (version <= '9007199254740991'::bigint)) AND ((terms_revision IS NULL) OR ((terms_revision >= 1) AND (terms_revision <= version))))
);
-- Create index "access_role_binding_group_idx" to table: "access_role_binding"
CREATE INDEX "access_role_binding_group_idx" ON "access_role_binding" ("recipient_group_id", "target_scope_id", "id") WHERE (recipient_group_id IS NOT NULL);
-- Create index "access_role_binding_members_idx" to table: "access_role_binding"
CREATE INDEX "access_role_binding_members_idx" ON "access_role_binding" ("recipient_scope_id", "target_scope_id", "id") WHERE (recipient_kind = 'all-members'::text);
-- Create index "access_role_binding_role_idx" to table: "access_role_binding"
CREATE INDEX "access_role_binding_role_idx" ON "access_role_binding" ("role_id", "target_scope_id", "id");
-- Create index "access_role_binding_subject_idx" to table: "access_role_binding"
CREATE INDEX "access_role_binding_subject_idx" ON "access_role_binding" ("recipient_subject_id", "target_scope_id", "id") WHERE (recipient_subject_id IS NOT NULL);
-- Create index "access_role_binding_target_idx" to table: "access_role_binding"
CREATE INDEX "access_role_binding_target_idx" ON "access_role_binding" ("target_scope_id", "id");
-- Create "access_role_binding_event" table
CREATE TABLE "access_role_binding_event" (
  "binding_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  "operation_id" uuid NOT NULL,
  "request_digest" text NOT NULL,
  "operation" text NOT NULL,
  "retained_terms_revision" bigint NULL,
  "operator_auth_user_id" uuid NOT NULL,
  "authority_subject_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("binding_id", "version"),
  CONSTRAINT "access_role_binding_event_digest_check" CHECK (request_digest ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "access_role_binding_event_operation_check" CHECK (((operation = ANY (ARRAY['create'::text, 'amend'::text])) AND (retained_terms_revision IS NULL)) OR ((operation = 'revoke'::text) AND (retained_terms_revision IS NOT NULL) AND (retained_terms_revision < version))),
  CONSTRAINT "access_role_binding_event_version_check" CHECK ((version >= 1) AND (version <= '9007199254740991'::bigint))
);
-- Create index "access_role_binding_event_operation_key" to table: "access_role_binding_event"
CREATE UNIQUE INDEX "access_role_binding_event_operation_key" ON "access_role_binding_event" ("binding_id", "operation_id");
-- Create "access_role_binding_permission" table
CREATE TABLE "access_role_binding_permission" (
  "binding_id" uuid NOT NULL,
  "revision" bigint NOT NULL,
  "family" text NOT NULL,
  "permission" text NOT NULL,
  PRIMARY KEY ("binding_id", "revision", "family", "permission"),
  CONSTRAINT "access_role_binding_permission_known_check" CHECK (((family = 'unit'::text) AND (permission = ANY (ARRAY['unit.read'::text, 'unit.update'::text, 'unit.metadata-only.update'::text, 'unit.status.update'::text, 'unit.history.restore'::text, 'unit.access.manage'::text, 'unit.ownership.transfer'::text, 'unit.association.manage'::text, 'unit.tag-curation.manage'::text, 'unit.reference-curation.manage'::text, 'unit.realm-publication.manage'::text, 'zone.pages.manage'::text, 'zone.theme.manage'::text, 'realm.contribute'::text, 'realm.units.create'::text, 'realm.post.replies.create'::text, 'realm.settings.update'::text, 'realm.members.read'::text, 'realm.members.manage'::text, 'realm.rules.update'::text, 'realm.pins.manage'::text, 'realm.tags.manage'::text, 'realm.tag-voting.update'::text, 'realm.tag-contexts.manage'::text, 'realm.units.moderate'::text, 'entity.association.credit.request'::text, 'entity.association.credit.direct'::text, 'entity.association.subject.request'::text, 'entity.association.subject.direct'::text]))) OR ((family = 'platform'::text) AND (permission = ANY (ARRAY['platform.access.read'::text, 'platform.access.manage'::text, 'platform.audit.read'::text, 'platform.user.read'::text, 'platform.user.status.update'::text, 'platform.session.read'::text, 'platform.session.revoke'::text, 'entity.associations.override'::text, 'catalog.definition.manage'::text, 'unit.edit'::text, 'platform.development_preview.access'::text, 'platform.custom_theme.external_live.access'::text, 'platform.custom_theme.external_live.access.manage'::text, 'platform.custom_theme.review'::text, 'platform.custom_theme.kill'::text, 'unit.governance.read'::text, 'unit.merge.propose'::text, 'unit.merge.review'::text, 'unit.merge'::text, 'unit.ownership.override'::text, 'unit.license.manage'::text, 'unit.delete'::text, 'unit.restore'::text, 'unit.slug.manage'::text, 'unit.slug.namespace.manage'::text, 'unit.slug.redirect.release'::text, 'platform.api_quota_policy.read'::text, 'platform.api_quota_policy.update'::text, 'platform.user.api_quota.read'::text, 'platform.user.api_quota.update'::text, 'platform.user.api_token.api_quota.read'::text, 'platform.user.api_token.api_quota.update'::text, 'platform.moderate'::text, 'platform.suppress'::text, 'realm.contribute'::text, 'realm.units.create'::text, 'realm.post.replies.create'::text, 'realm.settings.update'::text, 'realm.members.read'::text, 'realm.members.manage'::text, 'realm.rules.update'::text, 'realm.pins.manage'::text, 'realm.tags.manage'::text, 'realm.tag-voting.update'::text, 'realm.tag-contexts.manage'::text, 'realm.units.moderate'::text]))) OR ((family = 'management'::text) AND (permission = ANY (ARRAY['access.role.read'::text, 'access.role.create'::text, 'access.role.update'::text, 'access.role.activate'::text, 'access.role.retire'::text, 'access.role-binding.manage'::text, 'access.assignment-ceiling.manage'::text]))))
);
-- Create "access_role_binding_revision" table
CREATE TABLE "access_role_binding_revision" (
  "binding_id" uuid NOT NULL,
  "revision" bigint NOT NULL,
  "target_path" text[] NOT NULL,
  "valid_from" timestamptz(3) NOT NULL,
  "valid_until" timestamptz(3) NULL,
  "permission_policy" text NOT NULL,
  "permission_count" integer NOT NULL,
  "permission_digest" text NOT NULL,
  "sealed" boolean NOT NULL DEFAULT false,
  PRIMARY KEY ("binding_id", "revision"),
  CONSTRAINT "access_role_binding_revision_count_check" CHECK (((permission_count >= 0) AND (permission_count <= 82)) AND ((permission_policy <> 'local-role'::text) OR (permission_count = 0))),
  CONSTRAINT "access_role_binding_revision_digest_check" CHECK (permission_digest ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "access_role_binding_revision_path_check" CHECK (((cardinality(target_path) >= 0) AND (cardinality(target_path) <= 8)) AND (COALESCE(array_ndims(target_path), 1) = 1) AND (array_position(target_path, NULL::text) IS NULL)),
  CONSTRAINT "access_role_binding_revision_policy_check" CHECK (permission_policy = ANY (ARRAY['local-role'::text, 'frozen-ceiling'::text])),
  CONSTRAINT "access_role_binding_revision_validity_check" CHECK (isfinite(valid_from) AND ((valid_until IS NULL) OR (isfinite(valid_until) AND (valid_until > valid_from))))
);
-- Create "access_role_binding_scope" table
CREATE TABLE "access_role_binding_scope" (
  "scope_id" uuid NOT NULL,
  "version" bigint NOT NULL DEFAULT 0,
  PRIMARY KEY ("scope_id"),
  CONSTRAINT "access_role_binding_scope_version_check" CHECK ((version >= 0) AND (version <= '9007199254740991'::bigint))
);
-- Modify "access_role_binding" table
ALTER TABLE "access_role_binding" ADD CONSTRAINT "access_role_binding_ajEeuopf36ek_fkey" FOREIGN KEY ("target_scope_id") REFERENCES "access_role_binding_scope" ("scope_id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "access_role_binding_group_scope_fk" FOREIGN KEY ("recipient_group_id", "recipient_scope_id") REFERENCES "access_group" ("id", "scope_id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "access_role_binding_recipient_scope_id_access_scope_id_fkey" FOREIGN KEY ("recipient_scope_id") REFERENCES "access_scope" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "access_role_binding_recipient_subject_id_access_subject_id_fkey" FOREIGN KEY ("recipient_subject_id") REFERENCES "access_subject" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "access_role_binding_role_id_access_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "access_role" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "access_role_binding_terms_fk" FOREIGN KEY ("id", "terms_revision") REFERENCES "access_role_binding_revision" ("binding_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "access_role_binding_event" table
ALTER TABLE "access_role_binding_event" ADD CONSTRAINT "access_role_binding_event_5bzA9qgdPAHk_fkey" FOREIGN KEY ("binding_id") REFERENCES "access_role_binding" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "access_role_binding_event_cuK8zONaYZ7l_fkey" FOREIGN KEY ("authority_subject_id") REFERENCES "access_subject" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "access_role_binding_event_operator_auth_user_id_users_id_fkey" FOREIGN KEY ("operator_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "access_role_binding_event_retained_terms_fk" FOREIGN KEY ("binding_id", "retained_terms_revision") REFERENCES "access_role_binding_revision" ("binding_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "access_role_binding_permission" table
ALTER TABLE "access_role_binding_permission" ADD CONSTRAINT "access_role_binding_permission_revision_fk" FOREIGN KEY ("binding_id", "revision") REFERENCES "access_role_binding_revision" ("binding_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "access_role_binding_revision" table
ALTER TABLE "access_role_binding_revision" ADD CONSTRAINT "access_role_binding_revision_event_fk" FOREIGN KEY ("binding_id", "revision") REFERENCES "access_role_binding_event" ("binding_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "access_role_binding_scope" table
ALTER TABLE "access_role_binding_scope" ADD CONSTRAINT "access_role_binding_scope_scope_id_access_scope_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "access_scope" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.initialize_access_role_binding_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 INSERT INTO public.access_role_binding_scope(scope_id) VALUES(NEW.id);
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_role_binding_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Binding scope fence is retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 THEN RAISE EXCEPTION 'Binding scope starts at version zero' USING ERRCODE='23514'; END IF;
 ELSIF NEW.scope_id<>OLD.scope_id OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Binding scope identity is fixed and version advances by one' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_role_binding_head()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE receipt public.access_role_binding_event%ROWTYPE; terms public.access_role_binding_revision%ROWTYPE; role_state text; role_scope uuid; expected_terms bigint;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Binding identity and history are retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.state<>'draft' OR NEW.terms_revision IS NOT NULL THEN RAISE EXCEPTION 'Binding starts without effective terms' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.id,NEW.target_scope_id,NEW.role_id,NEW.recipient_kind,NEW.recipient_subject_id,NEW.recipient_group_id,NEW.recipient_scope_id) IS DISTINCT FROM ROW(OLD.id,OLD.target_scope_id,OLD.role_id,OLD.recipient_kind,OLD.recipient_subject_id,OLD.recipient_group_id,OLD.recipient_scope_id) THEN RAISE EXCEPTION 'Binding identity cannot be retargeted' USING ERRCODE='55000'; END IF;
 IF OLD.state='revoked' OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Binding transition is stale or revoked' USING ERRCODE='23514'; END IF;
 SELECT * INTO receipt FROM public.access_role_binding_event WHERE binding_id=NEW.id AND version=NEW.version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Binding transition requires an exact receipt' USING ERRCODE='23514'; END IF;
 expected_terms:=CASE WHEN receipt.operation='revoke' THEN receipt.retained_terms_revision ELSE receipt.version END;
 IF NEW.terms_revision IS DISTINCT FROM expected_terms OR NEW.state IS DISTINCT FROM (CASE WHEN receipt.operation='revoke' THEN 'revoked' ELSE 'active' END) THEN RAISE EXCEPTION 'Binding head does not match its receipt' USING ERRCODE='23514'; END IF;
 SELECT * INTO terms FROM public.access_role_binding_revision WHERE binding_id=NEW.id AND revision=NEW.terms_revision AND sealed;
 IF NOT FOUND THEN RAISE EXCEPTION 'Binding requires its exact sealed terms' USING ERRCODE='23514'; END IF;
 IF NEW.state='active' THEN
  SELECT state,scope_id INTO role_state,role_scope FROM public.access_role WHERE id=NEW.role_id FOR SHARE;
  IF role_state IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'Binding requires an active role at its effect' USING ERRCODE='23514'; END IF;
  IF terms.permission_policy='local-role' AND (role_scope<>NEW.target_scope_id OR (NEW.recipient_scope_id IS NOT NULL AND NEW.recipient_scope_id<>NEW.target_scope_id)) THEN RAISE EXCEPTION 'Cross-authority role use requires explicit approved permissions' USING ERRCODE='23514'; END IF;
  IF NEW.recipient_kind='group' AND NOT EXISTS(SELECT 1 FROM public.access_group WHERE id=NEW.recipient_group_id AND scope_id=NEW.recipient_scope_id AND state='active') THEN RAISE EXCEPTION 'Binding Group must be active at its effect' USING ERRCODE='23514'; END IF;
 END IF;
 UPDATE public.access_role_binding_scope SET version=version+1 WHERE scope_id=NEW.target_scope_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Binding scope fence is missing' USING ERRCODE='23503'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_role_binding_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.access_role_binding%ROWTYPE; declared_actor uuid;
BEGIN
 SELECT * INTO head FROM public.access_role_binding WHERE id=NEW.binding_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Binding identity is missing' USING ERRCODE='23503'; END IF;
 PERFORM scope_id FROM public.access_role_binding_scope WHERE scope_id=head.target_scope_id FOR NO KEY UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Binding scope fence is missing' USING ERRCODE='23503'; END IF;
 IF head.recipient_kind='group' THEN
  PERFORM scope_id FROM public.access_group_tree WHERE scope_id=head.recipient_scope_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recipient Group tree fence is missing' USING ERRCODE='23503'; END IF;
 END IF;
 PERFORM id FROM public.access_role WHERE id=head.role_id FOR SHARE;
 SELECT * INTO head FROM public.access_role_binding WHERE id=NEW.binding_id FOR UPDATE;
 SELECT auth_user_id INTO declared_actor FROM public.access_subject WHERE id=NEW.authority_subject_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Authority subject is missing' USING ERRCODE='23503'; END IF;
 IF declared_actor IS NOT NULL AND declared_actor<>NEW.operator_auth_user_id THEN RAISE EXCEPTION 'Direct authority cannot name another operator' USING ERRCODE='23514'; END IF;
 IF head.state='revoked' OR NEW.version<>head.version+1 THEN RAISE EXCEPTION 'Binding receipt is stale or revoked' USING ERRCODE='23514'; END IF;
 IF NEW.operation='create' THEN
  IF head.version<>0 THEN RAISE EXCEPTION 'Binding already exists' USING ERRCODE='23514'; END IF;
 ELSIF head.version=0 THEN RAISE EXCEPTION 'Binding must be created first' USING ERRCODE='23514';
 END IF;
 IF NEW.operation='revoke' AND NEW.retained_terms_revision IS DISTINCT FROM head.terms_revision THEN RAISE EXCEPTION 'Revocation retains the current terms' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_role_binding_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE event_kind text; actual_count integer; actual_digest text;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Binding terms are immutable' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  SELECT operation INTO event_kind FROM public.access_role_binding_event WHERE binding_id=NEW.binding_id AND version=NEW.revision;
  IF event_kind IS NULL THEN RAISE EXCEPTION 'Terms receipt is missing' USING ERRCODE='23503'; END IF;
  IF event_kind NOT IN('create','amend') OR NEW.sealed THEN RAISE EXCEPTION 'Terms require their creating receipt before sealing' USING ERRCODE='23514'; END IF;
  IF cardinality(NEW.target_path)>0 AND array_lower(NEW.target_path,1)<>1 THEN RAISE EXCEPTION 'Binding target paths use canonical array bounds' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(NEW.target_path) segment WHERE segment !~ '^[a-z0-9][a-z0-9-]{0,255}$') THEN RAISE EXCEPTION 'Invalid binding target path' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.sealed OR NOT NEW.sealed OR (to_jsonb(NEW)-'sealed') IS DISTINCT FROM (to_jsonb(OLD)-'sealed') THEN RAISE EXCEPTION 'Only sealing can change binding terms' USING ERRCODE='55000'; END IF;
 SELECT count(*)::integer,encode(sha256(convert_to(coalesce(string_agg(family||':'||permission,E'\n' ORDER BY family COLLATE "C",permission COLLATE "C"),''),'UTF8')),'hex') INTO actual_count,actual_digest FROM public.access_role_binding_permission WHERE binding_id=NEW.binding_id AND revision=NEW.revision;
 IF actual_count<>NEW.permission_count OR actual_digest<>NEW.permission_digest THEN RAISE EXCEPTION 'Binding approval snapshot is incomplete or inconsistent' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_role_binding_permission()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE terms public.access_role_binding_revision%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Binding approval history is immutable' USING ERRCODE='55000'; END IF;
 SELECT * INTO terms FROM public.access_role_binding_revision WHERE binding_id=NEW.binding_id AND revision=NEW.revision FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Binding terms are missing' USING ERRCODE='23503'; END IF;
 IF terms.sealed THEN RAISE EXCEPTION 'Sealed terms cannot gain approved permissions' USING ERRCODE='55000'; END IF;
 IF terms.permission_policy<>'frozen-ceiling' THEN RAISE EXCEPTION 'Local role following has no frozen permission rows' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.validate_access_role_binding_history()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE final_version bigint; receipt public.access_role_binding_event%ROWTYPE; expected_terms bigint;
BEGIN
 IF TG_TABLE_NAME='access_role_binding' THEN
  SELECT version INTO final_version FROM public.access_role_binding WHERE id=NEW.id;
  IF final_version=0 THEN RAISE EXCEPTION 'Binding creation must complete sealed terms' USING ERRCODE='23514'; END IF;
  IF NEW.version>0 THEN
   SELECT * INTO receipt FROM public.access_role_binding_event WHERE binding_id=NEW.id AND version=NEW.version;
   IF NOT FOUND THEN RAISE EXCEPTION 'Binding head requires its exact receipt' USING ERRCODE='23514'; END IF;
   expected_terms:=CASE WHEN receipt.operation='revoke' THEN receipt.retained_terms_revision ELSE receipt.version END;
   IF NEW.terms_revision IS DISTINCT FROM expected_terms OR NEW.state IS DISTINCT FROM (CASE WHEN receipt.operation='revoke' THEN 'revoked' ELSE 'active' END) THEN RAISE EXCEPTION 'Binding transition snapshot is inconsistent' USING ERRCODE='23514'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='access_role_binding_event' THEN
  SELECT version INTO final_version FROM public.access_role_binding WHERE id=NEW.binding_id;
  IF final_version<NEW.version THEN RAISE EXCEPTION 'Binding receipt must advance the head' USING ERRCODE='23514'; END IF;
  IF NEW.operation<>'revoke' AND NOT EXISTS(SELECT 1 FROM public.access_role_binding_revision WHERE binding_id=NEW.binding_id AND revision=NEW.version AND sealed) THEN RAISE EXCEPTION 'Binding receipt must complete its terms' USING ERRCODE='23514'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.access_role_binding_revision WHERE binding_id=NEW.binding_id AND revision=NEW.revision AND sealed) THEN RAISE EXCEPTION 'Binding terms must be sealed before commit' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS access_role_binding_scope_initialize ON public.access_scope;
CREATE TRIGGER access_role_binding_scope_initialize AFTER INSERT ON public.access_scope FOR EACH ROW EXECUTE FUNCTION public.initialize_access_role_binding_scope();
DROP TRIGGER IF EXISTS access_role_binding_scope_guard ON public.access_role_binding_scope;
CREATE TRIGGER access_role_binding_scope_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_role_binding_scope FOR EACH ROW EXECUTE FUNCTION public.guard_access_role_binding_scope();
DROP TRIGGER IF EXISTS access_role_binding_head_guard ON public.access_role_binding;
CREATE TRIGGER access_role_binding_head_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_role_binding FOR EACH ROW EXECUTE FUNCTION public.guard_access_role_binding_head();
DROP TRIGGER IF EXISTS access_role_binding_event_guard ON public.access_role_binding_event;
CREATE TRIGGER access_role_binding_event_guard BEFORE INSERT ON public.access_role_binding_event FOR EACH ROW EXECUTE FUNCTION public.guard_access_role_binding_event();
DROP TRIGGER IF EXISTS access_role_binding_event_immutable ON public.access_role_binding_event;
CREATE TRIGGER access_role_binding_event_immutable BEFORE UPDATE OR DELETE ON public.access_role_binding_event FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
DROP TRIGGER IF EXISTS access_role_binding_revision_guard ON public.access_role_binding_revision;
CREATE TRIGGER access_role_binding_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_role_binding_revision FOR EACH ROW EXECUTE FUNCTION public.guard_access_role_binding_revision();
DROP TRIGGER IF EXISTS access_role_binding_permission_guard ON public.access_role_binding_permission;
CREATE TRIGGER access_role_binding_permission_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_role_binding_permission FOR EACH ROW EXECUTE FUNCTION public.guard_access_role_binding_permission();
DROP TRIGGER IF EXISTS access_role_binding_head_complete ON public.access_role_binding;
CREATE CONSTRAINT TRIGGER access_role_binding_head_complete AFTER INSERT OR UPDATE ON public.access_role_binding DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_role_binding_history();
DROP TRIGGER IF EXISTS access_role_binding_event_complete ON public.access_role_binding_event;
CREATE CONSTRAINT TRIGGER access_role_binding_event_complete AFTER INSERT ON public.access_role_binding_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_role_binding_history();
DROP TRIGGER IF EXISTS access_role_binding_revision_complete ON public.access_role_binding_revision;
CREATE CONSTRAINT TRIGGER access_role_binding_revision_complete AFTER INSERT OR UPDATE ON public.access_role_binding_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_role_binding_history();
