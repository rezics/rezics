SET search_path TO public;

CREATE TABLE "oauth_client_authority" (
	"id" uuid PRIMARY KEY,
	"client_id" text NOT NULL,
	"discovery_id" text,
	"version" bigint DEFAULT 0 NOT NULL,
	"credential_epoch" bigint DEFAULT 0 NOT NULL,
	"revoked_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_client_authority_identifier_check" CHECK (octet_length("client_id") between 1 and 2048),
	CONSTRAINT "oauth_client_authority_version_check" CHECK ("version" between 0 and 9007199254740991 and "credential_epoch" between 0 and "version"),
	CONSTRAINT "oauth_client_authority_time_check" CHECK ("revoked_at" is null or (isfinite("revoked_at") and "revoked_at">="created_at"))
);

CREATE UNIQUE INDEX "oauth_client_authority_identifier_key" ON "oauth_client_authority" ("client_id");
CREATE INDEX "oauth_client_authority_created_idx" ON "oauth_client_authority" ("created_at","id");
CREATE INDEX "oauth_client_authority_revoked_idx" ON "oauth_client_authority" ("revoked_at","id") WHERE "revoked_at" is not null;
ALTER TABLE "oauth_client" ADD CONSTRAINT "oauth_client_authority_fk" FOREIGN KEY ("id") REFERENCES "oauth_client_authority"("id") ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.guard_oauth_client_authority()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'OAuth client control identities are retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.credential_epoch<>0 OR NEW.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'OAuth client control starts at version zero' USING ERRCODE='23514'; END IF;
 ELSE
  IF ROW(NEW.id,NEW.client_id,NEW.discovery_id,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.client_id,OLD.discovery_id,OLD.created_at)
   OR NEW.version<>OLD.version+1 OR NEW.credential_epoch NOT IN (OLD.credential_epoch,OLD.credential_epoch+1) OR OLD.revoked_at IS NOT NULL
   OR (NEW.revoked_at IS NOT NULL AND NEW.credential_epoch<>OLD.credential_epoch+1)
  THEN RAISE EXCEPTION 'OAuth client identity is fixed and revocation is terminal' USING ERRCODE='55000'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.fence_oauth_client_authority()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE invalidating boolean;
BEGIN
 IF TG_OP<>'DELETE' THEN
  -- These are server-owned profile choices. An absent subject type is canonicalized;
  -- an explicit incompatible profile is rejected without persisting a public subject.
  IF (NEW.subject_type IS NOT NULL AND NEW.subject_type<>'pairwise') OR NEW.user_id IS NOT NULL
   OR coalesce(NEW.skip_consent,false) OR coalesce(NEW.enable_end_session,false)
   OR NEW.backchannel_logout_uri IS NOT NULL OR coalesce(NEW.backchannel_logout_session_required,false)
   OR coalesce(cardinality(NEW.post_logout_redirect_uris),0)>0 OR NEW.require_pkce=false
  THEN RAISE EXCEPTION 'Client metadata is outside the admitted privacy profile' USING ERRCODE='23514',CONSTRAINT='oauth_client_private_profile'; END IF;
  IF NEW.reference_id IS NOT NULL THEN
   IF NEW.reference_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
   THEN RAISE EXCEPTION 'Managed client reference must identify its App' USING ERRCODE='23514',CONSTRAINT='oauth_client_private_profile'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.connected_app WHERE id=NEW.reference_id::uuid)
   THEN RAISE EXCEPTION 'Managed client reference must identify its App' USING ERRCODE='23514',CONSTRAINT='oauth_client_private_profile'; END IF;
   NEW.reference_id:=lower(NEW.reference_id);
  END IF;
  NEW.subject_type:='pairwise'; NEW.skip_consent:=false; NEW.enable_end_session:=false;
  NEW.backchannel_logout_session_required:=false; NEW.post_logout_redirect_uris:=NULL;
  NEW.metadata:=NULL; NEW.disabled:=coalesce(NEW.disabled,false); NEW.require_pkce:=true;
 END IF;
 IF TG_OP='INSERT' THEN
  INSERT INTO public.oauth_client_authority(id,client_id,discovery_id) VALUES(NEW.id,NEW.client_id,NEW.client_discovery_id);
  RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.id,NEW.client_id,NEW.client_discovery_id,NEW.reference_id,NEW.user_id,NEW.created_at)
   IS DISTINCT FROM ROW(OLD.id,OLD.client_id,OLD.client_discovery_id,OLD.reference_id,OLD.user_id,OLD.created_at)
  THEN RAISE EXCEPTION 'OAuth client identity and registration provenance are immutable' USING ERRCODE='55000'; END IF;
  IF (to_jsonb(NEW)-'updated_at') IS NOT DISTINCT FROM (to_jsonb(OLD)-'updated_at') THEN RETURN NEW; END IF;
  invalidating:=(NOT coalesce(OLD.disabled,false) AND NEW.disabled) OR
   ROW(NEW.scopes,NEW.client_credentials_scopes,NEW.redirect_uris,NEW.grant_types,NEW.response_types,NEW.token_endpoint_auth_method,NEW.require_pkce,NEW.dpop_bound_access_tokens)
   IS DISTINCT FROM ROW(OLD.scopes,OLD.client_credentials_scopes,OLD.redirect_uris,OLD.grant_types,OLD.response_types,OLD.token_endpoint_auth_method,OLD.require_pkce,OLD.dpop_bound_access_tokens);
 ELSE invalidating:=true;
 END IF;
 UPDATE public.oauth_client_authority SET version=version+1,
  credential_epoch=credential_epoch+CASE WHEN invalidating THEN 1 ELSE 0 END,
  revoked_at=CASE WHEN TG_OP='DELETE' THEN clock_timestamp() ELSE NULL END
 WHERE id=OLD.id AND revoked_at IS NULL;
 IF NOT FOUND THEN
  IF TG_OP<>'DELETE' OR NOT EXISTS(SELECT 1 FROM public.oauth_client_authority WHERE id=OLD.id AND revoked_at IS NOT NULL)
  THEN RAISE EXCEPTION 'OAuth client authority is unavailable or revoked' USING ERRCODE='23514'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS oauth_client_authority_guard ON public.oauth_client_authority;
CREATE TRIGGER oauth_client_authority_guard BEFORE INSERT OR UPDATE OR DELETE ON public.oauth_client_authority FOR EACH ROW EXECUTE FUNCTION public.guard_oauth_client_authority();
DROP TRIGGER IF EXISTS oauth_client_authority_fence ON public.oauth_client;
CREATE TRIGGER oauth_client_authority_fence BEFORE INSERT OR UPDATE OR DELETE ON public.oauth_client FOR EACH ROW EXECUTE FUNCTION public.fence_oauth_client_authority();
