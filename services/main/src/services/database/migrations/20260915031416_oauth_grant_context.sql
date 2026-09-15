SET search_path TO public;

CREATE TABLE "oauth_access_context" (
	"token_id" uuid PRIMARY KEY,
	"context_id" uuid NOT NULL
);

CREATE TABLE "oauth_grant_context" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"kind" text NOT NULL,
	"client_id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"client_terms_revision" bigint NOT NULL,
	"protocol_credential_epoch" bigint NOT NULL,
	"client_credential_epoch" bigint NOT NULL,
	"app_authority_epoch" bigint NOT NULL,
	"consent_id" uuid,
	"consent_terms_revision" bigint,
	"installation_id" uuid,
	"installation_approval_revision" bigint,
	"installation_credential_epoch" bigint,
	"workload_credential_epoch" bigint,
	"refresh_family_id" uuid,
	"refresh_family_epoch" bigint,
	"authorization_code_id" text,
	"scopes" text[] NOT NULL,
	"audiences" text[] NOT NULL,
	"valid_until" timestamp(3) with time zone NOT NULL,
	"revoked_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "oauth_grant_context_kind_check" CHECK (("kind"='user' and "consent_id" is not null and "consent_terms_revision" is not null and "installation_id" is null and "installation_approval_revision" is null and "installation_credential_epoch" is null and "workload_credential_epoch" is null) or
		("kind"='installation' and "consent_id" is null and "consent_terms_revision" is null and "installation_id" is not null and "installation_approval_revision" is not null and "installation_credential_epoch" is not null and "workload_credential_epoch" is not null and "refresh_family_id" is null and "refresh_family_epoch" is null and "authorization_code_id" is null)),
	CONSTRAINT "oauth_grant_context_epoch_check" CHECK ("protocol_credential_epoch" between 0 and 9007199254740991 and "client_credential_epoch" between 0 and 9007199254740991 and "app_authority_epoch" between 0 and 9007199254740991
		and ("installation_credential_epoch" is null or "installation_credential_epoch" between 0 and 9007199254740991) and ("workload_credential_epoch" is null or "workload_credential_epoch" between 0 and 9007199254740991)
		and ("refresh_family_epoch" is null or "refresh_family_epoch" between 0 and 9007199254740991) and ("refresh_family_id" is null)=("refresh_family_epoch" is null)),
	CONSTRAINT "oauth_grant_context_time_check" CHECK (isfinite("valid_until") and "valid_until">"created_at" and "valid_until"-"created_at"<=interval '365 days' and ("revoked_at" is null or isfinite("revoked_at"))),
	CONSTRAINT "oauth_grant_context_scopes_check" CHECK (cardinality("scopes") between 0 and 24 and coalesce(array_ndims("scopes"),1)=1 and array_position("scopes",null) is null and "scopes"<@array['openid', 'offline_access', 'unit:read', 'unit:create', 'unit:update', 'account:read', 'account:update', 'access:read', 'access:manage', 'app:read', 'app:manage', 'interaction:read', 'interaction:write', 'realm:read', 'realm:manage', 'message:read', 'message:write', 'notification:read', 'notification:write', 'recommendation:read', 'recommendation:write', 'upload:read', 'upload:write', 'report:write']::text[]),
	CONSTRAINT "oauth_grant_context_audiences_check" CHECK (cardinality("audiences") between 1 and 4 and coalesce(array_ndims("audiences"),1)=1 and array_position("audiences",null) is null and octet_length(array_to_string("audiences",' '))<=8192),
	CONSTRAINT "oauth_grant_context_code_check" CHECK ("authorization_code_id" is null or octet_length("authorization_code_id") between 1 and 256)
);

CREATE TABLE "oauth_refresh_context" (
	"token_id" uuid PRIMARY KEY,
	"context_id" uuid NOT NULL
);

CREATE TABLE "oauth_refresh_family" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"client_id" uuid NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"epoch" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_refresh_family_epoch_check" CHECK ("epoch" between 0 and 9007199254740991)
);

