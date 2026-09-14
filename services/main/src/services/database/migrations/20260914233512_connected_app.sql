SET search_path TO public;

CREATE TABLE "connected_app" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"scope_id" uuid NOT NULL,
	"version" bigint DEFAULT 0 NOT NULL,
	"authority_epoch" bigint DEFAULT 0 NOT NULL,
	"declared_revision" bigint,
	"state" text DEFAULT 'draft' NOT NULL,
	"trust" text DEFAULT 'unreviewed' NOT NULL,
	CONSTRAINT "connected_app_version_check" CHECK ("version" between 0 and 9007199254740991 and ("declared_revision" is null or "declared_revision" between 1 and "version")),
	CONSTRAINT "connected_app_epoch_check" CHECK ("authority_epoch" between 0 and "version" and ("version"=0 or "authority_epoch">0)),
	CONSTRAINT "connected_app_state_check" CHECK (("state"='draft' and "version"=0 and "declared_revision" is null) or ("state" in ('active','disabled','retired') and "version">0 and "declared_revision" is not null)),
	CONSTRAINT "connected_app_trust_check" CHECK ("trust" in ('unreviewed','trusted','blocked') and ("trust"<>'blocked' or "state" in ('disabled','retired')))
);

CREATE TABLE "connected_app_capability" (
	"app_id" uuid,
	"revision" bigint,
	"family" text,
	"capability" text,
	CONSTRAINT "connected_app_capability_pkey" PRIMARY KEY("app_id","revision","family","capability"),
	CONSTRAINT "connected_app_capability_registered_check" CHECK ((((("family"='api') and ("capability" in ('unit:read', 'unit:create', 'unit:update', 'account:read', 'account:update', 'access:read', 'access:manage', 'app:read', 'app:manage', 'interaction:read', 'interaction:write', 'realm:read', 'realm:manage', 'message:read', 'message:write', 'notification:read', 'notification:write', 'recommendation:read', 'recommendation:write', 'upload:read', 'upload:write', 'report:write')))) or ((("family"='unit') and ("capability" in ('unit.read', 'unit.update', 'unit.metadata-only.update', 'unit.status.update', 'unit.history.restore', 'unit.access.manage', 'unit.ownership.transfer', 'unit.association.manage', 'unit.tag-curation.manage', 'unit.reference-curation.manage', 'unit.realm-publication.manage', 'zone.pages.manage', 'zone.theme.manage', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate', 'entity.association.credit.request', 'entity.association.credit.direct', 'entity.association.subject.request', 'entity.association.subject.direct')))) or ((("family"='platform') and ("capability" in ('platform.access.read', 'platform.access.manage', 'platform.audit.read', 'platform.user.read', 'platform.user.status.update', 'platform.session.read', 'platform.session.revoke', 'entity.associations.override', 'catalog.definition.manage', 'unit.edit', 'platform.development_preview.access', 'platform.custom_theme.external_live.access', 'platform.custom_theme.external_live.access.manage', 'platform.custom_theme.review', 'platform.custom_theme.kill', 'unit.governance.read', 'unit.merge.propose', 'unit.merge.review', 'unit.merge', 'unit.ownership.override', 'unit.license.manage', 'unit.delete', 'unit.restore', 'unit.slug.manage', 'unit.slug.namespace.manage', 'unit.slug.redirect.release', 'platform.api_quota_policy.read', 'platform.api_quota_policy.update', 'platform.user.api_quota.read', 'platform.user.api_quota.update', 'platform.user.api_token.api_quota.read', 'platform.user.api_token.api_quota.update', 'platform.moderate', 'platform.suppress', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate')))) or ((("family"='management') and ("capability" in ('access.identity.select', 'access.role.read', 'access.role.create', 'access.role.update', 'access.role.activate', 'access.role.retire', 'access.role-binding.manage', 'access.assignment-ceiling.manage', 'app.read', 'app.create', 'app.update', 'app.disable', 'app.retire', 'app.trust.manage'))))))
);

