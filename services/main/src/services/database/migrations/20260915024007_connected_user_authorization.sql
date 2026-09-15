SET search_path TO public;

CREATE TABLE "connected_user_connection" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"auth_user_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"version" bigint DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "connected_user_connection_version_check" CHECK ("version" between 0 and 9007199254740991),
	CONSTRAINT "connected_user_connection_state_check" CHECK (("state"='draft' and "version"=0) or ("state" in ('active','disconnected') and "version">0))
);

CREATE TABLE "connected_user_connection_event" (
	"connection_id" uuid,
	"version" bigint,
	"operation_id" uuid NOT NULL,
	"request_digest" text NOT NULL,
	"operation" text NOT NULL,
	"state_after" text NOT NULL,
	"operator_auth_user_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connected_user_connection_event_pkey" PRIMARY KEY("connection_id","version"),
	CONSTRAINT "connected_user_connection_event_version_check" CHECK ("version" between 1 and 9007199254740991),
	CONSTRAINT "connected_user_connection_event_digest_check" CHECK ("request_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "connected_user_connection_event_operation_check" CHECK (("operation"='connect' and "state_after"='active') or ("operation"='disconnect' and "state_after"='disconnected'))
);

CREATE TABLE "connected_user_consent" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"connection_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"version" bigint DEFAULT 0 NOT NULL,
	"terms_revision" bigint,
	"state" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "connected_user_consent_version_check" CHECK ("version" between 0 and 9007199254740991 and ("terms_revision" is null or "terms_revision" between 1 and "version")),
	CONSTRAINT "connected_user_consent_state_check" CHECK (("state"='draft' and "version"=0 and "terms_revision" is null) or ("state" in ('active','revoked') and "version">0 and "terms_revision" is not null) or ("state"='erasing' and "version">0 and "terms_revision" is null))
);

CREATE TABLE "connected_user_consent_capability" (
	"consent_id" uuid,
	"revision" bigint,
	"family" text,
	"capability" text,
	CONSTRAINT "connected_user_consent_capability_pkey" PRIMARY KEY("consent_id","revision","family","capability"),
	CONSTRAINT "connected_user_consent_capability_registered_check" CHECK ((((("family"='api') and ("capability" in ('unit:read', 'unit:create', 'unit:update', 'account:read', 'account:update', 'access:read', 'access:manage', 'app:read', 'app:manage', 'interaction:read', 'interaction:write', 'realm:read', 'realm:manage', 'message:read', 'message:write', 'notification:read', 'notification:write', 'recommendation:read', 'recommendation:write', 'upload:read', 'upload:write', 'report:write')))) or ((("family"='unit') and ("capability" in ('unit.read', 'unit.update', 'unit.metadata-only.update', 'unit.status.update', 'unit.history.restore', 'unit.access.manage', 'unit.ownership.transfer', 'unit.association.manage', 'unit.tag-curation.manage', 'unit.reference-curation.manage', 'unit.realm-publication.manage', 'zone.pages.manage', 'zone.theme.manage', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate', 'entity.association.credit.request', 'entity.association.credit.direct', 'entity.association.subject.request', 'entity.association.subject.direct')))) or ((("family"='platform') and ("capability" in ('platform.access.read', 'platform.access.manage', 'platform.audit.read', 'platform.user.read', 'platform.user.status.update', 'platform.session.read', 'platform.session.revoke', 'entity.associations.override', 'catalog.definition.manage', 'unit.edit', 'platform.development_preview.access', 'platform.custom_theme.external_live.access', 'platform.custom_theme.external_live.access.manage', 'platform.custom_theme.review', 'platform.custom_theme.kill', 'unit.governance.read', 'unit.merge.propose', 'unit.merge.review', 'unit.merge', 'unit.ownership.override', 'unit.license.manage', 'unit.delete', 'unit.restore', 'unit.slug.manage', 'unit.slug.namespace.manage', 'unit.slug.redirect.release', 'platform.api_quota_policy.read', 'platform.api_quota_policy.update', 'platform.user.api_quota.read', 'platform.user.api_quota.update', 'platform.user.api_token.api_quota.read', 'platform.user.api_token.api_quota.update', 'platform.moderate', 'platform.suppress', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate')))) or ((("family"='management') and ("capability" in ('access.identity.select', 'access.role.read', 'access.role.create', 'access.role.update', 'access.role.activate', 'access.role.retire', 'access.role-binding.manage', 'access.assignment-ceiling.manage', 'app.read', 'app.create', 'app.update', 'app.disable', 'app.retire', 'app.trust.manage'))))))
);

