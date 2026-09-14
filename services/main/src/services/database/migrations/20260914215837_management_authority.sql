SET search_path TO public;

CREATE OR REPLACE FUNCTION public.guard_api_key_authority()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Credential control identities are retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'Credential authority begins at version zero' USING ERRCODE='23514'; END IF;
 ELSIF ROW(NEW.id,NEW.user_id) IS DISTINCT FROM ROW(OLD.id,OLD.user_id) OR NEW.version<>OLD.version+1 OR OLD.revoked_at IS NOT NULL THEN
  RAISE EXCEPTION 'Credential owner is immutable and revocation is terminal' USING ERRCODE='55000';
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.fence_api_key_authority()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  PERFORM id FROM public.users WHERE id=NEW.reference_id AND principal_kind='human' AND erased_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Personal API keys require an unerased human principal' USING ERRCODE='23514'; END IF;
  INSERT INTO public.api_key_authority(id,user_id) VALUES(NEW.id,NEW.reference_id);
  RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.id,NEW.reference_id) IS DISTINCT FROM ROW(OLD.id,OLD.reference_id) THEN RAISE EXCEPTION 'Personal credential identities cannot change owners' USING ERRCODE='55000'; END IF;
  IF ROW(NEW.config_id,NEW.key,NEW.enabled,NEW.expires_at,NEW.permissions,NEW.metadata,NEW.rate_limit_enabled,NEW.rate_limit_time_window,NEW.rate_limit_max)
    IS NOT DISTINCT FROM ROW(OLD.config_id,OLD.key,OLD.enabled,OLD.expires_at,OLD.permissions,OLD.metadata,OLD.rate_limit_enabled,OLD.rate_limit_time_window,OLD.rate_limit_max) THEN RETURN NEW; END IF;
 END IF;
 UPDATE public.api_key_authority SET version=version+1,revoked_at=CASE WHEN TG_OP='DELETE' THEN clock_timestamp() ELSE NULL END
 WHERE id=OLD.id AND user_id=OLD.reference_id AND revoked_at IS NULL;
 IF NOT FOUND THEN
  -- Bounded erasure may remove an already logically revoked provider record.
  IF TG_OP<>'DELETE' OR NOT EXISTS(SELECT 1 FROM public.api_key_authority WHERE id=OLD.id AND user_id=OLD.reference_id AND revoked_at IS NOT NULL) THEN
   RAISE EXCEPTION 'Credential authority is missing or revoked' USING ERRCODE='23514';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS api_key_authority_guard ON public.api_key_authority;
CREATE TRIGGER api_key_authority_guard BEFORE INSERT OR UPDATE OR DELETE ON public.api_key_authority FOR EACH ROW EXECUTE FUNCTION public.guard_api_key_authority();
DROP TRIGGER IF EXISTS apikey_authority_fence ON public.apikeys;
CREATE TRIGGER apikey_authority_fence BEFORE INSERT OR UPDATE OR DELETE ON public.apikeys FOR EACH ROW EXECUTE FUNCTION public.fence_api_key_authority();


CREATE OR REPLACE FUNCTION public.access_subject_is_eligible(p_subject uuid,p_action text)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 WITH evaluated AS MATERIALIZED(SELECT clock_timestamp() AS now)
 SELECT CASE WHEN p_action IS NULL OR p_action NOT IN ('read','write','contribute') THEN NULL
  WHEN s.auth_user_id IS NOT NULL THEN EXISTS(
   SELECT 1 FROM public.users u CROSS JOIN evaluated WHERE u.id=s.auth_user_id AND u.erased_at IS NULL
    AND NOT EXISTS(SELECT 1 FROM public.user_account_state a WHERE a.user_id=u.id AND
     (a.state='closed' OR (a.state='suspended' AND (a.expires_at IS NULL OR NOT isfinite(a.expires_at) OR a.expires_at>evaluated.now))))
    AND (p_action='read' OR NOT EXISTS(SELECT 1 FROM public.account_enforcement e WHERE e.auth_user_id=u.id AND e.revocation_action_id IS NULL
     AND (e.kind IN ('ban','suspension') OR (p_action='contribute' AND e.kind='silence'))
     AND (NOT isfinite(e.starts_at) OR (e.expires_at IS NOT NULL AND NOT isfinite(e.expires_at)) OR
      (e.starts_at<=evaluated.now AND (e.expires_at IS NULL OR e.expires_at>evaluated.now)))))
  )
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