CREATE TABLE "connected_app_event" (
	"app_id" uuid,
	"version" bigint,
	"operation_id" uuid NOT NULL,
	"request_digest" text NOT NULL,
	"operation" text NOT NULL,
	"state_after" text NOT NULL,
	"trust_after" text NOT NULL,
	"authority_epoch_after" bigint NOT NULL,
	"retained_declared_revision" bigint,
	"operator_auth_user_id" uuid NOT NULL,
	"authority_subject_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connected_app_event_pkey" PRIMARY KEY("app_id","version"),
	CONSTRAINT "connected_app_event_version_check" CHECK ("version" between 1 and 9007199254740991),
	CONSTRAINT "connected_app_event_epoch_check" CHECK ("authority_epoch_after" between 1 and "version"),
	CONSTRAINT "connected_app_event_digest_check" CHECK ("request_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "connected_app_event_operation_check" CHECK ("operation" in ('create', 'revise', 'disable', 'enable', 'retire', 'set-trust')),
	CONSTRAINT "connected_app_event_state_check" CHECK ("state_after" in ('active', 'disabled', 'retired')),
	CONSTRAINT "connected_app_event_trust_check" CHECK ("trust_after" in ('unreviewed', 'trusted', 'blocked')),
	CONSTRAINT "connected_app_event_revision_check" CHECK (("operation" in ('create','revise') and "retained_declared_revision" is null) or ("operation" not in ('create','revise') and "retained_declared_revision" is not null and "retained_declared_revision" between 1 and "version"-1))
);

CREATE TABLE "connected_app_revision" (
	"app_id" uuid,
	"revision" bigint,
	"label" text NOT NULL,
	"description" text,
	"offline_access" boolean NOT NULL,
	"entity_disclosure" boolean NOT NULL,
	"capability_count" integer NOT NULL,
	"capability_digest" text NOT NULL,
	"sealed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "connected_app_revision_pkey" PRIMARY KEY("app_id","revision"),
	CONSTRAINT "connected_app_revision_label_check" CHECK (length(btrim("label"))>0 and octet_length("label")<=512),
	CONSTRAINT "connected_app_revision_description_check" CHECK ("description" is null or octet_length("description")<=4096),
	CONSTRAINT "connected_app_revision_count_check" CHECK ("capability_count" between 0 and 111),
	CONSTRAINT "connected_app_revision_digest_check" CHECK ("capability_digest" ~ '^[0-9a-f]{64}$')
);

CREATE INDEX "connected_app_scope_idx" ON "connected_app" ("scope_id","id");
CREATE UNIQUE INDEX "connected_app_event_operation_key" ON "connected_app_event" ("app_id","operation_id");
ALTER TABLE "connected_app" ADD CONSTRAINT "connected_app_scope_id_access_scope_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "access_scope"("id") ON DELETE RESTRICT;
ALTER TABLE "connected_app" ADD CONSTRAINT "connected_app_declared_revision_fk" FOREIGN KEY ("id","declared_revision") REFERENCES "connected_app_revision"("app_id","revision") ON DELETE RESTRICT;
ALTER TABLE "connected_app_capability" ADD CONSTRAINT "connected_app_capability_revision_fk" FOREIGN KEY ("app_id","revision") REFERENCES "connected_app_revision"("app_id","revision") ON DELETE RESTRICT;
ALTER TABLE "connected_app_event" ADD CONSTRAINT "connected_app_event_app_id_connected_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "connected_app"("id") ON DELETE RESTRICT;
ALTER TABLE "connected_app_event" ADD CONSTRAINT "connected_app_event_operator_auth_user_id_users_id_fkey" FOREIGN KEY ("operator_auth_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "connected_app_event" ADD CONSTRAINT "connected_app_event_authority_subject_id_access_subject_id_fkey" FOREIGN KEY ("authority_subject_id") REFERENCES "access_subject"("id") ON DELETE RESTRICT;
ALTER TABLE "connected_app_event" ADD CONSTRAINT "connected_app_event_retained_revision_fk" FOREIGN KEY ("app_id","retained_declared_revision") REFERENCES "connected_app_revision"("app_id","revision") ON DELETE RESTRICT;
ALTER TABLE "connected_app_revision" ADD CONSTRAINT "connected_app_revision_event_fk" FOREIGN KEY ("app_id","revision") REFERENCES "connected_app_event"("app_id","version") ON DELETE RESTRICT;
ALTER TABLE "access_assignment_ceiling" DROP CONSTRAINT "access_assignment_ceiling_count_check", ADD CONSTRAINT "access_assignment_ceiling_count_check" CHECK ("permission_count" between 0 and 89);
ALTER TABLE "access_assignment_ceiling_permission" DROP CONSTRAINT "access_assignment_ceiling_permission_check", ADD CONSTRAINT "access_assignment_ceiling_permission_check" CHECK ((((("family" = 'unit') and ("permission" in ('unit.read', 'unit.update', 'unit.metadata-only.update', 'unit.status.update', 'unit.history.restore', 'unit.access.manage', 'unit.ownership.transfer', 'unit.association.manage', 'unit.tag-curation.manage', 'unit.reference-curation.manage', 'unit.realm-publication.manage', 'zone.pages.manage', 'zone.theme.manage', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate', 'entity.association.credit.request', 'entity.association.credit.direct', 'entity.association.subject.request', 'entity.association.subject.direct')))) or ((("family" = 'platform') and ("permission" in ('platform.access.read', 'platform.access.manage', 'platform.audit.read', 'platform.user.read', 'platform.user.status.update', 'platform.session.read', 'platform.session.revoke', 'entity.associations.override', 'catalog.definition.manage', 'unit.edit', 'platform.development_preview.access', 'platform.custom_theme.external_live.access', 'platform.custom_theme.external_live.access.manage', 'platform.custom_theme.review', 'platform.custom_theme.kill', 'unit.governance.read', 'unit.merge.propose', 'unit.merge.review', 'unit.merge', 'unit.ownership.override', 'unit.license.manage', 'unit.delete', 'unit.restore', 'unit.slug.manage', 'unit.slug.namespace.manage', 'unit.slug.redirect.release', 'platform.api_quota_policy.read', 'platform.api_quota_policy.update', 'platform.user.api_quota.read', 'platform.user.api_quota.update', 'platform.user.api_token.api_quota.read', 'platform.user.api_token.api_quota.update', 'platform.moderate', 'platform.suppress', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate')))) or ((("family" = 'management') and ("permission" in ('access.identity.select', 'access.role.read', 'access.role.create', 'access.role.update', 'access.role.activate', 'access.role.retire', 'access.role-binding.manage', 'access.assignment-ceiling.manage', 'app.read', 'app.create', 'app.update', 'app.disable', 'app.retire', 'app.trust.manage'))))));
ALTER TABLE "access_representation_permission" DROP CONSTRAINT "access_representation_permission_known_check", ADD CONSTRAINT "access_representation_permission_known_check" CHECK ((((("family" = 'unit') and ("permission" in ('unit.read', 'unit.update', 'unit.metadata-only.update', 'unit.status.update', 'unit.history.restore', 'unit.access.manage', 'unit.ownership.transfer', 'unit.association.manage', 'unit.tag-curation.manage', 'unit.reference-curation.manage', 'unit.realm-publication.manage', 'zone.pages.manage', 'zone.theme.manage', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate', 'entity.association.credit.request', 'entity.association.credit.direct', 'entity.association.subject.request', 'entity.association.subject.direct')))) or ((("family" = 'platform') and ("permission" in ('platform.access.read', 'platform.access.manage', 'platform.audit.read', 'platform.user.read', 'platform.user.status.update', 'platform.session.read', 'platform.session.revoke', 'entity.associations.override', 'catalog.definition.manage', 'unit.edit', 'platform.development_preview.access', 'platform.custom_theme.external_live.access', 'platform.custom_theme.external_live.access.manage', 'platform.custom_theme.review', 'platform.custom_theme.kill', 'unit.governance.read', 'unit.merge.propose', 'unit.merge.review', 'unit.merge', 'unit.ownership.override', 'unit.license.manage', 'unit.delete', 'unit.restore', 'unit.slug.manage', 'unit.slug.namespace.manage', 'unit.slug.redirect.release', 'platform.api_quota_policy.read', 'platform.api_quota_policy.update', 'platform.user.api_quota.read', 'platform.user.api_quota.update', 'platform.user.api_token.api_quota.read', 'platform.user.api_token.api_quota.update', 'platform.moderate', 'platform.suppress', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate')))) or ((("family" = 'management') and ("permission" in ('access.identity.select', 'access.role.read', 'access.role.create', 'access.role.update', 'access.role.activate', 'access.role.retire', 'access.role-binding.manage', 'access.assignment-ceiling.manage', 'app.read', 'app.create', 'app.update', 'app.disable', 'app.retire', 'app.trust.manage'))))));
ALTER TABLE "access_representation_revision" DROP CONSTRAINT "access_representation_revision_count_check", ADD CONSTRAINT "access_representation_revision_count_check" CHECK ("permission_count" between 0 and 89);
ALTER TABLE "access_role_binding_permission" DROP CONSTRAINT "access_role_binding_permission_known_check", ADD CONSTRAINT "access_role_binding_permission_known_check" CHECK ((((("family" = 'unit') and ("permission" in ('unit.read', 'unit.update', 'unit.metadata-only.update', 'unit.status.update', 'unit.history.restore', 'unit.access.manage', 'unit.ownership.transfer', 'unit.association.manage', 'unit.tag-curation.manage', 'unit.reference-curation.manage', 'unit.realm-publication.manage', 'zone.pages.manage', 'zone.theme.manage', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate', 'entity.association.credit.request', 'entity.association.credit.direct', 'entity.association.subject.request', 'entity.association.subject.direct')))) or ((("family" = 'platform') and ("permission" in ('platform.access.read', 'platform.access.manage', 'platform.audit.read', 'platform.user.read', 'platform.user.status.update', 'platform.session.read', 'platform.session.revoke', 'entity.associations.override', 'catalog.definition.manage', 'unit.edit', 'platform.development_preview.access', 'platform.custom_theme.external_live.access', 'platform.custom_theme.external_live.access.manage', 'platform.custom_theme.review', 'platform.custom_theme.kill', 'unit.governance.read', 'unit.merge.propose', 'unit.merge.review', 'unit.merge', 'unit.ownership.override', 'unit.license.manage', 'unit.delete', 'unit.restore', 'unit.slug.manage', 'unit.slug.namespace.manage', 'unit.slug.redirect.release', 'platform.api_quota_policy.read', 'platform.api_quota_policy.update', 'platform.user.api_quota.read', 'platform.user.api_quota.update', 'platform.user.api_token.api_quota.read', 'platform.user.api_token.api_quota.update', 'platform.moderate', 'platform.suppress', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate')))) or ((("family" = 'management') and ("permission" in ('access.identity.select', 'access.role.read', 'access.role.create', 'access.role.update', 'access.role.activate', 'access.role.retire', 'access.role-binding.manage', 'access.assignment-ceiling.manage', 'app.read', 'app.create', 'app.update', 'app.disable', 'app.retire', 'app.trust.manage'))))));
ALTER TABLE "access_role_binding_revision" DROP CONSTRAINT "access_role_binding_revision_count_check", ADD CONSTRAINT "access_role_binding_revision_count_check" CHECK ("permission_count" between 0 and 89 and ("permission_policy"<>'local-role' or "permission_count"=0));
ALTER TABLE "access_role_permission" DROP CONSTRAINT "access_role_permission_registered_check", ADD CONSTRAINT "access_role_permission_registered_check" CHECK ((((("family"='unit') and ("permission" in ('unit.read', 'unit.update', 'unit.metadata-only.update', 'unit.status.update', 'unit.history.restore', 'unit.access.manage', 'unit.ownership.transfer', 'unit.association.manage', 'unit.tag-curation.manage', 'unit.reference-curation.manage', 'unit.realm-publication.manage', 'zone.pages.manage', 'zone.theme.manage', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate', 'entity.association.credit.request', 'entity.association.credit.direct', 'entity.association.subject.request', 'entity.association.subject.direct')))) or ((("family"='platform') and ("permission" in ('platform.access.read', 'platform.access.manage', 'platform.audit.read', 'platform.user.read', 'platform.user.status.update', 'platform.session.read', 'platform.session.revoke', 'entity.associations.override', 'catalog.definition.manage', 'unit.edit', 'platform.development_preview.access', 'platform.custom_theme.external_live.access', 'platform.custom_theme.external_live.access.manage', 'platform.custom_theme.review', 'platform.custom_theme.kill', 'unit.governance.read', 'unit.merge.propose', 'unit.merge.review', 'unit.merge', 'unit.ownership.override', 'unit.license.manage', 'unit.delete', 'unit.restore', 'unit.slug.manage', 'unit.slug.namespace.manage', 'unit.slug.redirect.release', 'platform.api_quota_policy.read', 'platform.api_quota_policy.update', 'platform.user.api_quota.read', 'platform.user.api_quota.update', 'platform.user.api_token.api_quota.read', 'platform.user.api_token.api_quota.update', 'platform.moderate', 'platform.suppress', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate')))) or ((("family"='management') and ("permission" in ('access.identity.select', 'access.role.read', 'access.role.create', 'access.role.update', 'access.role.activate', 'access.role.retire', 'access.role-binding.manage', 'access.assignment-ceiling.manage', 'app.read', 'app.create', 'app.update', 'app.disable', 'app.retire', 'app.trust.manage'))))));
ALTER TABLE "access_role_revision" DROP CONSTRAINT "access_role_revision_count_check", ADD CONSTRAINT "access_role_revision_count_check" CHECK ("permission_count" between 0 and 89);

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