CREATE INDEX "oauth_access_context_context_idx" ON "oauth_access_context" ("context_id","token_id");
CREATE INDEX "oauth_grant_context_account_idx" ON "oauth_grant_context" ("principal_id","id");
CREATE INDEX "oauth_grant_context_client_idx" ON "oauth_grant_context" ("client_id","id");
CREATE INDEX "oauth_grant_context_consent_idx" ON "oauth_grant_context" ("consent_id","id") WHERE "consent_id" is not null;
CREATE INDEX "oauth_grant_context_installation_idx" ON "oauth_grant_context" ("installation_id","id") WHERE "installation_id" is not null;
CREATE INDEX "oauth_grant_context_family_idx" ON "oauth_grant_context" ("refresh_family_id","id") WHERE "refresh_family_id" is not null;
CREATE INDEX "oauth_grant_context_expiry_idx" ON "oauth_grant_context" ("valid_until","id");
CREATE INDEX "oauth_grant_context_created_idx" ON "oauth_grant_context" ("created_at","id");
CREATE UNIQUE INDEX "oauth_grant_context_code_key" ON "oauth_grant_context" ("authorization_code_id") WHERE "authorization_code_id" is not null;
CREATE INDEX "oauth_refresh_context_context_idx" ON "oauth_refresh_context" ("context_id","token_id");
CREATE UNIQUE INDEX "oauth_refresh_family_owner_key" ON "oauth_refresh_family" ("client_id","auth_user_id");
CREATE UNIQUE INDEX "oauth_refresh_family_identity_key" ON "oauth_refresh_family" ("id","client_id","auth_user_id");
CREATE INDEX "oauth_refresh_family_account_idx" ON "oauth_refresh_family" ("auth_user_id","id");
ALTER TABLE "oauth_access_context" ADD CONSTRAINT "oauth_access_context_token_id_oauth_access_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "oauth_access_token"("id") ON DELETE CASCADE;
ALTER TABLE "oauth_access_context" ADD CONSTRAINT "oauth_access_context_context_id_oauth_grant_context_id_fkey" FOREIGN KEY ("context_id") REFERENCES "oauth_grant_context"("id") ON DELETE RESTRICT;
ALTER TABLE "oauth_grant_context" ADD CONSTRAINT "oauth_grant_context_KOMuZHvEdwYq_fkey" FOREIGN KEY ("client_id") REFERENCES "connected_app_client"("client_id") ON DELETE RESTRICT;
ALTER TABLE "oauth_grant_context" ADD CONSTRAINT "oauth_grant_context_principal_id_users_id_fkey" FOREIGN KEY ("principal_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "oauth_grant_context" ADD CONSTRAINT "oauth_grant_context_client_terms_fk" FOREIGN KEY ("client_id","client_terms_revision") REFERENCES "connected_app_client_revision"("client_id","revision") ON DELETE RESTRICT;
ALTER TABLE "oauth_grant_context" ADD CONSTRAINT "oauth_grant_context_consent_client_fk" FOREIGN KEY ("consent_id","client_id") REFERENCES "connected_user_consent"("id","client_id") ON DELETE RESTRICT;
ALTER TABLE "oauth_grant_context" ADD CONSTRAINT "oauth_grant_context_consent_terms_fk" FOREIGN KEY ("consent_id","consent_terms_revision") REFERENCES "connected_user_consent_revision"("consent_id","revision") ON DELETE RESTRICT;
ALTER TABLE "oauth_grant_context" ADD CONSTRAINT "oauth_grant_context_installation_fk" FOREIGN KEY ("installation_id") REFERENCES "connected_installation"("id") ON DELETE RESTRICT;
ALTER TABLE "oauth_grant_context" ADD CONSTRAINT "oauth_grant_context_installation_approval_fk" FOREIGN KEY ("installation_id","installation_approval_revision") REFERENCES "connected_installation_revision"("installation_id","revision") ON DELETE RESTRICT;
ALTER TABLE "oauth_grant_context" ADD CONSTRAINT "oauth_grant_context_refresh_family_fk" FOREIGN KEY ("refresh_family_id","client_id","principal_id") REFERENCES "oauth_refresh_family"("id","client_id","auth_user_id") ON DELETE RESTRICT;
ALTER TABLE "oauth_refresh_context" ADD CONSTRAINT "oauth_refresh_context_token_id_oauth_refresh_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "oauth_refresh_token"("id") ON DELETE CASCADE;
ALTER TABLE "oauth_refresh_context" ADD CONSTRAINT "oauth_refresh_context_context_id_oauth_grant_context_id_fkey" FOREIGN KEY ("context_id") REFERENCES "oauth_grant_context"("id") ON DELETE RESTRICT;
ALTER TABLE "oauth_refresh_family" ADD CONSTRAINT "oauth_refresh_family_mR2bQ5eoiLhE_fkey" FOREIGN KEY ("client_id") REFERENCES "connected_app_client"("client_id") ON DELETE RESTRICT;
ALTER TABLE "oauth_refresh_family" ADD CONSTRAINT "oauth_refresh_family_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.guard_oauth_refresh_family()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM public.oauth_grant_context WHERE refresh_family_id=OLD.id) THEN RAISE EXCEPTION 'Refresh family contexts must be drained first' USING ERRCODE='23503'; END IF;
  RETURN OLD;
 END IF;
 PERFORM id FROM public.users WHERE id=NEW.auth_user_id AND principal_kind='human' FOR SHARE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.connected_app_client WHERE client_id=NEW.client_id AND kind='user')
 THEN RAISE EXCEPTION 'Refresh families require a user client and human account' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.epoch<>0 THEN RAISE EXCEPTION 'Refresh family begins at epoch zero' USING ERRCODE='23514'; END IF;
 ELSIF ROW(NEW.id,NEW.client_id,NEW.auth_user_id,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.client_id,OLD.auth_user_id,OLD.created_at) OR NEW.epoch<>OLD.epoch+1
 THEN RAISE EXCEPTION 'Refresh family identity is fixed and invalidation advances once' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.oauth_grant_context_payload_is_current(p public.oauth_grant_context)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 WITH evaluated AS MATERIALIZED(SELECT clock_timestamp() AS now)
 SELECT p.revoked_at IS NULL AND p.valid_until>evaluated.now AND EXISTS(
  SELECT 1 FROM public.connected_app_client c JOIN public.connected_app_client_revision t ON t.client_id=c.client_id AND t.revision=c.terms_revision
   JOIN public.oauth_client_authority a ON a.id=c.client_id JOIN public.oauth_client protocol ON protocol.id=a.id
   JOIN public.connected_app app ON app.id=c.app_id
  WHERE c.client_id=p.client_id AND c.state='active' AND c.terms_revision=p.client_terms_revision AND t.sealed
   AND c.credential_epoch=p.client_credential_epoch AND a.credential_epoch=p.protocol_credential_epoch AND a.revoked_at IS NULL
   AND protocol.disabled=false AND t.protocol_credential_epoch=a.credential_epoch
   AND app.authority_epoch=p.app_authority_epoch AND public.connected_app_is_eligible(app.id) IS TRUE
   AND public.connected_app_client_terms_match_protocol(c.client_id,t.revision) IS TRUE
   AND NOT EXISTS(SELECT 1 FROM unnest(p.audiences) audience(value) WHERE NOT EXISTS(
    SELECT 1 FROM public.oauth_client_resource r WHERE r.client_id=protocol.client_id AND r.resource_id=audience.value))
   AND NOT EXISTS(SELECT 1 FROM unnest(p.scopes) requested(value) WHERE NOT(requested.value=ANY(protocol.scopes)))
   AND ((p.kind='user' AND c.kind='user' AND EXISTS(
    SELECT 1 FROM public.connected_user_consent g JOIN public.connected_user_connection connection ON connection.id=g.connection_id
     JOIN public.connected_user_consent_revision r ON r.consent_id=g.id AND r.revision=g.terms_revision
     JOIN public.users u ON u.id=connection.auth_user_id
    WHERE g.id=p.consent_id AND g.client_id=c.client_id AND g.state='active' AND g.terms_revision=p.consent_terms_revision
     AND connection.state='active' AND u.id=p.principal_id AND u.principal_kind='human' AND u.erased_at IS NULL
     AND public.access_principal_account_is_eligible(u.id,'read') IS TRUE AND public.access_subject_is_eligible(connection.subject_id,'read') IS TRUE
     AND r.sealed AND r.valid_from<=evaluated.now AND r.valid_until>evaluated.now
     AND p.valid_until<=r.valid_until AND NOT EXISTS(SELECT 1 FROM unnest(p.scopes) requested(value)
      WHERE requested.value<>'openid' AND NOT(requested.value='offline_access' AND r.offline_access AND t.offline_access) AND NOT EXISTS(
       SELECT 1 FROM public.connected_user_consent_capability v WHERE v.consent_id=g.id AND v.revision=r.revision AND v.family='api' AND v.capability=requested.value)))) OR
    (p.kind='installation' AND c.kind='installation' AND c.workload_principal_id=p.principal_id AND EXISTS(
     SELECT 1 FROM public.connected_installation i JOIN public.workload_principal w ON w.auth_user_id=i.workload_principal_id
      JOIN public.connected_installation_revision approval ON approval.installation_id=i.id AND approval.revision=i.approved_revision
      JOIN public.access_subject subject ON subject.auth_user_id=w.auth_user_id
     WHERE i.id=p.installation_id AND i.app_id=c.app_id AND i.workload_principal_id=c.workload_principal_id
      AND i.approved_revision=p.installation_approval_revision AND i.credential_epoch=p.installation_credential_epoch
      AND w.credential_epoch=p.workload_credential_epoch AND public.access_subject_is_eligible(subject.id,'read') IS TRUE
      AND public.connected_installation_is_eligible(i.id) IS TRUE AND (approval.valid_until IS NULL OR p.valid_until<=approval.valid_until)
      AND NOT EXISTS(SELECT 1 FROM unnest(p.scopes) requested(value) WHERE NOT EXISTS(
       SELECT 1 FROM public.connected_installation_capability v WHERE v.installation_id=i.id AND v.revision=i.approved_revision AND v.family='api' AND v.capability=requested.value)))))
 ) AND (p.refresh_family_id IS NULL OR EXISTS(SELECT 1 FROM public.oauth_refresh_family f WHERE f.id=p.refresh_family_id
  AND f.client_id=p.client_id AND f.auth_user_id=p.principal_id AND f.epoch=p.refresh_family_epoch))
 FROM evaluated
