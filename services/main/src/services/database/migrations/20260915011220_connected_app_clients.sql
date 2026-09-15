SET search_path TO public;

CREATE TABLE "connected_app_client" (
	"client_id" uuid PRIMARY KEY,
	"app_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"workload_principal_id" uuid,
	"version" bigint DEFAULT 0 NOT NULL,
	"terms_revision" bigint,
	"credential_epoch" bigint DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "connected_app_client_kind_check" CHECK (("kind"='user' and "workload_principal_id" is null) or ("kind"='installation' and "workload_principal_id" is not null)),
	CONSTRAINT "connected_app_client_version_check" CHECK ("version" between 0 and 9007199254740991 and "credential_epoch" between 0 and "version" and ("terms_revision" is null or "terms_revision" between 1 and "version")),
	CONSTRAINT "connected_app_client_state_check" CHECK (("state"='draft' and "version"=0 and "credential_epoch"=0 and "terms_revision" is null) or ("state" in ('active','disabled','revoked') and "version">0 and "credential_epoch">0 and "terms_revision" is not null))
);

CREATE TABLE "connected_app_client_capability" (
	"client_id" uuid,
	"revision" bigint,
	"family" text,
	"capability" text,
	CONSTRAINT "connected_app_client_capability_pkey" PRIMARY KEY("client_id","revision","family","capability"),
	CONSTRAINT "connected_app_client_capability_registered_check" CHECK ((((("family"='api') and ("capability" in ('unit:read', 'unit:create', 'unit:update', 'account:read', 'account:update', 'access:read', 'access:manage', 'app:read', 'app:manage', 'interaction:read', 'interaction:write', 'realm:read', 'realm:manage', 'message:read', 'message:write', 'notification:read', 'notification:write', 'recommendation:read', 'recommendation:write', 'upload:read', 'upload:write', 'report:write')))) or ((("family"='unit') and ("capability" in ('unit.read', 'unit.update', 'unit.metadata-only.update', 'unit.status.update', 'unit.history.restore', 'unit.access.manage', 'unit.ownership.transfer', 'unit.association.manage', 'unit.tag-curation.manage', 'unit.reference-curation.manage', 'unit.realm-publication.manage', 'zone.pages.manage', 'zone.theme.manage', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate', 'entity.association.credit.request', 'entity.association.credit.direct', 'entity.association.subject.request', 'entity.association.subject.direct')))) or ((("family"='platform') and ("capability" in ('platform.access.read', 'platform.access.manage', 'platform.audit.read', 'platform.user.read', 'platform.user.status.update', 'platform.session.read', 'platform.session.revoke', 'entity.associations.override', 'catalog.definition.manage', 'unit.edit', 'platform.development_preview.access', 'platform.custom_theme.external_live.access', 'platform.custom_theme.external_live.access.manage', 'platform.custom_theme.review', 'platform.custom_theme.kill', 'unit.governance.read', 'unit.merge.propose', 'unit.merge.review', 'unit.merge', 'unit.ownership.override', 'unit.license.manage', 'unit.delete', 'unit.restore', 'unit.slug.manage', 'unit.slug.namespace.manage', 'unit.slug.redirect.release', 'platform.api_quota_policy.read', 'platform.api_quota_policy.update', 'platform.user.api_quota.read', 'platform.user.api_quota.update', 'platform.user.api_token.api_quota.read', 'platform.user.api_token.api_quota.update', 'platform.moderate', 'platform.suppress', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate')))) or ((("family"='management') and ("capability" in ('access.identity.select', 'access.role.read', 'access.role.create', 'access.role.update', 'access.role.activate', 'access.role.retire', 'access.role-binding.manage', 'access.assignment-ceiling.manage', 'app.read', 'app.create', 'app.update', 'app.disable', 'app.retire', 'app.trust.manage'))))))
);

