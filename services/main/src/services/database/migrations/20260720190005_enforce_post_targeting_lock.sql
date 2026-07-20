CREATE OR REPLACE FUNCTION protect_post_reply_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.post_id, OLD.root_post_id, OLD.parent_post_id, OLD.depth, OLD.created_at)
    IS DISTINCT FROM
    (NEW.post_id, NEW.root_post_id, NEW.parent_post_id, NEW.depth, NEW.created_at) THEN
    RAISE EXCEPTION 'post_reply identity is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION assert_post_targeting_allowed(
  p_source_post_id uuid,
  p_targets jsonb,
  p_explicit_realm_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  target_record record;
  realm_record record;
  target_locked boolean;
BEGIN
  IF p_targets IS NULL OR jsonb_array_length(p_targets) = 0 THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_source_post_id::text, 4));

  FOR target_record IN
    SELECT DISTINCT ON (target_id)
      target_id,
      relation
    FROM jsonb_to_recordset(p_targets) AS target(target_id uuid, relation text)
    ORDER BY
      target_id,
      CASE relation WHEN 'subject' THEN 0 WHEN 'root' THEN 1 WHEN 'parent' THEN 2 END
  LOOP
    SELECT target.post_targeting_locked
      INTO target_locked
      FROM public.unit AS target
      WHERE target.id = target_record.target_id
      FOR SHARE;
    IF target_locked THEN
      RAISE EXCEPTION 'Post target does not accept new Post relations'
        USING
          ERRCODE = '23514',
          CONSTRAINT = 'post_targeting_global_unlocked',
          DETAIL = jsonb_build_object(
            'scope', 'global',
            'relation', target_record.relation,
            'targetUnitId', target_record.target_id
          )::text;
    END IF;
  END LOOP;

  FOR realm_record IN
    SELECT realm_id
    FROM (
      SELECT source_realm.realm_id
      FROM public.realm_unit AS source_realm
      WHERE source_realm.unit_id = p_source_post_id
      UNION
      SELECT p_explicit_realm_id
      WHERE p_explicit_realm_id IS NOT NULL
    ) AS source_realms
    ORDER BY realm_id
  LOOP
    FOR target_record IN
      SELECT DISTINCT ON (target_id)
        target_id,
        relation
      FROM jsonb_to_recordset(p_targets) AS target(target_id uuid, relation text)
      ORDER BY
        target_id,
        CASE relation WHEN 'subject' THEN 0 WHEN 'root' THEN 1 WHEN 'parent' THEN 2 END
    LOOP
      SELECT realm_target.post_targeting_locked
        INTO target_locked
        FROM public.realm_unit AS realm_target
        WHERE realm_target.realm_id = realm_record.realm_id
          AND realm_target.unit_id = target_record.target_id
        FOR SHARE;
      IF target_locked THEN
        RAISE EXCEPTION 'Post target does not accept new Post relations in this Realm'
          USING
            ERRCODE = '23514',
            CONSTRAINT = 'post_targeting_realm_unlocked',
            DETAIL = jsonb_build_object(
              'scope', 'realm',
              'relation', target_record.relation,
              'targetUnitId', target_record.target_id,
              'realmId', realm_record.realm_id
            )::text;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

CREATE FUNCTION enforce_post_subject_targeting() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.subject_unit_id IS NOT NULL THEN
      PERFORM public.assert_post_targeting_allowed(
        NEW.id,
        jsonb_build_array(jsonb_build_object(
          'target_id', NEW.subject_unit_id,
          'relation', 'subject'
        ))
      );
    END IF;
  ELSIF NEW.subject_unit_id IS DISTINCT FROM OLD.subject_unit_id
    AND NEW.subject_unit_id IS NOT NULL THEN
    PERFORM public.assert_post_targeting_allowed(
      NEW.id,
      jsonb_build_array(jsonb_build_object(
        'target_id', NEW.subject_unit_id,
        'relation', 'subject'
      ))
    );
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER post_subject_targeting_enforce
AFTER INSERT OR UPDATE OF subject_unit_id ON post
FOR EACH ROW EXECUTE FUNCTION enforce_post_subject_targeting();

CREATE FUNCTION enforce_post_reply_targeting() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  targets jsonb;
  should_check boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    should_check := true;
  ELSE
    should_check :=
      NEW.root_post_id IS DISTINCT FROM OLD.root_post_id OR
      NEW.parent_post_id IS DISTINCT FROM OLD.parent_post_id;
  END IF;

  IF should_check THEN
    targets := jsonb_build_array(jsonb_build_object(
      'target_id', NEW.root_post_id,
      'relation', 'root'
    ));
    IF NEW.parent_post_id IS NOT NULL THEN
      targets := targets || jsonb_build_array(jsonb_build_object(
        'target_id', NEW.parent_post_id,
        'relation', 'parent'
      ));
    END IF;
    PERFORM public.assert_post_targeting_allowed(NEW.post_id, targets);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER post_reply_targeting_enforce
AFTER INSERT OR UPDATE OF root_post_id, parent_post_id ON post_reply
FOR EACH ROW EXECUTE FUNCTION enforce_post_reply_targeting();

CREATE FUNCTION enforce_post_realm_mount_targeting() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  targets jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(target), '[]'::jsonb)
    INTO targets
    FROM (
      SELECT jsonb_build_object(
        'target_id', stored_post.subject_unit_id,
        'relation', 'subject'
      ) AS target
      FROM public.post AS stored_post
      WHERE stored_post.id = NEW.unit_id
        AND stored_post.subject_unit_id IS NOT NULL

      UNION ALL

      SELECT jsonb_build_object(
        'target_id', stored_reply.root_post_id,
        'relation', 'root'
      )
      FROM public.post_reply AS stored_reply
      WHERE stored_reply.post_id = NEW.unit_id

      UNION ALL

      SELECT jsonb_build_object(
        'target_id', stored_reply.parent_post_id,
        'relation', 'parent'
      )
      FROM public.post_reply AS stored_reply
      WHERE stored_reply.post_id = NEW.unit_id
        AND stored_reply.parent_post_id IS NOT NULL
    ) AS post_targets;

  IF jsonb_array_length(targets) > 0 THEN
    PERFORM public.assert_post_targeting_allowed(NEW.unit_id, targets, NEW.realm_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER post_realm_mount_targeting_enforce
AFTER INSERT OR UPDATE OF realm_id, unit_id ON realm_unit
FOR EACH ROW EXECUTE FUNCTION enforce_post_realm_mount_targeting();