CREATE TABLE "connected_user_consent_event" (
	"consent_id" uuid,
	"version" bigint,
	"operation_id" uuid NOT NULL,
	"request_digest" text NOT NULL,
	"operation" text NOT NULL,
	"state_after" text NOT NULL,
	"retained_terms_revision" bigint,
	"operator_auth_user_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connected_user_consent_event_pkey" PRIMARY KEY("consent_id","version"),
	CONSTRAINT "connected_user_consent_event_version_check" CHECK ("version" between 1 and 9007199254740991),
	CONSTRAINT "connected_user_consent_event_digest_check" CHECK ("request_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "connected_user_consent_event_operation_check" CHECK (("operation"='revoke' and "state_after"='revoked' and "retained_terms_revision" is not null and "retained_terms_revision" between 1 and "version"-1) or
		("operation" in ('grant','revise') and "state_after"='active' and "retained_terms_revision" is null))
);

CREATE TABLE "connected_user_consent_representation" (
	"consent_id" uuid,
	"revision" bigint,
	"grant_id" uuid,
	"terms_revision" bigint NOT NULL,
	CONSTRAINT "connected_user_consent_representation_pkey" PRIMARY KEY("consent_id","revision","grant_id")
);

CREATE TABLE "connected_user_consent_resource" (
	"consent_id" uuid,
	"revision" bigint,
	"scope_id" uuid,
	"path" text[],
	CONSTRAINT "connected_user_consent_resource_pkey" PRIMARY KEY("consent_id","revision","scope_id","path"),
	CONSTRAINT "connected_user_consent_resource_path_check" CHECK (cardinality("path") between 0 and 8 and coalesce(array_ndims("path"),1)=1 and array_position("path",null) is null and octet_length(array_to_string("path",'/'))<=2048)
);