$$;

CREATE OR REPLACE FUNCTION public.oauth_grant_context_is_current(p_context uuid)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 SELECT public.oauth_grant_context_payload_is_current(c) FROM public.oauth_grant_context c WHERE c.id=p_context
$$;

CREATE OR REPLACE FUNCTION public.guard_oauth_grant_context()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.revoked_at IS NOT NULL OR public.oauth_grant_context_payload_is_current(NEW) IS NOT TRUE
  THEN RAISE EXCEPTION 'Credential context requires current native grant dependencies' USING ERRCODE='23514'; END IF;
 ELSE
  IF (to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at') OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL
  THEN RAISE EXCEPTION 'Credential contexts are immutable and revocation is terminal' USING ERRCODE='55000'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.attach_oauth_grant_context()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE selected text; context public.oauth_grant_context%ROWTYPE; protocol_client text; parent_context uuid;
BEGIN
 selected:=current_setting('rezics.oauth_grant_context',true);
 IF selected IS NULL OR selected !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
 THEN RAISE EXCEPTION 'Native credential context is required for OAuth issuance' USING ERRCODE='23514',CONSTRAINT='oauth_native_context_required'; END IF;
 SELECT * INTO context FROM public.oauth_grant_context WHERE id=selected::uuid FOR SHARE;
 IF NOT FOUND OR public.oauth_grant_context_payload_is_current(context) IS NOT TRUE
 THEN RAISE EXCEPTION 'Native credential context is no longer current' USING ERRCODE='23514',CONSTRAINT='oauth_native_context_required'; END IF;
 SELECT client_id INTO protocol_client FROM public.oauth_client_authority WHERE id=context.client_id;
 IF NEW.client_id IS DISTINCT FROM protocol_client OR NEW.authorization_code_id IS DISTINCT FROM context.authorization_code_id
  OR NOT isfinite(NEW.created_at) OR NOT isfinite(NEW.expires_at) OR NEW.created_at>clock_timestamp() OR NEW.expires_at<=NEW.created_at
  OR NEW.expires_at>context.valid_until OR NEW.resources IS NULL OR cardinality(NEW.resources) NOT BETWEEN 1 AND 4 OR NOT(NEW.resources<@context.audiences)
  OR cardinality(NEW.scopes)>cardinality(context.scopes) OR NOT(NEW.scopes<@context.scopes)
 THEN RAISE EXCEPTION 'OAuth token exceeds its native context' USING ERRCODE='23514'; END IF;
 IF context.kind='user' THEN
  IF NEW.user_id IS DISTINCT FROM context.principal_id OR NEW.reference_id IS DISTINCT FROM context.consent_id::text
  THEN RAISE EXCEPTION 'OAuth token changed its private user or consent identity' USING ERRCODE='23514'; END IF;
 ELSE
  IF NEW.user_id IS NOT NULL OR NEW.reference_id IS NOT NULL OR TG_TABLE_NAME='oauth_refresh_token'
  THEN RAISE EXCEPTION 'Installation credentials cannot become user or refresh tokens' USING ERRCODE='23514'; END IF;
 END IF;
 IF TG_TABLE_NAME='oauth_refresh_token' THEN
  IF context.refresh_family_id IS NULL OR NOT('offline_access'=ANY(context.scopes)) THEN RAISE EXCEPTION 'Refresh issuance requires its approved offline family' USING ERRCODE='23514'; END IF;
  INSERT INTO public.oauth_refresh_context(token_id,context_id) VALUES(NEW.id,context.id);
 ELSE
  IF NEW.refresh_id IS NOT NULL THEN
   SELECT context_id INTO parent_context FROM public.oauth_refresh_context WHERE token_id=NEW.refresh_id;
   IF parent_context IS DISTINCT FROM context.id THEN RAISE EXCEPTION 'Access token must retain its refresh context' USING ERRCODE='23514'; END IF;
  END IF;
  INSERT INTO public.oauth_access_context(token_id,context_id) VALUES(NEW.id,context.id);
 END IF;
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.guard_oauth_token_context_link()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Token context identity cannot be reassigned' USING ERRCODE='55000'; END IF;
 IF TG_OP='DELETE' THEN
  IF TG_TABLE_NAME='oauth_access_context' THEN
   IF EXISTS(SELECT 1 FROM public.oauth_access_token WHERE id=OLD.token_id) THEN RAISE EXCEPTION 'Delete the token before its context link' USING ERRCODE='55000'; END IF;
  ELSE
   IF EXISTS(SELECT 1 FROM public.oauth_refresh_token WHERE id=OLD.token_id) THEN RAISE EXCEPTION 'Delete the refresh token before its context link' USING ERRCODE='55000'; END IF;
  END IF;
  RETURN OLD;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_oauth_token_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE old_identity jsonb; new_identity jsonb;
BEGIN
 old_identity:=to_jsonb(OLD)-ARRAY['revoked','rotated_at','rotation_replay_response','rotation_replay_expires_at','session_id'];
 new_identity:=to_jsonb(NEW)-ARRAY['revoked','rotated_at','rotation_replay_response','rotation_replay_expires_at','session_id'];
 IF new_identity IS DISTINCT FROM old_identity OR (OLD.revoked IS NOT NULL AND NEW.revoked IS NULL)
  OR (NEW.session_id IS DISTINCT FROM OLD.session_id AND NEW.session_id IS NOT NULL)
 THEN RAISE EXCEPTION 'OAuth token identity, scope and lifetime are immutable; revocation cannot be undone' USING ERRCODE='55000'; END IF;
 IF TG_TABLE_NAME='oauth_refresh_token' THEN
  IF OLD.rotated_at IS NOT NULL AND NEW.rotated_at IS NULL THEN RAISE EXCEPTION 'Refresh rotation cannot be undone' USING ERRCODE='55000'; END IF;
 END IF;
 RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS oauth_refresh_family_guard ON public.oauth_refresh_family;
CREATE TRIGGER oauth_refresh_family_guard BEFORE INSERT OR UPDATE OR DELETE ON public.oauth_refresh_family FOR EACH ROW EXECUTE FUNCTION public.guard_oauth_refresh_family();
DROP TRIGGER IF EXISTS oauth_grant_context_guard ON public.oauth_grant_context;
CREATE TRIGGER oauth_grant_context_guard BEFORE INSERT OR UPDATE OR DELETE ON public.oauth_grant_context FOR EACH ROW EXECUTE FUNCTION public.guard_oauth_grant_context();
DROP TRIGGER IF EXISTS oauth_access_token_native_context ON public.oauth_access_token;
CREATE TRIGGER oauth_access_token_native_context AFTER INSERT ON public.oauth_access_token FOR EACH ROW EXECUTE FUNCTION public.attach_oauth_grant_context();
DROP TRIGGER IF EXISTS oauth_refresh_token_native_context ON public.oauth_refresh_token;
CREATE TRIGGER oauth_refresh_token_native_context AFTER INSERT ON public.oauth_refresh_token FOR EACH ROW EXECUTE FUNCTION public.attach_oauth_grant_context();
DROP TRIGGER IF EXISTS oauth_access_context_guard ON public.oauth_access_context;
CREATE TRIGGER oauth_access_context_guard BEFORE INSERT OR UPDATE OR DELETE ON public.oauth_access_context FOR EACH ROW EXECUTE FUNCTION public.guard_oauth_token_context_link();
DROP TRIGGER IF EXISTS oauth_refresh_context_guard ON public.oauth_refresh_context;
CREATE TRIGGER oauth_refresh_context_guard BEFORE INSERT OR UPDATE OR DELETE ON public.oauth_refresh_context FOR EACH ROW EXECUTE FUNCTION public.guard_oauth_token_context_link();
DROP TRIGGER IF EXISTS oauth_access_token_identity_guard ON public.oauth_access_token;
CREATE TRIGGER oauth_access_token_identity_guard BEFORE UPDATE ON public.oauth_access_token FOR EACH ROW EXECUTE FUNCTION public.guard_oauth_token_identity();
DROP TRIGGER IF EXISTS oauth_refresh_token_identity_guard ON public.oauth_refresh_token;
CREATE TRIGGER oauth_refresh_token_identity_guard BEFORE UPDATE ON public.oauth_refresh_token FOR EACH ROW EXECUTE FUNCTION public.guard_oauth_token_identity();
