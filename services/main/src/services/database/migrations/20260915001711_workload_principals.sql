SET search_path TO public;

CREATE TABLE "workload_principal" (
	"auth_user_id" uuid PRIMARY KEY,
	"owner_scope_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"system_key" text,
	"version" bigint DEFAULT 0 NOT NULL,
	"credential_epoch" bigint DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "workload_principal_purpose_check" CHECK (("purpose"='installation' and "system_key" is null) or ("purpose"='system' and "system_key" is not null and "system_key" ~ '^[a-z][a-z0-9-]{0,63}$')),
	CONSTRAINT "workload_principal_version_check" CHECK ("version" between 0 and 9007199254740991 and "credential_epoch" between 0 and "version" and ("version"=0 or "credential_epoch">0)),
	CONSTRAINT "workload_principal_state_check" CHECK (("state"='draft' and "version"=0) or ("state" in ('active','suspended','revoked') and "version">0))
);

CREATE TABLE "workload_principal_event" (
	"auth_user_id" uuid,
	"version" bigint,
	"operation_id" uuid NOT NULL,
	"request_digest" text NOT NULL,
	"operation" text NOT NULL,
	"state_after" text NOT NULL,
	"credential_epoch_after" bigint NOT NULL,
	"label" text NOT NULL,
	"operator_auth_user_id" uuid NOT NULL,
	"authority_subject_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workload_principal_event_pkey" PRIMARY KEY("auth_user_id","version"),
	CONSTRAINT "workload_principal_event_version_check" CHECK ("version" between 1 and 9007199254740991 and "credential_epoch_after" between 1 and "version"),
	CONSTRAINT "workload_principal_event_digest_check" CHECK ("request_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "workload_principal_event_operation_check" CHECK ("operation" in ('create', 'rename', 'suspend', 'resume', 'revoke')),
	CONSTRAINT "workload_principal_event_state_check" CHECK ("state_after" in ('active', 'suspended', 'revoked')),
	CONSTRAINT "workload_principal_event_label_check" CHECK (length(btrim("label"))>0 and octet_length("label")<=512)
);

CREATE UNIQUE INDEX "workload_principal_scope_key" ON "workload_principal" ("auth_user_id","owner_scope_id");
CREATE UNIQUE INDEX "workload_principal_system_key" ON "workload_principal" ("system_key") WHERE "system_key" is not null;
CREATE INDEX "workload_principal_owner_idx" ON "workload_principal" ("owner_scope_id","auth_user_id");
CREATE UNIQUE INDEX "workload_principal_event_operation_key" ON "workload_principal_event" ("auth_user_id","operation_id");
ALTER TABLE "workload_principal" ADD CONSTRAINT "workload_principal_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "workload_principal" ADD CONSTRAINT "workload_principal_owner_scope_id_access_scope_id_fkey" FOREIGN KEY ("owner_scope_id") REFERENCES "access_scope"("id") ON DELETE RESTRICT;
ALTER TABLE "workload_principal_event" ADD CONSTRAINT "workload_principal_event_9gOAlB09eo68_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "workload_principal"("auth_user_id") ON DELETE RESTRICT;
ALTER TABLE "workload_principal_event" ADD CONSTRAINT "workload_principal_event_operator_auth_user_id_users_id_fkey" FOREIGN KEY ("operator_auth_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "workload_principal_event" ADD CONSTRAINT "workload_principal_event_pMb05S2O8hXQ_fkey" FOREIGN KEY ("authority_subject_id") REFERENCES "access_subject"("id") ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.guard_workload_principal()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE event public.workload_principal_event%ROWTYPE; erased timestamptz; owner_entity uuid;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Workload identities and history are retained' USING ERRCODE='55000'; END IF;
 SELECT erased_at INTO erased FROM public.users WHERE id=NEW.auth_user_id AND principal_kind='service' FOR UPDATE;
 IF NOT FOUND OR (erased IS NOT NULL AND (TG_OP='INSERT' OR NEW.state<>'revoked'))
 THEN RAISE EXCEPTION 'Workloads require a service principal; erased principals may only be revoked' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.credential_epoch<>0 OR NEW.state<>'draft' THEN RAISE EXCEPTION 'Workload admission starts at version zero' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.access_scope s LEFT JOIN public.reference_value r ON r.id=s.unit_ref
   LEFT JOIN public.users a ON a.id=s.auth_user_id LEFT JOIN public.entity_identity e ON e.id=r.target_entity_id
   WHERE s.id=NEW.owner_scope_id AND ((NEW.purpose='system' AND s.platform_root='platform') OR
    (NEW.purpose='installation' AND (a.principal_kind='human' OR (e.shape='organization') OR r.target_realm_id IS NOT NULL))))
  THEN RAISE EXCEPTION 'Workload purpose and owner scope are incompatible' USING ERRCODE='23514'; END IF;
  SELECT r.target_entity_id INTO owner_entity FROM public.access_scope s JOIN public.reference_value r ON r.id=s.unit_ref WHERE s.id=NEW.owner_scope_id;
  IF owner_entity IS NOT NULL THEN
   PERFORM id FROM public.entity_identity WHERE id=owner_entity AND shape='organization' FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Workload owner must remain an organization' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.auth_user_id,NEW.owner_scope_id,NEW.purpose,NEW.system_key) IS DISTINCT FROM ROW(OLD.auth_user_id,OLD.owner_scope_id,OLD.purpose,OLD.system_key)
  OR OLD.state='revoked' OR NEW.version<>OLD.version+1
 THEN RAISE EXCEPTION 'Workload owner, purpose and terminal revocation are immutable' USING ERRCODE='55000'; END IF;
 SELECT * INTO event FROM public.workload_principal_event WHERE auth_user_id=NEW.auth_user_id AND version=NEW.version;
 IF NOT FOUND OR ROW(NEW.state,NEW.credential_epoch) IS DISTINCT FROM ROW(event.state_after,event.credential_epoch_after)
 THEN RAISE EXCEPTION 'Workload control requires its exact receipt' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_workload_principal_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.workload_principal%ROWTYPE; actor_id uuid; expected_state text; expected_epoch bigint; prior_label text;
BEGIN
 PERFORM id FROM public.users WHERE id=NEW.auth_user_id FOR UPDATE;
 SELECT * INTO head FROM public.workload_principal WHERE auth_user_id=NEW.auth_user_id FOR UPDATE;
 IF NOT FOUND OR head.state='revoked' OR NEW.version<>head.version+1 THEN RAISE EXCEPTION 'Workload receipt is stale or revoked' USING ERRCODE='23514'; END IF;
 SELECT auth_user_id INTO actor_id FROM public.access_subject WHERE id=NEW.authority_subject_id;
 IF NOT FOUND OR (actor_id IS NOT NULL AND actor_id<>NEW.operator_auth_user_id)
 THEN RAISE EXCEPTION 'Workload authority subject does not match its operator' USING ERRCODE='23514'; END IF;
 expected_state:=head.state; expected_epoch:=head.credential_epoch;
 IF NEW.operation='create' THEN
  IF head.version<>0 THEN RAISE EXCEPTION 'Workload already exists' USING ERRCODE='23514'; END IF;
  expected_state:=CASE WHEN head.purpose='system' THEN 'active' ELSE 'suspended' END; expected_epoch:=1;
 ELSE
  IF head.version=0 THEN RAISE EXCEPTION 'Workload admission is incomplete' USING ERRCODE='23514'; END IF;
  SELECT label INTO prior_label FROM public.workload_principal_event WHERE auth_user_id=head.auth_user_id AND version=head.version;
  IF NEW.operation<>'rename' AND NEW.label IS DISTINCT FROM prior_label THEN RAISE EXCEPTION 'Lifecycle changes retain workload presentation' USING ERRCODE='23514'; END IF;
  IF NEW.operation='suspend' THEN
   IF head.state<>'active' THEN RAISE EXCEPTION 'Only an active workload can be suspended' USING ERRCODE='23514'; END IF;
   expected_state:='suspended'; expected_epoch:=expected_epoch+1;
  ELSIF NEW.operation='resume' THEN
   IF head.state<>'suspended' THEN RAISE EXCEPTION 'Only a suspended workload can resume' USING ERRCODE='23514'; END IF;
   expected_state:='active';
  ELSIF NEW.operation='revoke' THEN expected_state:='revoked'; expected_epoch:=expected_epoch+1;
  END IF;
 END IF;
 IF ROW(NEW.state_after,NEW.credential_epoch_after) IS DISTINCT FROM ROW(expected_state,expected_epoch)
 THEN RAISE EXCEPTION 'Workload transition does not match its operation' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.complete_workload_principal()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.workload_principal%ROWTYPE; event public.workload_principal_event%ROWTYPE;
BEGIN
 SELECT * INTO head FROM public.workload_principal WHERE auth_user_id=NEW.auth_user_id;
 IF NOT FOUND OR head.version=0 THEN RAISE EXCEPTION 'Workload admission must complete its first receipt' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='workload_principal_event' THEN
  IF head.version<NEW.version THEN RAISE EXCEPTION 'Workload receipt must advance its head' USING ERRCODE='23514'; END IF;
 ELSIF NEW.version>0 THEN
  SELECT * INTO event FROM public.workload_principal_event WHERE auth_user_id=NEW.auth_user_id AND version=NEW.version;
  IF NOT FOUND OR ROW(NEW.state,NEW.credential_epoch) IS DISTINCT FROM ROW(event.state_after,event.credential_epoch_after)
  THEN RAISE EXCEPTION 'Workload history must preserve every transition' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS workload_principal_guard ON public.workload_principal;
CREATE TRIGGER workload_principal_guard BEFORE INSERT OR UPDATE OR DELETE ON public.workload_principal FOR EACH ROW EXECUTE FUNCTION public.guard_workload_principal();
DROP TRIGGER IF EXISTS workload_principal_event_guard ON public.workload_principal_event;
CREATE TRIGGER workload_principal_event_guard BEFORE INSERT ON public.workload_principal_event FOR EACH ROW EXECUTE FUNCTION public.guard_workload_principal_event();
DROP TRIGGER IF EXISTS workload_principal_event_immutable ON public.workload_principal_event;
CREATE TRIGGER workload_principal_event_immutable BEFORE UPDATE OR DELETE ON public.workload_principal_event FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
DROP TRIGGER IF EXISTS workload_principal_complete ON public.workload_principal;
CREATE CONSTRAINT TRIGGER workload_principal_complete AFTER INSERT OR UPDATE ON public.workload_principal DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_workload_principal();
DROP TRIGGER IF EXISTS workload_principal_event_complete ON public.workload_principal_event;
CREATE CONSTRAINT TRIGGER workload_principal_event_complete AFTER INSERT ON public.workload_principal_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_workload_principal();


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

CREATE OR REPLACE FUNCTION public.workload_principal_is_eligible(p_principal uuid,p_action text)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 SELECT CASE WHEN p_action IS NULL OR p_action NOT IN ('read','write','contribute') THEN NULL ELSE EXISTS(
  SELECT 1 FROM public.workload_principal w JOIN public.access_scope s ON s.id=w.owner_scope_id
   LEFT JOIN public.reference_value r ON r.id=s.unit_ref LEFT JOIN public.users a ON a.id=s.auth_user_id
   LEFT JOIN public.entity_identity e ON e.id=r.target_entity_id LEFT JOIN public.entity_participation ep ON ep.entity_id=e.id
   LEFT JOIN public.realm realm ON realm.id=r.target_realm_id
  WHERE w.auth_user_id=p_principal AND w.state='active' AND w.version>0 AND (
   (w.purpose='system' AND s.platform_root='platform') OR (w.purpose='installation' AND (
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


-- Private account admission and immutable public-participation evidence.
CREATE OR REPLACE FUNCTION public.participation_guard_self_binding()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE account_kind text; identity_shape text; erased timestamptz;
BEGIN
  SELECT principal_kind, erased_at INTO account_kind, erased FROM public.users WHERE id = NEW.auth_user_id FOR SHARE;
  SELECT shape INTO identity_shape FROM public.entity_identity WHERE id = NEW.entity_id FOR SHARE;
  IF account_kind IS DISTINCT FROM 'human' OR identity_shape IS DISTINCT FROM 'person' OR erased IS NOT NULL THEN
    RAISE EXCEPTION 'Self participation requires an active human account and a person identity' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.auth_user_id <> OLD.auth_user_id OR NEW.entity_id <> OLD.entity_id OR NEW.revision <> OLD.revision + 1) THEN
    RAISE EXCEPTION 'Self identity is immutable and authorization revisions must advance exactly once' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_self_binding_guard ON public.auth_entity;
CREATE TRIGGER participation_self_binding_guard BEFORE INSERT OR UPDATE ON public.auth_entity
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_self_binding();

CREATE OR REPLACE FUNCTION public.participation_guard_account_kind()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.principal_kind IS DISTINCT FROM OLD.principal_kind THEN
    RAISE EXCEPTION 'A principal cannot change its authentication kind' USING ERRCODE = '23514';
  END IF;
  IF OLD.erased_at IS NOT NULL AND (NEW.erased_at IS DISTINCT FROM OLD.erased_at OR NEW.name <> '' OR NEW.image IS NOT NULL OR NEW.email_verified OR NEW.email IS DISTINCT FROM OLD.email OR NEW.principal_kind <> OLD.principal_kind) THEN
    RAISE EXCEPTION 'Erased authentication accounts cannot be restored' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_account_kind_guard ON public.users;
CREATE TRIGGER participation_account_kind_guard BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_account_kind();

CREATE OR REPLACE FUNCTION public.participation_guard_entity_shape()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.shape IS DISTINCT FROM OLD.shape AND current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'Entity shape admission requires READ COMMITTED for current dependent identities' USING ERRCODE='40001';
  END IF;
  IF NEW.shape <> OLD.shape AND
     (EXISTS(SELECT 1 FROM public.auth_entity WHERE entity_id = OLD.id) OR EXISTS(SELECT 1 FROM public.service_principal WHERE entity_id = OLD.id)
      OR EXISTS(SELECT 1 FROM public.reference_value r JOIN public.access_scope s ON s.unit_ref=r.id
       JOIN public.workload_principal w ON w.owner_scope_id=s.id WHERE r.target_entity_id=OLD.id)) THEN
    RAISE EXCEPTION 'An admitted participant cannot change identity shape' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_entity_shape_guard ON public.entity_identity;
CREATE TRIGGER participation_entity_shape_guard BEFORE UPDATE OF shape ON public.entity_identity
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_entity_shape();

CREATE OR REPLACE FUNCTION public.participation_guard_service()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE account_kind text; identity_shape text;
BEGIN
  SELECT principal_kind INTO account_kind FROM public.users WHERE id = NEW.auth_user_id FOR SHARE;
  SELECT shape INTO identity_shape FROM public.entity_identity WHERE id = NEW.entity_id FOR SHARE;
  IF account_kind IS DISTINCT FROM 'service' OR identity_shape IS DISTINCT FROM 'service_actor' THEN
    RAISE EXCEPTION 'Machine credentials require a distinct service principal and service actor' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.auth_user_id <> OLD.auth_user_id OR NEW.entity_id <> OLD.entity_id OR
     NEW.created_by_auth_user_id IS DISTINCT FROM OLD.created_by_auth_user_id OR NEW.revision <> OLD.revision + 1 OR OLD.revoked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Service identity is immutable and revoked credentials cannot be restored' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_service_guard ON public.service_principal;
CREATE TRIGGER participation_service_guard BEFORE INSERT OR UPDATE ON public.service_principal
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_service();

CREATE OR REPLACE FUNCTION public.participation_guard_grant()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Participation grants retain their immutable scope and revocation history' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND ((to_jsonb(NEW) - ARRAY['revision','revoked_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['revision','revoked_at']) OR
     NEW.revision <> OLD.revision + 1 OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'Only a consecutive, one-way grant revocation is permitted' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_grant_guard ON public.participation_grant;
CREATE TRIGGER participation_grant_guard BEFORE UPDATE OR DELETE ON public.participation_grant
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_grant();

CREATE OR REPLACE FUNCTION public.participation_require_grant_event()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.participation_grant_event WHERE grant_id = NEW.id AND revision = NEW.revision) THEN
    RAISE EXCEPTION 'Every participation authorization revision requires immutable operator evidence' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_grant_event_required ON public.participation_grant;
CREATE CONSTRAINT TRIGGER participation_grant_event_required AFTER INSERT OR UPDATE ON public.participation_grant
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.participation_require_grant_event();

CREATE OR REPLACE FUNCTION public.participation_guard_immutable_evidence()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'Participation evidence is immutable' USING ERRCODE = '23514';
END $$;
DROP TRIGGER IF EXISTS participation_grant_event_immutable ON public.participation_grant_event;
CREATE TRIGGER participation_grant_event_immutable BEFORE UPDATE OR DELETE ON public.participation_grant_event
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_immutable_evidence();
DROP TRIGGER IF EXISTS entity_recovery_event_immutable ON public.entity_recovery_event;
CREATE TRIGGER entity_recovery_event_immutable BEFORE UPDATE OR DELETE ON public.entity_recovery_event
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_immutable_evidence();
DROP TRIGGER IF EXISTS entity_presentation_revision_immutable ON public.entity_presentation_revision;
CREATE TRIGGER entity_presentation_revision_immutable BEFORE UPDATE OR DELETE ON public.entity_presentation_revision
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_immutable_evidence();

CREATE OR REPLACE FUNCTION public.participation_guard_presentation()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND (NEW.entity_id <> OLD.entity_id OR NEW.language <> OLD.language OR NEW.revision <> OLD.revision + 1)) THEN
    RAISE EXCEPTION 'Entity presentation identities are retained and revisions advance exactly once' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS entity_presentation_guard ON public.entity_presentation;
CREATE TRIGGER entity_presentation_guard BEFORE UPDATE OR DELETE ON public.entity_presentation
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_presentation();

CREATE OR REPLACE FUNCTION public.participation_require_presentation_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.entity_presentation_revision WHERE entity_id = NEW.entity_id AND language = NEW.language AND revision = NEW.revision) THEN
    RAISE EXCEPTION 'Entity presentation requires its immutable revision' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS entity_presentation_revision_required ON public.entity_presentation;