CREATE TABLE "connected_user_consent_revision" (
	"consent_id" uuid,
	"revision" bigint,
	"client_id" uuid NOT NULL,
	"client_terms_revision" bigint NOT NULL,
	"valid_from" timestamp(3) with time zone NOT NULL,
	"valid_until" timestamp(3) with time zone NOT NULL,
	"offline_access" boolean NOT NULL,
	"entity_disclosure" boolean NOT NULL,
	"resource_selection" text NOT NULL,
	"capability_count" integer NOT NULL,
	"capability_digest" text NOT NULL,
	"resource_count" integer NOT NULL,
	"resource_digest" text NOT NULL,
	"representation_count" integer NOT NULL,
	"representation_digest" text NOT NULL,
	"sealed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "connected_user_consent_revision_pkey" PRIMARY KEY("consent_id","revision"),
	CONSTRAINT "connected_user_consent_revision_time_check" CHECK (isfinite("valid_from") and isfinite("valid_until") and "valid_until">"valid_from" and "valid_until"-"valid_from"<=interval '365 days'),
	CONSTRAINT "connected_user_consent_revision_counts_check" CHECK ("capability_count" between 0 and 111 and "representation_count" between 0 and 8 and
		(("resource_selection"='all-scopes' and "resource_count"=0) or ("resource_selection"='selected' and "resource_count" between 1 and 64))),
	CONSTRAINT "connected_user_consent_revision_digests_check" CHECK ("capability_digest" ~ '^[0-9a-f]{64}$' and "resource_digest" ~ '^[0-9a-f]{64}$' and "representation_digest" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "connected_user_connection_client_key" ON "connected_user_connection" ("id","client_id");
CREATE INDEX "connected_user_connection_account_idx" ON "connected_user_connection" ("auth_user_id","id");
CREATE INDEX "connected_user_connection_client_idx" ON "connected_user_connection" ("client_id","id");
CREATE INDEX "connected_user_connection_subject_idx" ON "connected_user_connection" ("subject_id","id");
CREATE UNIQUE INDEX "connected_user_connection_event_operation_key" ON "connected_user_connection_event" ("connection_id","operation_id");
CREATE UNIQUE INDEX "connected_user_consent_client_key" ON "connected_user_consent" ("id","client_id");
CREATE INDEX "connected_user_consent_connection_idx" ON "connected_user_consent" ("connection_id","id");
CREATE INDEX "connected_user_consent_client_idx" ON "connected_user_consent" ("client_id","id");
CREATE UNIQUE INDEX "connected_user_consent_event_operation_key" ON "connected_user_consent_event" ("consent_id","operation_id");
CREATE INDEX "connected_user_consent_representation_source_idx" ON "connected_user_consent_representation" ("grant_id","terms_revision","consent_id","revision");
CREATE INDEX "connected_user_consent_resource_scope_idx" ON "connected_user_consent_resource" ("scope_id","consent_id","revision");
CREATE INDEX "connected_user_consent_revision_client_idx" ON "connected_user_consent_revision" ("client_id","client_terms_revision","consent_id","revision");
ALTER TABLE "connected_user_connection" ADD CONSTRAINT "connected_user_connection_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "connected_user_connection" ADD CONSTRAINT "connected_user_connection_hmIhpMwYTwcy_fkey" FOREIGN KEY ("client_id") REFERENCES "connected_app_client"("client_id") ON DELETE RESTRICT;
ALTER TABLE "connected_user_connection" ADD CONSTRAINT "connected_user_connection_subject_id_access_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "access_subject"("id") ON DELETE RESTRICT;
ALTER TABLE "connected_user_connection_event" ADD CONSTRAINT "connected_user_connection_event_XzfhlztgCJrz_fkey" FOREIGN KEY ("connection_id") REFERENCES "connected_user_connection"("id") ON DELETE RESTRICT;
ALTER TABLE "connected_user_connection_event" ADD CONSTRAINT "connected_user_connection_event_5SXknxsQph5E_fkey" FOREIGN KEY ("operator_auth_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "connected_user_consent" ADD CONSTRAINT "connected_user_consent_connection_client_fk" FOREIGN KEY ("connection_id","client_id") REFERENCES "connected_user_connection"("id","client_id") ON DELETE RESTRICT;
ALTER TABLE "connected_user_consent" ADD CONSTRAINT "connected_user_consent_terms_fk" FOREIGN KEY ("id","terms_revision") REFERENCES "connected_user_consent_revision"("consent_id","revision") ON DELETE RESTRICT;
ALTER TABLE "connected_user_consent_capability" ADD CONSTRAINT "connected_user_consent_capability_revision_fk" FOREIGN KEY ("consent_id","revision") REFERENCES "connected_user_consent_revision"("consent_id","revision") ON DELETE RESTRICT;
ALTER TABLE "connected_user_consent_event" ADD CONSTRAINT "connected_user_consent_event_v7mGtzUtqFrR_fkey" FOREIGN KEY ("consent_id") REFERENCES "connected_user_consent"("id") ON DELETE RESTRICT;
ALTER TABLE "connected_user_consent_event" ADD CONSTRAINT "connected_user_consent_event_Gx3MHnzo1KR2_fkey" FOREIGN KEY ("operator_auth_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "connected_user_consent_event" ADD CONSTRAINT "connected_user_consent_event_retained_terms_fk" FOREIGN KEY ("consent_id","retained_terms_revision") REFERENCES "connected_user_consent_revision"("consent_id","revision") ON DELETE RESTRICT;
ALTER TABLE "connected_user_consent_representation" ADD CONSTRAINT "connected_user_consent_representation_revision_fk" FOREIGN KEY ("consent_id","revision") REFERENCES "connected_user_consent_revision"("consent_id","revision") ON DELETE RESTRICT;
ALTER TABLE "connected_user_consent_representation" ADD CONSTRAINT "connected_user_consent_representation_terms_fk" FOREIGN KEY ("grant_id","terms_revision") REFERENCES "access_representation_revision"("grant_id","revision") ON DELETE RESTRICT;
ALTER TABLE "connected_user_consent_resource" ADD CONSTRAINT "connected_user_consent_resource_scope_id_access_scope_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "access_scope"("id") ON DELETE RESTRICT;
ALTER TABLE "connected_user_consent_resource" ADD CONSTRAINT "connected_user_consent_resource_revision_fk" FOREIGN KEY ("consent_id","revision") REFERENCES "connected_user_consent_revision"("consent_id","revision") ON DELETE RESTRICT;
ALTER TABLE "connected_user_consent_revision" ADD CONSTRAINT "connected_user_consent_revision_event_fk" FOREIGN KEY ("consent_id","revision") REFERENCES "connected_user_consent_event"("consent_id","version") ON DELETE RESTRICT;
ALTER TABLE "connected_user_consent_revision" ADD CONSTRAINT "connected_user_consent_revision_owner_fk" FOREIGN KEY ("consent_id","client_id") REFERENCES "connected_user_consent"("id","client_id") ON DELETE RESTRICT;
ALTER TABLE "connected_user_consent_revision" ADD CONSTRAINT "connected_user_consent_revision_client_fk" FOREIGN KEY ("client_id","client_terms_revision") REFERENCES "connected_app_client_revision"("client_id","revision") ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.connected_user_consent_owner(p_consent uuid)
RETURNS uuid LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 SELECT c.auth_user_id FROM public.connected_user_consent g JOIN public.connected_user_connection c ON c.id=g.connection_id WHERE g.id=p_consent
$$;

CREATE OR REPLACE FUNCTION public.require_connected_user_erasure(p_owner uuid)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM id FROM public.users WHERE id=p_owner AND erased_at IS NOT NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Private connection history may be deleted only during account erasure' USING ERRCODE='55000'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.guard_connected_user_connection()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE owner_id uuid; subject_account uuid; event public.connected_user_connection_event%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN PERFORM public.require_connected_user_erasure(OLD.auth_user_id); RETURN OLD; END IF;
 PERFORM id FROM public.users WHERE id=NEW.auth_user_id AND principal_kind='human' AND erased_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'User connections require an unerased human account' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.state<>'draft' THEN RAISE EXCEPTION 'Connection starts without completed consent' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.connected_app_client WHERE client_id=NEW.client_id AND kind='user')
  THEN RAISE EXCEPTION 'User connections require a user-delegation client' USING ERRCODE='23514'; END IF;
  SELECT auth_user_id INTO subject_account FROM public.access_subject WHERE id=NEW.subject_id;
  IF NOT FOUND OR (subject_account IS NOT NULL AND subject_account<>NEW.auth_user_id)
  THEN RAISE EXCEPTION 'Direct connection subject must be its own account' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.id,NEW.auth_user_id,NEW.client_id,NEW.subject_id) IS DISTINCT FROM ROW(OLD.id,OLD.auth_user_id,OLD.client_id,OLD.subject_id)
  OR OLD.state='disconnected' OR NEW.version<>OLD.version+1
 THEN RAISE EXCEPTION 'Connection identity and disconnection are immutable' USING ERRCODE='55000'; END IF;
 SELECT * INTO event FROM public.connected_user_connection_event WHERE connection_id=NEW.id AND version=NEW.version;
 IF NOT FOUND OR NEW.state IS DISTINCT FROM event.state_after THEN RAISE EXCEPTION 'Connection transition requires its receipt' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_connected_user_connection_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.connected_user_connection%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN
  SELECT * INTO head FROM public.connected_user_connection WHERE id=OLD.connection_id;
  PERFORM public.require_connected_user_erasure(head.auth_user_id); RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Connection receipts are immutable' USING ERRCODE='55000'; END IF;
 SELECT * INTO head FROM public.connected_user_connection WHERE id=NEW.connection_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Connection is missing' USING ERRCODE='23503'; END IF;
 PERFORM id FROM public.users WHERE id=head.auth_user_id FOR UPDATE;
 SELECT * INTO head FROM public.connected_user_connection WHERE id=NEW.connection_id FOR UPDATE;
 IF NEW.operator_auth_user_id<>head.auth_user_id OR NEW.version<>head.version+1 OR head.state='disconnected'
 THEN RAISE EXCEPTION 'Only the owning user may change this connection' USING ERRCODE='23514'; END IF;
 IF (NEW.operation='connect') IS DISTINCT FROM (head.version=0)
 THEN RAISE EXCEPTION 'Connection transition does not match its state' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_connected_user_consent()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE connection public.connected_user_connection%ROWTYPE; event public.connected_user_consent_event%ROWTYPE; selected_revision bigint; erased timestamptz;
BEGIN
 IF TG_OP='DELETE' THEN PERFORM public.require_connected_user_erasure(public.connected_user_consent_owner(OLD.id)); RETURN OLD; END IF;
 SELECT * INTO connection FROM public.connected_user_connection WHERE id=NEW.connection_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Consent connection is missing' USING ERRCODE='23503'; END IF;
 SELECT erased_at INTO erased FROM public.users WHERE id=connection.auth_user_id AND principal_kind='human' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Consent requires a human account' USING ERRCODE='23514'; END IF;
 IF erased IS NOT NULL THEN
  IF TG_OP='UPDATE' AND NEW.state='erasing' AND NEW.terms_revision IS NULL AND
   ROW(NEW.id,NEW.connection_id,NEW.client_id,NEW.version) IS NOT DISTINCT FROM ROW(OLD.id,OLD.connection_id,OLD.client_id,OLD.version)
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Erased consent may only detach its head for bounded cleanup' USING ERRCODE='23514';
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.state<>'draft' OR NEW.terms_revision IS NOT NULL OR connection.state<>'active'
  THEN RAISE EXCEPTION 'Consent starts without approved terms on an active connection' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.id,NEW.connection_id,NEW.client_id) IS DISTINCT FROM ROW(OLD.id,OLD.connection_id,OLD.client_id) OR OLD.state='revoked' OR NEW.version<>OLD.version+1
 THEN RAISE EXCEPTION 'Consent identity and withdrawal are immutable' USING ERRCODE='55000'; END IF;
 SELECT * INTO event FROM public.connected_user_consent_event WHERE consent_id=NEW.id AND version=NEW.version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Consent change requires its receipt' USING ERRCODE='23514'; END IF;
 selected_revision:=CASE WHEN event.operation='revoke' THEN event.retained_terms_revision ELSE event.version END;
 IF ROW(NEW.state,NEW.terms_revision) IS DISTINCT FROM ROW(event.state_after,selected_revision)
  OR NOT EXISTS(SELECT 1 FROM public.connected_user_consent_revision WHERE consent_id=NEW.id AND revision=selected_revision AND sealed)
 THEN RAISE EXCEPTION 'Consent must select its complete sealed receipt' USING ERRCODE='23514'; END IF;
 IF NEW.state='active' AND connection.state<>'active' THEN RAISE EXCEPTION 'Disconnected consent cannot be activated' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_connected_user_consent_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.connected_user_consent%ROWTYPE; owner_id uuid;
BEGIN
 IF TG_OP='DELETE' THEN PERFORM public.require_connected_user_erasure(public.connected_user_consent_owner(OLD.consent_id)); RETURN OLD; END IF;
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Consent receipts are immutable' USING ERRCODE='55000'; END IF;
 owner_id:=public.connected_user_consent_owner(NEW.consent_id);
 PERFORM id FROM public.users WHERE id=owner_id FOR UPDATE;
 SELECT * INTO head FROM public.connected_user_consent WHERE id=NEW.consent_id FOR UPDATE;
 IF NOT FOUND OR NEW.operator_auth_user_id IS DISTINCT FROM owner_id OR NEW.version<>head.version+1 OR head.state='revoked'
 THEN RAISE EXCEPTION 'Only the owning user may grant or withdraw consent' USING ERRCODE='23514'; END IF;
 IF (NEW.operation='grant') IS DISTINCT FROM (head.version=0) OR (NEW.operation='revoke' AND NEW.retained_terms_revision IS DISTINCT FROM head.terms_revision)
 THEN RAISE EXCEPTION 'Consent transition does not match its current state' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_connected_user_consent_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE parent public.connected_app_client_revision%ROWTYPE; subject_entity uuid; amount integer; digest text;
BEGIN
 IF TG_OP='DELETE' THEN PERFORM public.require_connected_user_erasure(public.connected_user_consent_owner(OLD.consent_id)); RETURN OLD; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.sealed OR NOT EXISTS(SELECT 1 FROM public.connected_user_consent_event WHERE consent_id=NEW.consent_id AND version=NEW.revision AND operation IN ('grant','revise'))
  THEN RAISE EXCEPTION 'Consent terms require an open approval receipt' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.sealed OR NOT NEW.sealed OR (to_jsonb(NEW)-'sealed') IS DISTINCT FROM (to_jsonb(OLD)-'sealed')
 THEN RAISE EXCEPTION 'Consent terms can only be sealed once' USING ERRCODE='55000'; END IF;
 SELECT * INTO parent FROM public.connected_app_client_revision WHERE client_id=NEW.client_id AND revision=NEW.client_terms_revision AND sealed;
 IF NOT FOUND OR (NEW.offline_access AND NOT parent.offline_access) OR (NEW.entity_disclosure AND NOT parent.entity_disclosure)
 THEN RAISE EXCEPTION 'Consent exceeds its selected client ceiling' USING ERRCODE='23514'; END IF;
 SELECT s.entity_id INTO subject_entity FROM public.connected_user_consent g JOIN public.connected_user_connection c ON c.id=g.connection_id
  JOIN public.access_subject s ON s.id=c.subject_id WHERE g.id=NEW.consent_id;
 IF (subject_entity IS NULL AND (NEW.representation_count<>0 OR NEW.entity_disclosure)) OR (subject_entity IS NOT NULL AND NEW.representation_count<1)
 THEN RAISE EXCEPTION 'Consent representation must match its fixed authority subject' USING ERRCODE='23514'; END IF;
 SELECT count(*)::integer,encode(sha256(convert_to(coalesce(string_agg(family||':'||capability,E'\n' ORDER BY family COLLATE "C",capability COLLATE "C"),''),'UTF8')),'hex')
 INTO amount,digest FROM public.connected_user_consent_capability WHERE consent_id=NEW.consent_id AND revision=NEW.revision;
 IF amount<>NEW.capability_count OR digest<>NEW.capability_digest OR EXISTS(
  SELECT 1 FROM public.connected_user_consent_capability v WHERE v.consent_id=NEW.consent_id AND v.revision=NEW.revision AND NOT EXISTS(
   SELECT 1 FROM public.connected_app_client_capability p WHERE p.client_id=NEW.client_id AND p.revision=NEW.client_terms_revision AND p.family=v.family AND p.capability=v.capability))
 THEN RAISE EXCEPTION 'Consent capability snapshot is incomplete or exceeds its client ceiling' USING ERRCODE='23514'; END IF;
 SELECT count(*)::integer,encode(sha256(convert_to(coalesce(string_agg(scope_id::text||':'||array_to_string(path,'/'),E'\n' ORDER BY scope_id,array_to_string(path,'/') COLLATE "C"),''),'UTF8')),'hex')
 INTO amount,digest FROM public.connected_user_consent_resource WHERE consent_id=NEW.consent_id AND revision=NEW.revision;
 IF amount<>NEW.resource_count OR digest<>NEW.resource_digest THEN RAISE EXCEPTION 'Consent resource selection is incomplete' USING ERRCODE='23514'; END IF;
 SELECT count(*)::integer,encode(sha256(convert_to(coalesce(string_agg(grant_id::text||':'||terms_revision::text,E'\n' ORDER BY grant_id),''),'UTF8')),'hex')
 INTO amount,digest FROM public.connected_user_consent_representation WHERE consent_id=NEW.consent_id AND revision=NEW.revision;
 IF amount<>NEW.representation_count OR digest<>NEW.representation_digest THEN RAISE EXCEPTION 'Consent representation snapshot is incomplete' USING ERRCODE='23514'; END IF;
 IF subject_entity IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.connected_user_consent_representation p JOIN public.access_representation r ON r.id=p.grant_id
  WHERE p.consent_id=NEW.consent_id AND p.revision=NEW.revision AND r.entity_id=subject_entity)
 THEN RAISE EXCEPTION 'Consent context must include its selected Entity' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_connected_user_consent_member()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE is_sealed boolean; segment text;
