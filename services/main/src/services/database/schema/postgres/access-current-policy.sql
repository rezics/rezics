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