CREATE CONSTRAINT TRIGGER entity_presentation_revision_required AFTER INSERT OR UPDATE ON public.entity_presentation
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.participation_require_presentation_revision();

CREATE OR REPLACE FUNCTION public.participation_require_unerased_account()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE subject_id uuid; erased timestamptz;
BEGIN
  subject_id := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
  IF subject_id IS NULL THEN RETURN NEW; END IF;
  SELECT erased_at INTO erased FROM public.users WHERE id = subject_id FOR SHARE;
  IF NOT FOUND OR erased IS NOT NULL THEN
    RAISE EXCEPTION 'An erased account cannot create new private state' USING ERRCODE = '23514', CONSTRAINT = 'active_account_required';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.sessions;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF user_id ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.accounts;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF user_id ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.apikeys;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF reference_id ON public.apikeys
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('reference_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.account_preference;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.account_preference
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.notification;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF recipient_auth_user_id ON public.notification
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('recipient_auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.notification_preference;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.notification_preference
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.notification_recipient_stat;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.notification_recipient_stat
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.unit_progress;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.unit_progress
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.unit_progress_entry;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.unit_progress_entry
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.content_structure_node_progress;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.content_structure_node_progress
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.unit_access_grant;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.unit_access_grant
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.unit_access_restriction;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.unit_access_restriction
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.unit_access_invitation;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF invited_auth_user_id ON public.unit_access_invitation
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('invited_auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.platform_capability_grant;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.platform_capability_grant
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.account_enforcement;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.account_enforcement
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_evidence_truncate_guard ON public.participation_grant;
CREATE TRIGGER participation_evidence_truncate_guard BEFORE TRUNCATE ON public.participation_grant
FOR EACH STATEMENT EXECUTE FUNCTION public.participation_guard_immutable_evidence();

DROP TRIGGER IF EXISTS participation_evidence_truncate_guard ON public.participation_grant_event;
CREATE TRIGGER participation_evidence_truncate_guard BEFORE TRUNCATE ON public.participation_grant_event
FOR EACH STATEMENT EXECUTE FUNCTION public.participation_guard_immutable_evidence();

DROP TRIGGER IF EXISTS participation_evidence_truncate_guard ON public.entity_recovery_event;
CREATE TRIGGER participation_evidence_truncate_guard BEFORE TRUNCATE ON public.entity_recovery_event
FOR EACH STATEMENT EXECUTE FUNCTION public.participation_guard_immutable_evidence();

DROP TRIGGER IF EXISTS participation_evidence_truncate_guard ON public.entity_presentation_revision;
CREATE TRIGGER participation_evidence_truncate_guard BEFORE TRUNCATE ON public.entity_presentation_revision
FOR EACH STATEMENT EXECUTE FUNCTION public.participation_guard_immutable_evidence();
