SET search_path TO public;

CREATE TABLE "connected_installation" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"app_id" uuid NOT NULL,
	"owner_scope_id" uuid NOT NULL,
	"workload_principal_id" uuid NOT NULL,
	"version" bigint DEFAULT 0 NOT NULL,
	"credential_epoch" bigint DEFAULT 0 NOT NULL,
	"approved_revision" bigint,
	"state" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "connected_installation_version_check" CHECK ("version" between 0 and 9007199254740991 and "credential_epoch" between 0 and "version" and ("approved_revision" is null or "approved_revision" between 1 and "version")),
	CONSTRAINT "connected_installation_state_check" CHECK (("state"='draft' and "version"=0 and "credential_epoch"=0 and "approved_revision" is null) or
		("state" in ('pending','active','suspended','revoked') and "version">0 and "credential_epoch">0 and
		 ("state" not in ('active','suspended') or "approved_revision" is not null) and ("state"<>'pending' or "approved_revision" is null)))
);

CREATE TABLE "connected_installation_attribution" (
	"installation_id" uuid,
	"revision" bigint,
	"grant_id" uuid,
	"terms_revision" bigint NOT NULL,
	CONSTRAINT "connected_installation_attribution_pkey" PRIMARY KEY("installation_id","revision","grant_id")
);

CREATE TABLE "connected_installation_binding" (
	"installation_id" uuid,
	"revision" bigint,
	"binding_id" uuid,
	"terms_revision" bigint NOT NULL,
	CONSTRAINT "connected_installation_binding_pkey" PRIMARY KEY("installation_id","revision","binding_id")
);

CREATE TABLE "connected_installation_capability" (
	"installation_id" uuid,
	"revision" bigint,
	"family" text,
	"capability" text,
	CONSTRAINT "connected_installation_capability_pkey" PRIMARY KEY("installation_id","revision","family","capability"),
	CONSTRAINT "connected_installation_capability_registered_check" CHECK ((((("family"='api') and ("capability" in ('unit:read', 'unit:create', 'unit:update', 'account:read', 'account:update', 'access:read', 'access:manage', 'app:read', 'app:manage', 'interaction:read', 'interaction:write', 'realm:read', 'realm:manage', 'message:read', 'message:write', 'notification:read', 'notification:write', 'recommendation:read', 'recommendation:write', 'upload:read', 'upload:write', 'report:write')))) or ((("family"='unit') and ("capability" in ('unit.read', 'unit.update', 'unit.metadata-only.update', 'unit.status.update', 'unit.history.restore', 'unit.access.manage', 'unit.ownership.transfer', 'unit.association.manage', 'unit.tag-curation.manage', 'unit.reference-curation.manage', 'unit.realm-publication.manage', 'zone.pages.manage', 'zone.theme.manage', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate', 'entity.association.credit.request', 'entity.association.credit.direct', 'entity.association.subject.request', 'entity.association.subject.direct')))) or ((("family"='platform') and ("capability" in ('platform.access.read', 'platform.access.manage', 'platform.audit.read', 'platform.user.read', 'platform.user.status.update', 'platform.session.read', 'platform.session.revoke', 'entity.associations.override', 'catalog.definition.manage', 'unit.edit', 'platform.development_preview.access', 'platform.custom_theme.external_live.access', 'platform.custom_theme.external_live.access.manage', 'platform.custom_theme.review', 'platform.custom_theme.kill', 'unit.governance.read', 'unit.merge.propose', 'unit.merge.review', 'unit.merge', 'unit.ownership.override', 'unit.license.manage', 'unit.delete', 'unit.restore', 'unit.slug.manage', 'unit.slug.namespace.manage', 'unit.slug.redirect.release', 'platform.api_quota_policy.read', 'platform.api_quota_policy.update', 'platform.user.api_quota.read', 'platform.user.api_quota.update', 'platform.user.api_token.api_quota.read', 'platform.user.api_token.api_quota.update', 'platform.moderate', 'platform.suppress', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate')))) or ((("family"='management') and ("capability" in ('access.identity.select', 'access.role.read', 'access.role.create', 'access.role.update', 'access.role.activate', 'access.role.retire', 'access.role-binding.manage', 'access.assignment-ceiling.manage', 'app.read', 'app.create', 'app.update', 'app.disable', 'app.retire', 'app.trust.manage'))))))
);