BEGIN
 IF TG_OP='DELETE' THEN PERFORM public.require_connected_user_erasure(public.connected_user_consent_owner(OLD.consent_id)); RETURN OLD; END IF;
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Consent snapshot members are immutable' USING ERRCODE='55000'; END IF;
 SELECT sealed INTO is_sealed FROM public.connected_user_consent_revision WHERE consent_id=NEW.consent_id AND revision=NEW.revision FOR UPDATE;
 IF NOT FOUND OR is_sealed THEN RAISE EXCEPTION 'Consent member requires open terms' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='connected_user_consent_resource' THEN
  FOREACH segment IN ARRAY NEW.path LOOP
   IF segment IS NULL OR segment !~ '^[a-z0-9][a-z0-9-]{0,255}$' THEN RAISE EXCEPTION 'Consent resource path is invalid' USING ERRCODE='23514'; END IF;
  END LOOP;
  IF (SELECT count(*) FROM (SELECT 1 FROM public.connected_user_consent_resource WHERE consent_id=NEW.consent_id AND revision=NEW.revision LIMIT 64) r)>=64
  THEN RAISE EXCEPTION 'Consent resource budget exceeded' USING ERRCODE='54000'; END IF;
 ELSIF TG_TABLE_NAME='connected_user_consent_representation' THEN
  IF (SELECT count(*) FROM (SELECT 1 FROM public.connected_user_consent_representation WHERE consent_id=NEW.consent_id AND revision=NEW.revision LIMIT 8) r)>=8
  THEN RAISE EXCEPTION 'Consent representation budget exceeded' USING ERRCODE='54000'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.complete_connected_user_authorization()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE final_version bigint; connection_event public.connected_user_connection_event%ROWTYPE; consent_event public.connected_user_consent_event%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='connected_user_connection' THEN
  SELECT version INTO final_version FROM public.connected_user_connection WHERE id=NEW.id;
  IF final_version=0 THEN RAISE EXCEPTION 'Connection must complete its first receipt' USING ERRCODE='23514'; END IF;
  IF NEW.version>0 THEN
   SELECT * INTO connection_event FROM public.connected_user_connection_event WHERE connection_id=NEW.id AND version=NEW.version;
   IF NOT FOUND OR NEW.state IS DISTINCT FROM connection_event.state_after THEN RAISE EXCEPTION 'Connection history must preserve each transition' USING ERRCODE='23514'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='connected_user_connection_event' THEN
  SELECT version INTO final_version FROM public.connected_user_connection WHERE id=NEW.connection_id;
  IF final_version<NEW.version THEN RAISE EXCEPTION 'Connection receipt must advance its head' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='connected_user_consent' THEN
  IF NEW.state='erasing' THEN PERFORM public.require_connected_user_erasure(public.connected_user_consent_owner(NEW.id)); RETURN NULL; END IF;
  SELECT version INTO final_version FROM public.connected_user_consent WHERE id=NEW.id;
  IF final_version=0 THEN RAISE EXCEPTION 'Consent must complete its first terms' USING ERRCODE='23514'; END IF;
  IF NEW.version>0 THEN
   SELECT * INTO consent_event FROM public.connected_user_consent_event WHERE consent_id=NEW.id AND version=NEW.version;
   IF NOT FOUND OR ROW(NEW.state,NEW.terms_revision) IS DISTINCT FROM ROW(consent_event.state_after,CASE WHEN consent_event.operation='revoke' THEN consent_event.retained_terms_revision ELSE consent_event.version END)
   THEN RAISE EXCEPTION 'Consent history must preserve each transition' USING ERRCODE='23514'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='connected_user_consent_event' THEN
  SELECT version INTO final_version FROM public.connected_user_consent WHERE id=NEW.consent_id;
  IF final_version<NEW.version THEN RAISE EXCEPTION 'Consent receipt must advance its head' USING ERRCODE='23514'; END IF;
  IF NEW.operation IN ('grant','revise') AND NOT EXISTS(SELECT 1 FROM public.connected_user_consent_revision WHERE consent_id=NEW.consent_id AND revision=NEW.version AND sealed)
  THEN RAISE EXCEPTION 'Consent receipt must seal its terms' USING ERRCODE='23514'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.connected_user_consent_revision WHERE consent_id=NEW.consent_id AND revision=NEW.revision AND sealed)
  THEN RAISE EXCEPTION 'Consent terms must be sealed before commit' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS connected_user_connection_guard ON public.connected_user_connection;
