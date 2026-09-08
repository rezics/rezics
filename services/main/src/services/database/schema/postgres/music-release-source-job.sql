-- Persisted queue authority remains a concrete account/entity/grant fact, not an opaque JSON assertion.
CREATE OR REPLACE FUNCTION public.music_release_source_job_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE a uuid; e uuid; g uuid; s uuid; r bigint; gr bigint; principal_kind text;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF (NEW.source_record_id,NEW.id,NEW.proposal_id,NEW.snapshot_id,NEW.action,NEW.reason,NEW.created_at) IS DISTINCT FROM
     (OLD.source_record_id,OLD.id,OLD.proposal_id,OLD.snapshot_id,OLD.action,OLD.reason,OLD.created_at) THEN
   RAISE EXCEPTION 'Release job admission is immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.generation < OLD.generation OR NEW.generation > OLD.generation+1 THEN
   RAISE EXCEPTION 'Release job generation must remain current or advance once' USING ERRCODE='23514';
  END IF;
  IF NEW.authority IS DISTINCT FROM OLD.authority AND NOT
     (NEW.generation=OLD.generation+1 AND (NEW.state='paused' OR (OLD.state IN ('paused','failed') AND NEW.state IN ('queued','prepared')))) THEN
   RAISE EXCEPTION 'Release job authority changes only during an explicit control generation' USING ERRCODE='23514';
  END IF;
  IF OLD.preparation IS NOT NULL AND NEW.preparation IS DISTINCT FROM OLD.preparation THEN
   RAISE EXCEPTION 'Prepared release evidence is immutable' USING ERRCODE='23514';
  END IF;
  IF OLD.music_id IS NOT NULL AND NEW.music_id IS DISTINCT FROM OLD.music_id THEN
   RAISE EXCEPTION 'Release job native target is immutable' USING ERRCODE='23514';
  END IF;
 END IF;
 IF TG_OP='INSERT' OR NEW.authority IS DISTINCT FROM OLD.authority THEN
  a := (NEW.authority->'principal'->>'authUserId')::uuid;
  e := (NEW.authority->>'actingEntityId')::uuid;
  g := (NEW.authority->'grant'->>'id')::uuid;
  s := (NEW.authority->'principal'->>'servicePrincipalId')::uuid;
  r := (NEW.authority->>'authorizationRevision')::bigint;
  gr := (NEW.authority->'grant'->>'revision')::bigint;
  principal_kind := NEW.authority->'principal'->>'kind';
  IF a IS NULL OR e IS NULL OR r IS NULL OR r<1 OR principal_kind NOT IN ('auth','service') THEN
   RAISE EXCEPTION 'Invalid release job authority' USING ERRCODE='23514';
  END IF;
  PERFORM 1 FROM public.users u JOIN public.entity_participation p ON p.entity_id=e
   WHERE u.id=a AND u.erased_at IS NULL AND p.state='active' FOR SHARE OF u,p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Release job authority is unavailable' USING ERRCODE='23514'; END IF;
  IF principal_kind='auth' THEN
   PERFORM 1 FROM public.auth_entity x WHERE x.auth_user_id=a AND x.state='active' AND x.revision=r
    AND (g IS NOT NULL OR x.entity_id=e) FOR SHARE;
   IF NOT FOUND OR s IS NOT NULL THEN RAISE EXCEPTION 'Release job account authority differs' USING ERRCODE='23514'; END IF;
  ELSE
   PERFORM 1 FROM public.service_principal x WHERE x.id=s AND x.auth_user_id=a AND x.entity_id=e AND x.revision=r AND x.revoked_at IS NULL FOR SHARE;
   IF NOT FOUND OR g IS NULL THEN RAISE EXCEPTION 'Release job service authority differs' USING ERRCODE='23514'; END IF;
  END IF;
  IF g IS NOT NULL THEN
   PERFORM 1 FROM public.participation_grant x WHERE x.id=g AND x.revision=gr AND x.acting_entity_id=e
    AND ((principal_kind='auth' AND x.auth_user_id=a) OR (principal_kind='service' AND x.service_principal_id=s))
    AND x.capability='proposal.adopt' AND x.proposal_source_record_id=NEW.source_record_id AND x.proposal_id=NEW.proposal_id
    AND x.music_id=NEW.music_id AND x.revoked_at IS NULL AND (x.expires_at IS NULL OR x.expires_at>clock_timestamp()) FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Release job proposal grant differs' USING ERRCODE='23514'; END IF;
  END IF;
  IF NEW.action='initialize' AND (principal_kind<>'auth' OR g IS NOT NULL) THEN
   RAISE EXCEPTION 'Release intake requires direct account authority' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_release_source_job_guard_trigger ON public.music_release_source_job;
CREATE TRIGGER music_release_source_job_guard_trigger BEFORE INSERT OR UPDATE ON public.music_release_source_job FOR EACH ROW EXECUTE FUNCTION public.music_release_source_job_guard();