CREATE TABLE "connected_installation_event" (
	"installation_id" uuid,
	"version" bigint,
	"operation_id" uuid NOT NULL,
	"request_digest" text NOT NULL,
	"operation" text NOT NULL,
	"state_after" text NOT NULL,
	"credential_epoch_after" bigint NOT NULL,
	"retained_approved_revision" bigint,
	"operator_auth_user_id" uuid NOT NULL,
	"authority_subject_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connected_installation_event_pkey" PRIMARY KEY("installation_id","version"),
	CONSTRAINT "connected_installation_event_version_check" CHECK ("version" between 1 and 9007199254740991 and "credential_epoch_after" between 1 and "version"),
	CONSTRAINT "connected_installation_event_digest_check" CHECK ("request_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "connected_installation_event_operation_check" CHECK ("operation" in ('prepare', 'approve', 'suspend', 'resume', 'revoke')),
	CONSTRAINT "connected_installation_event_state_check" CHECK ("state_after" in ('pending', 'active', 'suspended', 'revoked')),
	CONSTRAINT "connected_installation_event_approval_check" CHECK (("operation" in ('prepare','approve') and "retained_approved_revision" is null) or
		("operation" not in ('prepare','approve') and ("retained_approved_revision" is null or "retained_approved_revision" between 1 and "version"-1)))
);

CREATE TABLE "connected_installation_revision" (
	"installation_id" uuid,
	"revision" bigint,
	"app_id" uuid NOT NULL,
	"app_revision" bigint NOT NULL,
	"valid_from" timestamp(3) with time zone NOT NULL,
	"valid_until" timestamp(3) with time zone,
	"capability_count" integer NOT NULL,
	"capability_digest" text NOT NULL,
	"binding_count" integer NOT NULL,
	"binding_digest" text NOT NULL,
	"attribution_entity_id" uuid,
	"attribution_count" integer NOT NULL,
	"attribution_digest" text NOT NULL,
	"sealed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "connected_installation_revision_pkey" PRIMARY KEY("installation_id","revision"),
	CONSTRAINT "connected_installation_revision_time_check" CHECK (isfinite("valid_from") and ("valid_until" is null or (isfinite("valid_until") and "valid_until">"valid_from"))),
	CONSTRAINT "connected_installation_revision_counts_check" CHECK ("capability_count" between 0 and 111 and "binding_count" between 0 and 64 and
		(("attribution_entity_id" is null and "attribution_count"=0) or ("attribution_entity_id" is not null and "attribution_count" between 1 and 8))),
	CONSTRAINT "connected_installation_revision_digests_check" CHECK ("capability_digest" ~ '^[0-9a-f]{64}$' and "binding_digest" ~ '^[0-9a-f]{64}$' and "attribution_digest" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "connected_installation_app_key" ON "connected_installation" ("id","app_id");
CREATE UNIQUE INDEX "connected_installation_workload_key" ON "connected_installation" ("workload_principal_id");
CREATE UNIQUE INDEX "connected_installation_workload_app_key" ON "connected_installation" ("workload_principal_id","app_id");
CREATE INDEX "connected_installation_owner_idx" ON "connected_installation" ("owner_scope_id","id");
CREATE INDEX "connected_installation_app_idx" ON "connected_installation" ("app_id","id");
CREATE INDEX "connected_installation_attribution_source_idx" ON "connected_installation_attribution" ("grant_id","terms_revision","installation_id","revision");
CREATE INDEX "connected_installation_binding_source_idx" ON "connected_installation_binding" ("binding_id","terms_revision","installation_id","revision");
CREATE UNIQUE INDEX "connected_installation_event_operation_key" ON "connected_installation_event" ("installation_id","operation_id");
CREATE INDEX "connected_installation_revision_app_idx" ON "connected_installation_revision" ("app_id","app_revision","installation_id","revision");
ALTER TABLE "connected_app_client" ADD CONSTRAINT "connected_app_client_installation_fk" FOREIGN KEY ("workload_principal_id","app_id") REFERENCES "connected_installation"("workload_principal_id","app_id") ON DELETE RESTRICT;
ALTER TABLE "connected_installation" ADD CONSTRAINT "connected_installation_app_id_connected_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "connected_app"("id") ON DELETE RESTRICT;
ALTER TABLE "connected_installation" ADD CONSTRAINT "connected_installation_owner_scope_id_access_scope_id_fkey" FOREIGN KEY ("owner_scope_id") REFERENCES "access_scope"("id") ON DELETE RESTRICT;
ALTER TABLE "connected_installation" ADD CONSTRAINT "connected_installation_workload_scope_fk" FOREIGN KEY ("workload_principal_id","owner_scope_id") REFERENCES "workload_principal"("auth_user_id","owner_scope_id") ON DELETE RESTRICT;
ALTER TABLE "connected_installation" ADD CONSTRAINT "connected_installation_approval_fk" FOREIGN KEY ("id","approved_revision") REFERENCES "connected_installation_revision"("installation_id","revision") ON DELETE RESTRICT;
ALTER TABLE "connected_installation_attribution" ADD CONSTRAINT "connected_installation_attribution_revision_fk" FOREIGN KEY ("installation_id","revision") REFERENCES "connected_installation_revision"("installation_id","revision") ON DELETE RESTRICT;
ALTER TABLE "connected_installation_attribution" ADD CONSTRAINT "connected_installation_attribution_terms_fk" FOREIGN KEY ("grant_id","terms_revision") REFERENCES "access_representation_revision"("grant_id","revision") ON DELETE RESTRICT;
ALTER TABLE "connected_installation_binding" ADD CONSTRAINT "connected_installation_binding_revision_fk" FOREIGN KEY ("installation_id","revision") REFERENCES "connected_installation_revision"("installation_id","revision") ON DELETE RESTRICT;
ALTER TABLE "connected_installation_binding" ADD CONSTRAINT "connected_installation_binding_terms_fk" FOREIGN KEY ("binding_id","terms_revision") REFERENCES "access_role_binding_revision"("binding_id","revision") ON DELETE RESTRICT;
ALTER TABLE "connected_installation_capability" ADD CONSTRAINT "connected_installation_capability_revision_fk" FOREIGN KEY ("installation_id","revision") REFERENCES "connected_installation_revision"("installation_id","revision") ON DELETE RESTRICT;
ALTER TABLE "connected_installation_event" ADD CONSTRAINT "connected_installation_event_vk8iRDu0Z9d1_fkey" FOREIGN KEY ("installation_id") REFERENCES "connected_installation"("id") ON DELETE RESTRICT;
ALTER TABLE "connected_installation_event" ADD CONSTRAINT "connected_installation_event_50XdBLWHt9lQ_fkey" FOREIGN KEY ("operator_auth_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "connected_installation_event" ADD CONSTRAINT "connected_installation_event_88FD4HbeJzZY_fkey" FOREIGN KEY ("authority_subject_id") REFERENCES "access_subject"("id") ON DELETE RESTRICT;
ALTER TABLE "connected_installation_event" ADD CONSTRAINT "connected_installation_event_retained_approval_fk" FOREIGN KEY ("installation_id","retained_approved_revision") REFERENCES "connected_installation_revision"("installation_id","revision") ON DELETE RESTRICT;
ALTER TABLE "connected_installation_revision" ADD CONSTRAINT "connected_installation_revision_AwEiHf0pZZ73_fkey" FOREIGN KEY ("attribution_entity_id") REFERENCES "entity_identity"("id") ON DELETE RESTRICT;
ALTER TABLE "connected_installation_revision" ADD CONSTRAINT "connected_installation_revision_event_fk" FOREIGN KEY ("installation_id","revision") REFERENCES "connected_installation_event"("installation_id","version") ON DELETE RESTRICT;
ALTER TABLE "connected_installation_revision" ADD CONSTRAINT "connected_installation_revision_owner_fk" FOREIGN KEY ("installation_id","app_id") REFERENCES "connected_installation"("id","app_id") ON DELETE RESTRICT;
ALTER TABLE "connected_installation_revision" ADD CONSTRAINT "connected_installation_revision_app_fk" FOREIGN KEY ("app_id","app_revision") REFERENCES "connected_app_revision"("app_id","revision") ON DELETE RESTRICT;

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


CREATE OR REPLACE FUNCTION public.connected_app_client_terms_match_protocol(p_client uuid,p_revision bigint)
RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 SELECT a.revoked_at IS NULL AND t.protocol_credential_epoch=a.credential_epoch AND c.scopes IS NOT NULL
  AND ((h.kind='user' AND coalesce(cardinality(c.client_credentials_scopes),0)=0 AND NOT coalesce('client_credentials'=ANY(c.grant_types),false)) OR
   (h.kind='installation' AND c.client_discovery_id IS NULL AND c.grant_types=ARRAY['client_credentials']::text[]
    AND coalesce(c.token_endpoint_auth_method,'client_secret_basic') IN ('client_secret_basic','client_secret_post','private_key_jwt')))
  AND NOT EXISTS(SELECT 1 FROM unnest(c.scopes) s(value) WHERE s.value IS NULL OR NOT (
   (h.kind='user' AND (s.value='openid' OR (s.value='offline_access' AND t.offline_access))) OR
   EXISTS(SELECT 1 FROM public.connected_app_client_capability v WHERE v.client_id=h.client_id AND v.revision=t.revision AND v.family='api' AND v.capability=s.value)))
  AND NOT EXISTS(SELECT 1 FROM public.connected_app_client_capability v WHERE v.client_id=h.client_id AND v.revision=t.revision AND v.family='api' AND NOT(v.capability=ANY(c.scopes)))
  AND (h.kind='user' OR (NOT t.offline_access AND c.client_credentials_scopes IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM unnest(c.client_credentials_scopes) s(value) WHERE s.value IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.connected_app_client_capability v WHERE v.client_id=h.client_id AND v.revision=t.revision AND v.family='api' AND v.capability=s.value))
   AND NOT EXISTS(SELECT 1 FROM public.connected_app_client_capability v WHERE v.client_id=h.client_id AND v.revision=t.revision AND v.family='api' AND NOT(v.capability=ANY(c.client_credentials_scopes)))))
 FROM public.connected_app_client h JOIN public.connected_app_client_revision t ON t.client_id=h.client_id AND t.revision=p_revision
 JOIN public.oauth_client_authority a ON a.id=h.client_id JOIN public.oauth_client c ON c.id=a.id WHERE h.client_id=p_client
$$;

CREATE OR REPLACE FUNCTION public.guard_connected_app_client_head()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE event public.connected_app_client_event%ROWTYPE; protocol public.oauth_client%ROWTYPE; selected_revision bigint;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Client admissions and history are retained' USING ERRCODE='55000'; END IF;
 PERFORM id FROM public.oauth_client_authority WHERE id=NEW.client_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Protocol client control is missing' USING ERRCODE='23503'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.credential_epoch<>0 OR NEW.state<>'draft' OR NEW.terms_revision IS NOT NULL
  THEN RAISE EXCEPTION 'Client admission starts with an open identity' USING ERRCODE='23514'; END IF;
  SELECT * INTO protocol FROM public.oauth_client WHERE id=NEW.client_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Protocol client is missing' USING ERRCODE='23503'; END IF;
  IF protocol.client_discovery_id IS NULL AND protocol.reference_id IS DISTINCT FROM NEW.app_id::text
  THEN RAISE EXCEPTION 'Managed protocol client does not belong to this App' USING ERRCODE='23514'; END IF;
  IF NEW.kind='user' THEN
   IF coalesce(cardinality(protocol.client_credentials_scopes),0)>0 OR coalesce('client_credentials'=ANY(protocol.grant_types),false)
   THEN RAISE EXCEPTION 'User clients cannot acquire autonomous privileges' USING ERRCODE='23514'; END IF;
  ELSE
   IF protocol.client_discovery_id IS NOT NULL OR protocol.grant_types IS DISTINCT FROM ARRAY['client_credentials']::text[]
    OR coalesce(protocol.token_endpoint_auth_method,'client_secret_basic') NOT IN ('client_secret_basic','client_secret_post','private_key_jwt')
   THEN RAISE EXCEPTION 'Installation clients require managed confidential client credentials' USING ERRCODE='23514'; END IF;
   PERFORM w.auth_user_id FROM public.workload_principal w JOIN public.connected_installation i ON i.workload_principal_id=w.auth_user_id
    WHERE w.auth_user_id=NEW.workload_principal_id AND w.purpose='installation' AND i.app_id=NEW.app_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Installation client must name its installation workload' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.client_id,NEW.app_id,NEW.kind,NEW.workload_principal_id) IS DISTINCT FROM ROW(OLD.client_id,OLD.app_id,OLD.kind,OLD.workload_principal_id)
  OR OLD.state='revoked' OR NEW.version<>OLD.version+1
 THEN RAISE EXCEPTION 'Client admission identity and terminal revocation are immutable' USING ERRCODE='55000'; END IF;
 SELECT * INTO event FROM public.connected_app_client_event WHERE client_id=NEW.client_id AND version=NEW.version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Client change requires its receipt' USING ERRCODE='23514'; END IF;
 selected_revision:=CASE WHEN event.operation IN ('admit','revise') THEN event.version ELSE event.retained_terms_revision END;
 IF ROW(NEW.state,NEW.credential_epoch,NEW.terms_revision) IS DISTINCT FROM ROW(event.state_after,event.credential_epoch_after,selected_revision)
  OR NOT EXISTS(SELECT 1 FROM public.connected_app_client_revision WHERE client_id=NEW.client_id AND revision=selected_revision AND sealed)
 THEN RAISE EXCEPTION 'Client head must select its complete receipt and terms' USING ERRCODE='23514'; END IF;
 IF NEW.state='active' AND public.connected_app_client_terms_match_protocol(NEW.client_id,selected_revision) IS NOT TRUE
 THEN RAISE EXCEPTION 'Client terms no longer match current protocol policy' USING ERRCODE='23514'; END IF;
 IF NEW.state='active' AND OLD.state<>'active' THEN
  IF NOT EXISTS(SELECT 1 FROM public.connected_app WHERE id=NEW.app_id AND state='active' AND trust<>'blocked')
  THEN RAISE EXCEPTION 'Client activation requires an active App' USING ERRCODE='23514'; END IF;
  IF NEW.kind='installation' AND NOT EXISTS(SELECT 1 FROM public.workload_principal w JOIN public.connected_installation i ON i.workload_principal_id=w.auth_user_id
   WHERE w.auth_user_id=NEW.workload_principal_id AND w.state='active' AND w.purpose='installation' AND i.app_id=NEW.app_id AND i.state='active')
  THEN RAISE EXCEPTION 'Client activation requires its active installation workload' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_connected_app_client_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.connected_app_client%ROWTYPE; actor_id uuid; expected_state text; expected_epoch bigint;
BEGIN
 PERFORM id FROM public.oauth_client_authority WHERE id=NEW.client_id FOR UPDATE;
 SELECT * INTO head FROM public.connected_app_client WHERE client_id=NEW.client_id FOR UPDATE;
 IF NOT FOUND OR head.state='revoked' OR NEW.version<>head.version+1 THEN RAISE EXCEPTION 'Client receipt is stale or revoked' USING ERRCODE='23514'; END IF;
 SELECT auth_user_id INTO actor_id FROM public.access_subject WHERE id=NEW.authority_subject_id;
 IF NOT FOUND OR (actor_id IS NOT NULL AND actor_id<>NEW.operator_auth_user_id)
 THEN RAISE EXCEPTION 'Client authority subject does not match its operator' USING ERRCODE='23514'; END IF;
 expected_state:=head.state; expected_epoch:=head.credential_epoch;
 IF NEW.operation='admit' THEN
  IF head.version<>0 THEN RAISE EXCEPTION 'Client is already admitted' USING ERRCODE='23514'; END IF;
  expected_state:=CASE WHEN head.kind='user' THEN 'active' ELSE 'disabled' END; expected_epoch:=1;
 ELSE
  IF head.version=0 THEN RAISE EXCEPTION 'Client admission is incomplete' USING ERRCODE='23514'; END IF;
  IF NEW.operation='disable' THEN
   IF head.state<>'active' THEN RAISE EXCEPTION 'Only an active client can be disabled' USING ERRCODE='23514'; END IF;
   expected_state:='disabled'; expected_epoch:=expected_epoch+1;
  ELSIF NEW.operation='enable' THEN
   IF head.state<>'disabled' THEN RAISE EXCEPTION 'Only a disabled client can be enabled' USING ERRCODE='23514'; END IF;
   expected_state:='active';
  ELSIF NEW.operation='revoke' THEN expected_state:='revoked'; expected_epoch:=expected_epoch+1;
  END IF;
 END IF;
 IF ROW(NEW.state_after,NEW.credential_epoch_after) IS DISTINCT FROM ROW(expected_state,expected_epoch)
  OR (NEW.operation NOT IN ('admit','revise') AND NEW.retained_terms_revision IS DISTINCT FROM head.terms_revision)
 THEN RAISE EXCEPTION 'Client lifecycle does not match its operation' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_connected_app_client_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE parent public.connected_app_revision%ROWTYPE; amount integer; digest text;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Client terms are retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.sealed OR NOT EXISTS(SELECT 1 FROM public.connected_app_client_event WHERE client_id=NEW.client_id AND version=NEW.revision AND operation IN ('admit','revise'))
  THEN RAISE EXCEPTION 'Client terms require their open receipt' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.sealed OR NOT NEW.sealed OR ROW(NEW.client_id,NEW.revision,NEW.app_id,NEW.app_revision,NEW.protocol_credential_epoch,NEW.offline_access,NEW.entity_disclosure,NEW.capability_count,NEW.capability_digest)
  IS DISTINCT FROM ROW(OLD.client_id,OLD.revision,OLD.app_id,OLD.app_revision,OLD.protocol_credential_epoch,OLD.offline_access,OLD.entity_disclosure,OLD.capability_count,OLD.capability_digest)
 THEN RAISE EXCEPTION 'Client terms can only be sealed once' USING ERRCODE='55000'; END IF;
 SELECT * INTO parent FROM public.connected_app_revision WHERE app_id=NEW.app_id AND revision=NEW.app_revision AND sealed;
 IF NOT FOUND OR (NEW.offline_access AND NOT parent.offline_access) OR (NEW.entity_disclosure AND NOT parent.entity_disclosure)
 THEN RAISE EXCEPTION 'Client terms exceed the selected App declaration' USING ERRCODE='23514'; END IF;
 SELECT count(*)::integer,encode(sha256(convert_to(coalesce(string_agg(family||':'||capability,E'\n' ORDER BY family COLLATE "C",capability COLLATE "C"),''),'UTF8')),'hex')
 INTO amount,digest FROM public.connected_app_client_capability WHERE client_id=NEW.client_id AND revision=NEW.revision;
 IF amount<>NEW.capability_count OR digest<>NEW.capability_digest OR EXISTS(
  SELECT 1 FROM public.connected_app_client_capability v WHERE v.client_id=NEW.client_id AND v.revision=NEW.revision AND NOT EXISTS(
   SELECT 1 FROM public.connected_app_capability a WHERE a.app_id=NEW.app_id AND a.revision=NEW.app_revision AND a.family=v.family AND a.capability=v.capability))
 THEN RAISE EXCEPTION 'Client capability snapshot is incomplete or exceeds the App declaration' USING ERRCODE='23514'; END IF;
 IF public.connected_app_client_terms_match_protocol(NEW.client_id,NEW.revision) IS NOT TRUE
 THEN RAISE EXCEPTION 'Client capability snapshot does not match protocol limits' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_connected_app_client_capability()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE is_sealed boolean;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Client capability history is immutable' USING ERRCODE='55000'; END IF;
 SELECT sealed INTO is_sealed FROM public.connected_app_client_revision WHERE client_id=NEW.client_id AND revision=NEW.revision FOR UPDATE;
 IF NOT FOUND OR is_sealed THEN RAISE EXCEPTION 'Client capability requires open terms' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.complete_connected_app_client()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.connected_app_client%ROWTYPE; event public.connected_app_client_event%ROWTYPE;
BEGIN
 SELECT * INTO head FROM public.connected_app_client WHERE client_id=NEW.client_id;
 IF NOT FOUND OR head.version=0 THEN RAISE EXCEPTION 'Client admission must complete its first terms' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='connected_app_client_event' THEN
  IF head.version<NEW.version THEN RAISE EXCEPTION 'Client receipt must advance its head' USING ERRCODE='23514'; END IF;
  IF NEW.operation IN ('admit','revise') AND NOT EXISTS(SELECT 1 FROM public.connected_app_client_revision WHERE client_id=NEW.client_id AND revision=NEW.version AND sealed)
  THEN RAISE EXCEPTION 'Client receipt must seal its terms' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='connected_app_client_revision' THEN
  IF NOT EXISTS(SELECT 1 FROM public.connected_app_client_revision WHERE client_id=NEW.client_id AND revision=NEW.revision AND sealed)
  THEN RAISE EXCEPTION 'Client terms must be sealed before commit' USING ERRCODE='23514'; END IF;
 ELSIF NEW.version>0 THEN
  SELECT * INTO event FROM public.connected_app_client_event WHERE client_id=NEW.client_id AND version=NEW.version;
  IF NOT FOUND OR ROW(NEW.state,NEW.credential_epoch,NEW.terms_revision) IS DISTINCT FROM
   ROW(event.state_after,event.credential_epoch_after,CASE WHEN event.operation IN ('admit','revise') THEN event.version ELSE event.retained_terms_revision END)
  THEN RAISE EXCEPTION 'Client history must preserve every transition' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS connected_app_client_head_guard ON public.connected_app_client;
CREATE TRIGGER connected_app_client_head_guard BEFORE INSERT OR UPDATE OR DELETE ON public.connected_app_client FOR EACH ROW EXECUTE FUNCTION public.guard_connected_app_client_head();
DROP TRIGGER IF EXISTS connected_app_client_event_guard ON public.connected_app_client_event;
CREATE TRIGGER connected_app_client_event_guard BEFORE INSERT ON public.connected_app_client_event FOR EACH ROW EXECUTE FUNCTION public.guard_connected_app_client_event();
DROP TRIGGER IF EXISTS connected_app_client_event_immutable ON public.connected_app_client_event;
CREATE TRIGGER connected_app_client_event_immutable BEFORE UPDATE OR DELETE ON public.connected_app_client_event FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
DROP TRIGGER IF EXISTS connected_app_client_revision_guard ON public.connected_app_client_revision;
CREATE TRIGGER connected_app_client_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON public.connected_app_client_revision FOR EACH ROW EXECUTE FUNCTION public.guard_connected_app_client_revision();
DROP TRIGGER IF EXISTS connected_app_client_capability_guard ON public.connected_app_client_capability;
CREATE TRIGGER connected_app_client_capability_guard BEFORE INSERT OR UPDATE OR DELETE ON public.connected_app_client_capability FOR EACH ROW EXECUTE FUNCTION public.guard_connected_app_client_capability();
DROP TRIGGER IF EXISTS connected_app_client_head_complete ON public.connected_app_client;
CREATE CONSTRAINT TRIGGER connected_app_client_head_complete AFTER INSERT OR UPDATE ON public.connected_app_client DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_connected_app_client();
DROP TRIGGER IF EXISTS connected_app_client_event_complete ON public.connected_app_client_event;
CREATE CONSTRAINT TRIGGER connected_app_client_event_complete AFTER INSERT ON public.connected_app_client_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_connected_app_client();
DROP TRIGGER IF EXISTS connected_app_client_revision_complete ON public.connected_app_client_revision;
CREATE CONSTRAINT TRIGGER connected_app_client_revision_complete AFTER INSERT OR UPDATE ON public.connected_app_client_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_connected_app_client();


CREATE OR REPLACE FUNCTION public.access_principal_account_is_eligible(p_principal uuid,p_action text)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 WITH evaluated AS MATERIALIZED(SELECT clock_timestamp() AS now)
 SELECT CASE WHEN p_action IS NULL OR p_action NOT IN ('read','write','contribute') THEN NULL
  ELSE EXISTS(
   SELECT 1 FROM public.users u CROSS JOIN evaluated WHERE u.id=p_principal AND u.erased_at IS NULL
    AND NOT EXISTS(SELECT 1 FROM public.user_account_state a WHERE a.user_id=u.id AND
     (a.state='closed' OR (a.state='suspended' AND (a.expires_at IS NULL OR NOT isfinite(a.expires_at) OR a.expires_at>evaluated.now))))
    AND (p_action='read' OR NOT EXISTS(SELECT 1 FROM public.account_enforcement e WHERE e.auth_user_id=u.id AND e.revocation_action_id IS NULL
     AND (e.kind IN ('ban','suspension') OR (p_action='contribute' AND e.kind='silence'))
     AND (NOT isfinite(e.starts_at) OR (e.expires_at IS NOT NULL AND NOT isfinite(e.expires_at)) OR
      (e.starts_at<=evaluated.now AND (e.expires_at IS NULL OR e.expires_at>evaluated.now)))))
  ) END
$$;

CREATE OR REPLACE FUNCTION public.connected_app_is_eligible(p_app uuid)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.connected_app app JOIN public.access_scope s ON s.id=app.scope_id
  LEFT JOIN public.users a ON a.id=s.auth_user_id LEFT JOIN public.workload_principal w ON w.auth_user_id=a.id
  LEFT JOIN public.access_scope ws ON ws.id=w.owner_scope_id
  LEFT JOIN public.reference_value r ON r.id=s.unit_ref LEFT JOIN public.entity_identity e ON e.id=r.target_entity_id
  LEFT JOIN public.entity_participation ep ON ep.entity_id=e.id
  WHERE app.id=p_app AND app.state='active' AND app.trust<>'blocked' AND (
   (a.principal_kind='human' AND public.access_principal_account_is_eligible(a.id,'read') IS TRUE) OR
   (a.principal_kind='service' AND w.purpose='system' AND w.state='active' AND ws.platform_root='platform'
    AND public.access_principal_account_is_eligible(a.id,'read') IS TRUE) OR
   (e.id IS NOT NULL AND e.deleted_at IS NULL AND ep.state='active')))
$$;

CREATE OR REPLACE FUNCTION public.connected_installation_is_eligible(p_installation uuid)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 WITH evaluated AS MATERIALIZED(SELECT clock_timestamp() AS now)
 SELECT EXISTS(SELECT 1 FROM public.connected_installation i JOIN public.connected_installation_revision r
  ON r.installation_id=i.id AND r.revision=i.approved_revision CROSS JOIN evaluated
  WHERE i.id=p_installation AND i.state='active' AND r.sealed AND r.valid_from<=evaluated.now
   AND (r.valid_until IS NULL OR r.valid_until>evaluated.now) AND public.connected_app_is_eligible(i.app_id) IS TRUE)
$$;

CREATE OR REPLACE FUNCTION public.workload_principal_is_eligible(p_principal uuid,p_action text)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 SELECT CASE WHEN p_action IS NULL OR p_action NOT IN ('read','write','contribute') THEN NULL ELSE EXISTS(
  SELECT 1 FROM public.workload_principal w JOIN public.access_scope s ON s.id=w.owner_scope_id
   LEFT JOIN public.reference_value r ON r.id=s.unit_ref LEFT JOIN public.users a ON a.id=s.auth_user_id
   LEFT JOIN public.entity_identity e ON e.id=r.target_entity_id LEFT JOIN public.entity_participation ep ON ep.entity_id=e.id
   LEFT JOIN public.realm realm ON realm.id=r.target_realm_id
  WHERE w.auth_user_id=p_principal AND w.state='active' AND w.version>0 AND (
   (w.purpose='system' AND s.platform_root='platform') OR (w.purpose='installation' AND EXISTS(
    SELECT 1 FROM public.connected_installation i WHERE i.workload_principal_id=w.auth_user_id AND i.owner_scope_id=w.owner_scope_id
     AND public.connected_installation_is_eligible(i.id) IS TRUE) AND (
    (a.principal_kind='human' AND public.access_principal_account_is_eligible(a.id,p_action) IS TRUE) OR
    (e.shape='organization' AND e.deleted_at IS NULL AND ep.state='active') OR
    (realm.id IS NOT NULL AND realm.deleted_at IS NULL)
   )))) END
$$;

CREATE OR REPLACE FUNCTION public.access_subject_is_eligible(p_subject uuid,p_action text)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 SELECT CASE WHEN p_action IS NULL OR p_action NOT IN ('read','write','contribute') THEN NULL
  WHEN s.auth_user_id IS NOT NULL THEN EXISTS(SELECT 1 FROM public.users u WHERE u.id=s.auth_user_id
   AND public.access_principal_account_is_eligible(u.id,p_action) IS TRUE
   AND (u.principal_kind='human' OR (u.principal_kind='service' AND public.workload_principal_is_eligible(u.id,p_action) IS TRUE)))
  ELSE EXISTS(SELECT 1 FROM public.entity_identity e JOIN public.entity_participation p ON p.entity_id=e.id
   WHERE e.id=s.entity_id AND e.deleted_at IS NULL AND p.state='active') END
 FROM public.access_subject s WHERE s.id=p_subject
$$;

CREATE OR REPLACE FUNCTION public.access_subject_matches_recipient(p_subject uuid,p_kind text,p_recipient uuid,p_scope uuid,p_group uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE member public.access_membership%ROWTYPE; selected_count integer; matched boolean; broken boolean;
BEGIN
 IF p_subject IS NULL OR p_kind IS NULL THEN RETURN NULL; END IF;
 IF p_kind='subject' THEN RETURN p_subject=p_recipient; END IF;
 IF p_kind NOT IN ('group','all-members') OR p_scope IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO member FROM public.access_membership WHERE subject_id=p_subject AND scope_id=p_scope;
 IF NOT FOUND OR member.active_generation IS NULL THEN RETURN false; END IF;
 IF p_kind='all-members' THEN RETURN true; END IF;
 IF p_group IS NULL OR NOT EXISTS(SELECT 1 FROM public.access_group_membership_set WHERE membership_id=member.id AND generation=member.active_generation) THEN RETURN NULL; END IF;
 SELECT count(*) INTO selected_count FROM (SELECT 1 FROM public.access_group_membership WHERE membership_id=member.id AND generation=member.active_generation AND selected LIMIT 65) selected;
 IF selected_count>64 THEN RETURN NULL; END IF;
 WITH RECURSIVE path(direct_id,id,parent_id,state,version,depth) AS (
  SELECT g.id,g.id,g.parent_id,g.state,g.version,1 FROM public.access_group_membership selected
   JOIN public.access_group g ON g.id=selected.group_id AND g.scope_id=selected.scope_id
   WHERE selected.membership_id=member.id AND selected.generation=member.active_generation AND selected.selected
  UNION ALL SELECT p.direct_id,g.id,g.parent_id,g.state,g.version,p.depth+1 FROM path p
   JOIN public.access_group g ON g.id=p.parent_id AND g.scope_id=p_scope WHERE p.state='active' AND p.depth<8
 ) SELECT coalesce(bool_or(id=p_group AND state='active' AND version>0),false),
  coalesce(bool_or(version=0 OR (state='active' AND depth=8 AND parent_id IS NOT NULL)),false) INTO matched,broken FROM path;
 IF broken THEN RETURN NULL; END IF;
 RETURN matched;
END $$;

CREATE OR REPLACE FUNCTION public.access_representation_path_is_current(p_grants uuid[],p_revisions bigint[],p_principal uuid,p_entity uuid,p_action text)
RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE step integer; head public.access_representation%ROWTYPE; terms public.access_representation_revision%ROWTYPE; next_subject uuid; owner_subject uuid; next_entity uuid; visited uuid[]:=array[]::uuid[];
BEGIN
 IF p_grants IS NULL OR p_revisions IS NULL OR cardinality(p_grants) NOT BETWEEN 1 AND 8 OR cardinality(p_grants)<>cardinality(p_revisions)
  OR coalesce(array_ndims(p_grants),1)<>1 OR coalesce(array_ndims(p_revisions),1)<>1 OR array_lower(p_grants,1)<>1 OR array_lower(p_revisions,1)<>1
  OR array_position(p_grants,NULL) IS NOT NULL OR array_position(p_revisions,NULL) IS NOT NULL THEN RETURN NULL; END IF;
 IF cardinality(p_grants)<>(SELECT count(DISTINCT value) FROM unnest(p_grants) value) THEN RETURN false; END IF;
 IF public.access_subject_is_eligible(p_principal,p_action) IS DISTINCT FROM true THEN RETURN false; END IF;
 next_entity:=p_entity;
 FOR step IN 1..cardinality(p_grants) LOOP
  SELECT * INTO head FROM public.access_representation WHERE id=p_grants[step];
  IF NOT FOUND OR head.entity_id IS DISTINCT FROM next_entity OR public.access_representation_is_current(head.id,p_revisions[step]) IS DISTINCT FROM true THEN RETURN false; END IF;
  IF head.entity_id=ANY(visited) THEN RETURN false; END IF;
  visited:=array_append(visited,head.entity_id);
  SELECT * INTO terms FROM public.access_representation_revision WHERE grant_id=head.id AND revision=p_revisions[step] AND sealed;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT id INTO owner_subject FROM public.access_subject WHERE entity_id=head.entity_id;
  IF public.access_subject_is_eligible(owner_subject,p_action) IS DISTINCT FROM true THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM public.access_representation_lineage(head.id,p_revisions[step]) l
   JOIN public.access_representation g ON g.id=l.grant_id WHERE g.parent_subject_id IS NOT NULL
    AND public.access_subject_is_eligible(g.parent_subject_id,p_action) IS DISTINCT FROM true) THEN RETURN false; END IF;
  IF step=cardinality(p_grants) THEN next_subject:=p_principal;
  ELSE
   IF NOT terms.can_redelegate THEN RETURN false; END IF;
   SELECT entity_id INTO next_entity FROM public.access_representation WHERE id=p_grants[step+1];
   SELECT id INTO next_subject FROM public.access_subject WHERE entity_id=next_entity;
   IF next_subject IS NULL THEN RETURN false; END IF;
  END IF;
  IF public.access_subject_matches_recipient(next_subject,head.recipient_kind,head.recipient_subject_id,head.recipient_scope_id,head.recipient_group_id) IS DISTINCT FROM true THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END $$;
