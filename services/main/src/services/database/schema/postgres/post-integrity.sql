-- Native owner integrity and derived state. This file is the canonical forward-maintained source.
CREATE OR REPLACE FUNCTION public.apply_post_reply_stat_delta(p_root_post_id uuid, p_parent_post_id uuid, p_undeleted_delta bigint, p_visible_delta bigint)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  IF p_undeleted_delta = 0 AND p_visible_delta = 0 THEN
    RETURN;
  END IF;

  UPDATE post_reply_stat SET
    undeleted_direct_count = undeleted_direct_count
      + CASE WHEN p_parent_post_id = p_root_post_id THEN p_undeleted_delta ELSE 0 END,
    undeleted_descendant_count = undeleted_descendant_count + p_undeleted_delta,
    visible_direct_count = visible_direct_count
      + CASE WHEN p_parent_post_id = p_root_post_id THEN p_visible_delta ELSE 0 END,
    visible_descendant_count = visible_descendant_count + p_visible_delta,
    updated_at = now()
  WHERE post_id = p_root_post_id;
  IF NOT FOUND AND EXISTS (SELECT 1 FROM post WHERE id = p_root_post_id) THEN
    RAISE EXCEPTION 'missing post_reply_stat row for root %', p_root_post_id
      USING ERRCODE = '23514';
  END IF;

  IF p_parent_post_id IS NOT NULL AND p_parent_post_id <> p_root_post_id THEN
    UPDATE post_reply_stat SET
      undeleted_direct_count = undeleted_direct_count + p_undeleted_delta,
      visible_direct_count = visible_direct_count + p_visible_delta,
      updated_at = now()
    WHERE post_id = p_parent_post_id;
    IF NOT FOUND AND EXISTS (SELECT 1 FROM post WHERE id = p_parent_post_id) THEN
      RAISE EXCEPTION 'missing post_reply_stat row for parent %', p_parent_post_id
        USING ERRCODE = '23514';
    END IF;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assert_post_targeting_allowed(p_source_post_id uuid, p_targets jsonb, p_explicit_realm_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  target_record record;
  realm_record record;
  target_locked boolean; target_state record;
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
    SELECT * INTO target_state FROM public.read_unit_state(target_record.target_id);
    target_locked:=false;
    IF target_state.owner=ANY(ARRAY['post','video','audio','poll','zone','realm','realm_rule','custom_theme','collection','tag','tag_path','label']) THEN
      EXECUTE format('SELECT post_targeting_locked FROM public.%I WHERE id=$1 FOR SHARE',target_state.owner) INTO target_locked USING target_record.target_id;
    END IF;
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
        AND source_realm.publication_state = 'active'
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
          AND realm_target.publication_state = 'active'
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
$function$;

CREATE OR REPLACE FUNCTION public.enforce_post_realm_mount_targeting()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.enforce_post_reply_targeting()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.enforce_post_subject_targeting()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.enforce_realm_tag_context_wiki_post()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "post"
    WHERE "post"."id" = NEW."context_post_id"
      AND "post"."kind" = 'wiki'
  ) THEN
    RAISE EXCEPTION 'Realm Tag Context Post % must be a Wiki Post', NEW."context_post_id"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_realm_taxonomy_tag_query_strategy()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE
  is_realm_taxonomy_tag boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM "content_structure"
    INNER JOIN "tag" ON "tag"."id" = NEW."content_unit_id"
    WHERE "content_structure"."id" = NEW."structure_id"
      AND "content_structure"."kind" = 'realm.taxonomy'
  ) INTO is_realm_taxonomy_tag;

  IF is_realm_taxonomy_tag AND NEW."realm_tag_query_strategy" IS NULL THEN
    NEW."realm_tag_query_strategy" := 'global_effective';
  ELSIF NOT is_realm_taxonomy_tag AND NEW."realm_tag_query_strategy" IS NOT NULL THEN
    RAISE EXCEPTION
      'Realm Tag query strategy is only valid for Realm taxonomy Tag nodes'
      USING ERRCODE = '23514';
  END IF;
  IF is_realm_taxonomy_tag AND NEW."deleted_at" IS NULL AND EXISTS (
    SELECT 1
    FROM "content_structure_node" AS existing
    WHERE existing."structure_id" = NEW."structure_id"
      AND existing."content_unit_id" = NEW."content_unit_id"
      AND existing."deleted_at" IS NULL
      AND existing."id" <> NEW."id"
  ) THEN
    RAISE EXCEPTION
      'A Realm taxonomy can contain a Tag only once'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_wiki_association_context_post()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  IF NEW.context_post_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM post
    WHERE id = NEW.context_post_id
      AND kind = 'wiki'::post_kind
  ) THEN
    RAISE EXCEPTION 'association context post % must be a wiki Post', NEW.context_post_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.initialize_post_reply_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  INSERT INTO post_reply_stat (post_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_post_reply_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE reply_unit public.post%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO STRICT reply_unit FROM public.post WHERE id = NEW.post_id;
    PERFORM apply_post_reply_stat_delta(
      NEW.root_post_id,
      NEW.parent_post_id,
      (reply_unit.deleted_at IS NULL)::int,
      (reply_unit.deleted_at IS NULL AND reply_unit.status = 'published'
        AND reply_unit.visibility = 'public'
        AND reply_unit.moderation_status = 'approved')::int
    );
    IF reply_unit.deleted_at IS NULL THEN
      PERFORM apply_unit_engagement_stat(NEW.root_post_id, p_replies => 1);
      IF NEW.parent_post_id IS NOT NULL THEN
        PERFORM apply_unit_engagement_stat(NEW.parent_post_id, p_replies => 1);
      END IF;
    END IF;
    PERFORM apply_recommendation_unit_signal(NEW.root_post_id, NEW.created_at, 'reply', 1, 4);
    IF NEW.parent_post_id IS NOT NULL THEN
      PERFORM apply_recommendation_unit_signal(
        NEW.parent_post_id, NEW.created_at, 'reply', 1, 4
      );
    END IF;
  ELSIF TG_OP = 'DELETE' AND EXISTS (SELECT 1 FROM public.post WHERE id = OLD.post_id) THEN
    SELECT * INTO STRICT reply_unit FROM public.post WHERE id = OLD.post_id;
    PERFORM apply_post_reply_stat_delta(
      OLD.root_post_id,
      OLD.parent_post_id,
      -(reply_unit.deleted_at IS NULL)::int,
      -(reply_unit.deleted_at IS NULL AND reply_unit.status = 'published'
        AND reply_unit.visibility = 'public'
        AND reply_unit.moderation_status = 'approved')::int
    );
    IF reply_unit.deleted_at IS NULL THEN
      PERFORM apply_unit_engagement_stat(OLD.root_post_id, p_replies => -1);
      IF OLD.parent_post_id IS NOT NULL THEN
        PERFORM apply_unit_engagement_stat(OLD.parent_post_id, p_replies => -1);
      END IF;
    END IF;
    PERFORM apply_recommendation_unit_signal(OLD.root_post_id, OLD.created_at, 'reply', -1, -4);
    IF OLD.parent_post_id IS NOT NULL THEN
      PERFORM apply_recommendation_unit_signal(
        OLD.parent_post_id, OLD.created_at, 'reply', -1, -4
      );
    END IF;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_association_context_post_kind()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  IF OLD.kind = 'wiki'::post_kind
    AND NEW.kind <> 'wiki'::post_kind
    AND (
      EXISTS (
        SELECT 1 FROM subject_association
        WHERE context_post_id = OLD.id
      )
      OR EXISTS (
        SELECT 1 FROM unit_association_proposal
        WHERE context_post_id = OLD.id
      )
    )
  THEN
    RAISE EXCEPTION 'referenced association context post % must remain a wiki Post', OLD.id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_post_reply_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  IF (OLD.post_id, OLD.root_post_id, OLD.parent_post_id, OLD.depth, OLD.created_at)
    IS DISTINCT FROM
    (NEW.post_id, NEW.root_post_id, NEW.parent_post_id, NEW.depth, NEW.created_at) THEN
    RAISE EXCEPTION 'post_reply identity is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_realm_tag_context_post_kind()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  IF OLD."kind" = 'wiki'
    AND NEW."kind" <> 'wiki'
    AND EXISTS (
      SELECT 1
      FROM "realm_tag_context"
      WHERE "context_post_id" = OLD."id"
    )
  THEN
    RAISE EXCEPTION 'Post % is a Realm Tag Context and must remain a Wiki Post', OLD."id"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS content_structure_node_realm_tag_query_strategy ON public.content_structure_node;
CREATE TRIGGER content_structure_node_realm_tag_query_strategy BEFORE INSERT OR UPDATE OF structure_id, content_unit_id, realm_tag_query_strategy, deleted_at ON public.content_structure_node FOR EACH ROW EXECUTE FUNCTION public.enforce_realm_taxonomy_tag_query_strategy();

DROP TRIGGER IF EXISTS post_association_context_kind_protect ON public.post;
CREATE TRIGGER post_association_context_kind_protect BEFORE UPDATE OF kind ON public.post FOR EACH ROW EXECUTE FUNCTION public.protect_association_context_post_kind();

DROP TRIGGER IF EXISTS post_realm_tag_context_kind ON public.post;
CREATE TRIGGER post_realm_tag_context_kind BEFORE UPDATE OF kind ON public.post FOR EACH ROW EXECUTE FUNCTION public.protect_realm_tag_context_post_kind();

DROP TRIGGER IF EXISTS post_reply_stat_initialize ON public.post;
CREATE TRIGGER post_reply_stat_initialize AFTER INSERT ON public.post FOR EACH ROW EXECUTE FUNCTION public.initialize_post_reply_stat();

DROP TRIGGER IF EXISTS post_subject_targeting_enforce ON public.post;
CREATE TRIGGER post_subject_targeting_enforce AFTER INSERT OR UPDATE OF subject_unit_id ON public.post FOR EACH ROW EXECUTE FUNCTION public.enforce_post_subject_targeting();

DROP TRIGGER IF EXISTS post_reply_identity_protect ON public.post_reply;
CREATE TRIGGER post_reply_identity_protect BEFORE UPDATE ON public.post_reply FOR EACH ROW EXECUTE FUNCTION public.protect_post_reply_identity();

DROP TRIGGER IF EXISTS post_reply_stats_maintain ON public.post_reply;
CREATE TRIGGER post_reply_stats_maintain AFTER INSERT OR DELETE OR UPDATE ON public.post_reply FOR EACH ROW EXECUTE FUNCTION public.maintain_post_reply_stats();

DROP TRIGGER IF EXISTS post_reply_targeting_enforce ON public.post_reply;
CREATE TRIGGER post_reply_targeting_enforce AFTER INSERT OR UPDATE OF root_post_id, parent_post_id ON public.post_reply FOR EACH ROW EXECUTE FUNCTION public.enforce_post_reply_targeting();

DROP TRIGGER IF EXISTS realm_tag_context_wiki_post ON public.realm_tag_context;
CREATE TRIGGER realm_tag_context_wiki_post BEFORE INSERT OR UPDATE OF context_post_id ON public.realm_tag_context FOR EACH ROW EXECUTE FUNCTION public.enforce_realm_tag_context_wiki_post();

DROP TRIGGER IF EXISTS post_realm_mount_targeting_enforce ON public.realm_unit;
CREATE TRIGGER post_realm_mount_targeting_enforce AFTER INSERT OR UPDATE OF realm_id, unit_id ON public.realm_unit FOR EACH ROW EXECUTE FUNCTION public.enforce_post_realm_mount_targeting();

DROP TRIGGER IF EXISTS subject_association_wiki_context_post ON public.subject_association;
CREATE TRIGGER subject_association_wiki_context_post BEFORE INSERT OR UPDATE OF context_post_id ON public.subject_association FOR EACH ROW EXECUTE FUNCTION public.enforce_wiki_association_context_post();

DROP TRIGGER IF EXISTS unit_association_proposal_wiki_context_post ON public.unit_association_proposal;
CREATE TRIGGER unit_association_proposal_wiki_context_post BEFORE INSERT OR UPDATE OF context_post_id, kind ON public.unit_association_proposal FOR EACH ROW EXECUTE FUNCTION public.enforce_wiki_association_context_post();