CREATE TABLE "connected_app_client_event" (
	"client_id" uuid,
	"version" bigint,
	"operation_id" uuid NOT NULL,
	"request_digest" text NOT NULL,
	"operation" text NOT NULL,
	"state_after" text NOT NULL,
	"credential_epoch_after" bigint NOT NULL,
	"retained_terms_revision" bigint,
	"operator_auth_user_id" uuid NOT NULL,
	"authority_subject_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connected_app_client_event_pkey" PRIMARY KEY("client_id","version"),
	CONSTRAINT "connected_app_client_event_version_check" CHECK ("version" between 1 and 9007199254740991 and "credential_epoch_after" between 1 and "version"),
	CONSTRAINT "connected_app_client_event_digest_check" CHECK ("request_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "connected_app_client_event_operation_check" CHECK ("operation" in ('admit', 'revise', 'disable', 'enable', 'revoke')),
	CONSTRAINT "connected_app_client_event_state_check" CHECK ("state_after" in ('active', 'disabled', 'revoked')),
	CONSTRAINT "connected_app_client_event_terms_check" CHECK (("operation" in ('admit','revise') and "retained_terms_revision" is null) or ("operation" not in ('admit','revise') and "retained_terms_revision" is not null and "retained_terms_revision" between 1 and "version"-1))
);

CREATE TABLE "connected_app_client_revision" (
	"client_id" uuid,
	"revision" bigint,
	"app_id" uuid NOT NULL,
	"app_revision" bigint NOT NULL,
	"protocol_credential_epoch" bigint NOT NULL,
	"offline_access" boolean NOT NULL,
	"entity_disclosure" boolean NOT NULL,
	"capability_count" integer NOT NULL,
	"capability_digest" text NOT NULL,
	"sealed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "connected_app_client_revision_pkey" PRIMARY KEY("client_id","revision"),
	CONSTRAINT "connected_app_client_revision_epoch_check" CHECK ("protocol_credential_epoch" between 0 and 9007199254740991),
	CONSTRAINT "connected_app_client_revision_count_check" CHECK ("capability_count" between 0 and 111),
	CONSTRAINT "connected_app_client_revision_digest_check" CHECK ("capability_digest" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "connected_app_client_app_key" ON "connected_app_client" ("client_id","app_id");
CREATE INDEX "connected_app_client_app_idx" ON "connected_app_client" ("app_id","client_id");
CREATE INDEX "connected_app_client_workload_idx" ON "connected_app_client" ("workload_principal_id","client_id") WHERE "workload_principal_id" is not null;
CREATE UNIQUE INDEX "connected_app_client_active_workload_key" ON "connected_app_client" ("workload_principal_id") WHERE "workload_principal_id" is not null and "state"='active';
CREATE UNIQUE INDEX "connected_app_client_event_operation_key" ON "connected_app_client_event" ("client_id","operation_id");
CREATE INDEX "connected_app_client_revision_app_idx" ON "connected_app_client_revision" ("app_id","app_revision","client_id","revision");
ALTER TABLE "connected_app_client" ADD CONSTRAINT "connected_app_client_client_id_oauth_client_authority_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_client_authority"("id") ON DELETE RESTRICT;
ALTER TABLE "connected_app_client" ADD CONSTRAINT "connected_app_client_app_id_connected_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "connected_app"("id") ON DELETE RESTRICT;
ALTER TABLE "connected_app_client" ADD CONSTRAINT "connected_app_client_HikZiGQqXI64_fkey" FOREIGN KEY ("workload_principal_id") REFERENCES "workload_principal"("auth_user_id") ON DELETE RESTRICT;
ALTER TABLE "connected_app_client" ADD CONSTRAINT "connected_app_client_terms_fk" FOREIGN KEY ("client_id","terms_revision") REFERENCES "connected_app_client_revision"("client_id","revision") ON DELETE RESTRICT;
ALTER TABLE "connected_app_client_capability" ADD CONSTRAINT "connected_app_client_capability_revision_fk" FOREIGN KEY ("client_id","revision") REFERENCES "connected_app_client_revision"("client_id","revision") ON DELETE RESTRICT;
ALTER TABLE "connected_app_client_event" ADD CONSTRAINT "connected_app_client_event_HVSo9zoaH0rW_fkey" FOREIGN KEY ("client_id") REFERENCES "connected_app_client"("client_id") ON DELETE RESTRICT;
ALTER TABLE "connected_app_client_event" ADD CONSTRAINT "connected_app_client_event_operator_auth_user_id_users_id_fkey" FOREIGN KEY ("operator_auth_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "connected_app_client_event" ADD CONSTRAINT "connected_app_client_event_Yp7qguT0h2fx_fkey" FOREIGN KEY ("authority_subject_id") REFERENCES "access_subject"("id") ON DELETE RESTRICT;
ALTER TABLE "connected_app_client_event" ADD CONSTRAINT "connected_app_client_event_retained_terms_fk" FOREIGN KEY ("client_id","retained_terms_revision") REFERENCES "connected_app_client_revision"("client_id","revision") ON DELETE RESTRICT;
ALTER TABLE "connected_app_client_revision" ADD CONSTRAINT "connected_app_client_revision_event_fk" FOREIGN KEY ("client_id","revision") REFERENCES "connected_app_client_event"("client_id","version") ON DELETE RESTRICT;
ALTER TABLE "connected_app_client_revision" ADD CONSTRAINT "connected_app_client_revision_owner_fk" FOREIGN KEY ("client_id","app_id") REFERENCES "connected_app_client"("client_id","app_id") ON DELETE RESTRICT;
ALTER TABLE "connected_app_client_revision" ADD CONSTRAINT "connected_app_client_revision_app_fk" FOREIGN KEY ("app_id","app_revision") REFERENCES "connected_app_revision"("app_id","revision") ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.guard_connected_app_head()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE event public.connected_app_event%ROWTYPE; selected_revision bigint;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'App identities and history are retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.authority_epoch<>0 OR NEW.state<>'draft' OR NEW.trust<>'unreviewed' OR NEW.declared_revision IS NOT NULL
  THEN RAISE EXCEPTION 'App admission starts with an unapproved empty identity' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.access_scope s LEFT JOIN public.reference_value r ON r.id=s.unit_ref
   LEFT JOIN public.users u ON u.id=s.auth_user_id LEFT JOIN public.workload_principal w ON w.auth_user_id=u.id
   WHERE s.id=NEW.scope_id AND (u.principal_kind='human' OR (u.principal_kind='service' AND w.purpose='system') OR r.target_entity_id IS NOT NULL))
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
   PERFORM auth_user_id FROM public.workload_principal WHERE auth_user_id=NEW.workload_principal_id AND purpose='installation';
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
  IF NEW.kind='installation' AND NOT EXISTS(SELECT 1 FROM public.workload_principal WHERE auth_user_id=NEW.workload_principal_id AND state='active' AND purpose='installation')
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