CREATE TRIGGER connected_user_connection_guard BEFORE INSERT OR UPDATE OR DELETE ON public.connected_user_connection FOR EACH ROW EXECUTE FUNCTION public.guard_connected_user_connection();
DROP TRIGGER IF EXISTS connected_user_connection_event_guard ON public.connected_user_connection_event;
CREATE TRIGGER connected_user_connection_event_guard BEFORE INSERT OR UPDATE OR DELETE ON public.connected_user_connection_event FOR EACH ROW EXECUTE FUNCTION public.guard_connected_user_connection_event();
DROP TRIGGER IF EXISTS connected_user_consent_guard ON public.connected_user_consent;
CREATE TRIGGER connected_user_consent_guard BEFORE INSERT OR UPDATE OR DELETE ON public.connected_user_consent FOR EACH ROW EXECUTE FUNCTION public.guard_connected_user_consent();
DROP TRIGGER IF EXISTS connected_user_consent_event_guard ON public.connected_user_consent_event;
CREATE TRIGGER connected_user_consent_event_guard BEFORE INSERT OR UPDATE OR DELETE ON public.connected_user_consent_event FOR EACH ROW EXECUTE FUNCTION public.guard_connected_user_consent_event();
DROP TRIGGER IF EXISTS connected_user_consent_revision_guard ON public.connected_user_consent_revision;
CREATE TRIGGER connected_user_consent_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON public.connected_user_consent_revision FOR EACH ROW EXECUTE FUNCTION public.guard_connected_user_consent_revision();
DROP TRIGGER IF EXISTS connected_user_consent_capability_guard ON public.connected_user_consent_capability;
CREATE TRIGGER connected_user_consent_capability_guard BEFORE INSERT OR UPDATE OR DELETE ON public.connected_user_consent_capability FOR EACH ROW EXECUTE FUNCTION public.guard_connected_user_consent_member();
DROP TRIGGER IF EXISTS connected_user_consent_resource_guard ON public.connected_user_consent_resource;
CREATE TRIGGER connected_user_consent_resource_guard BEFORE INSERT OR UPDATE OR DELETE ON public.connected_user_consent_resource FOR EACH ROW EXECUTE FUNCTION public.guard_connected_user_consent_member();
DROP TRIGGER IF EXISTS connected_user_consent_representation_guard ON public.connected_user_consent_representation;
CREATE TRIGGER connected_user_consent_representation_guard BEFORE INSERT OR UPDATE OR DELETE ON public.connected_user_consent_representation FOR EACH ROW EXECUTE FUNCTION public.guard_connected_user_consent_member();
DROP TRIGGER IF EXISTS connected_user_connection_complete ON public.connected_user_connection;
CREATE CONSTRAINT TRIGGER connected_user_connection_complete AFTER INSERT OR UPDATE ON public.connected_user_connection DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_connected_user_authorization();
DROP TRIGGER IF EXISTS connected_user_connection_event_complete ON public.connected_user_connection_event;
CREATE CONSTRAINT TRIGGER connected_user_connection_event_complete AFTER INSERT ON public.connected_user_connection_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_connected_user_authorization();
DROP TRIGGER IF EXISTS connected_user_consent_complete ON public.connected_user_consent;
CREATE CONSTRAINT TRIGGER connected_user_consent_complete AFTER INSERT OR UPDATE ON public.connected_user_consent DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_connected_user_authorization();
DROP TRIGGER IF EXISTS connected_user_consent_event_complete ON public.connected_user_consent_event;
CREATE CONSTRAINT TRIGGER connected_user_consent_event_complete AFTER INSERT ON public.connected_user_consent_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_connected_user_authorization();
DROP TRIGGER IF EXISTS connected_user_consent_revision_complete ON public.connected_user_consent_revision;
CREATE CONSTRAINT TRIGGER connected_user_consent_revision_complete AFTER INSERT OR UPDATE ON public.connected_user_consent_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_connected_user_authorization();
