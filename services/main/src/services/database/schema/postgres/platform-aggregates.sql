-- Native owner integrity and derived state. This file is the canonical forward-maintained source.
CREATE OR REPLACE FUNCTION public.apply_reaction_change(p_profile_id uuid, p_unit_id uuid, p_realm_id uuid, p_reaction text, p_occurred_at timestamp with time zone, p_direction bigint)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE unit_weight double precision; profile_weight double precision;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.read_unit_state(p_unit_id,true)) THEN RETURN; END IF;

  IF p_realm_id IS NULL OR EXISTS (SELECT 1 FROM realm WHERE id = p_realm_id) THEN
    IF p_direction < 0 THEN
      UPDATE unit_reaction_stat SET reaction_count = reaction_count + p_direction,
        updated_at = now()
      WHERE unit_id = p_unit_id AND realm_id IS NOT DISTINCT FROM p_realm_id
        AND reaction = p_reaction::reaction_kind;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'missing unit_reaction_stat row for decrement: %, %, %',
          p_unit_id, p_realm_id, p_reaction USING ERRCODE = '23514';
      END IF;
    ELSE
      INSERT INTO unit_reaction_stat (unit_id, realm_id, reaction, reaction_count)
      VALUES (p_unit_id, p_realm_id, p_reaction::reaction_kind, p_direction)
      ON CONFLICT (unit_id, realm_id, reaction) DO UPDATE SET
        reaction_count = unit_reaction_stat.reaction_count + excluded.reaction_count,
        updated_at = now();
    END IF;
    DELETE FROM unit_reaction_stat
    WHERE unit_id = p_unit_id AND realm_id IS NOT DISTINCT FROM p_realm_id
      AND reaction = p_reaction::reaction_kind AND reaction_count = 0;
  END IF;

  IF p_direction < 0 THEN
    UPDATE unit_reaction_global_stat SET reaction_count = reaction_count + p_direction,
      updated_at = now()
    WHERE unit_id = p_unit_id AND reaction = p_reaction::reaction_kind;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'missing unit_reaction_global_stat row for decrement: %, %',
        p_unit_id, p_reaction USING ERRCODE = '23514';
    END IF;
  ELSE
    INSERT INTO unit_reaction_global_stat (unit_id, reaction, reaction_count)
    VALUES (p_unit_id, p_reaction::reaction_kind, p_direction)
    ON CONFLICT (unit_id, reaction) DO UPDATE SET
      reaction_count = unit_reaction_global_stat.reaction_count + excluded.reaction_count,
      updated_at = now();
  END IF;
  DELETE FROM unit_reaction_global_stat
  WHERE unit_id = p_unit_id AND reaction = p_reaction::reaction_kind AND reaction_count = 0;

  IF p_reaction = 'upvote' THEN
    PERFORM apply_unit_engagement_stat(p_unit_id, p_upvotes => p_direction);
    unit_weight := 3; profile_weight := 3;
  ELSE
    PERFORM apply_unit_engagement_stat(p_unit_id, p_downvotes => p_direction);
    unit_weight := 0; profile_weight := -4;
  END IF;
  PERFORM apply_recommendation_unit_signal(
    p_unit_id, p_occurred_at, p_reaction,
    p_direction, p_direction * unit_weight
  );

END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_recommendation_unit_signal(p_unit_id uuid, p_occurred_at timestamp with time zone, p_kind text, p_count_delta bigint, p_weight_delta double precision)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE
  bucket timestamptz := date_bin(interval '1 hour', p_occurred_at, timestamptz '2000-01-01 00:00:00+00');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.read_unit_state(p_unit_id,true)) THEN
    RETURN;
  END IF;
  IF p_count_delta < 0 THEN
    UPDATE recommendation_unit_signal_hourly SET
      signal_count = signal_count + p_count_delta,
      weight = weight + p_weight_delta,
      updated_at = now()
    WHERE unit_id = p_unit_id AND bucket_start = bucket
      AND kind = p_kind::recommendation_signal_kind;
  ELSE
    INSERT INTO recommendation_unit_signal_hourly (
      unit_id, bucket_start, kind, signal_count, weight
    ) VALUES (
      p_unit_id, bucket, p_kind::recommendation_signal_kind, p_count_delta, p_weight_delta
    )
    ON CONFLICT (unit_id, bucket_start, kind) DO UPDATE SET
      signal_count = recommendation_unit_signal_hourly.signal_count + excluded.signal_count,
      weight = recommendation_unit_signal_hourly.weight + excluded.weight,
      updated_at = now();
  END IF;

  DELETE FROM recommendation_unit_signal_hourly
  WHERE unit_id = p_unit_id AND bucket_start = bucket
    AND kind = p_kind::recommendation_signal_kind
    AND signal_count = 0 AND weight = 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_unit_engagement_stat(p_unit_id uuid, p_upvotes bigint DEFAULT 0, p_downvotes bigint DEFAULT 0, p_replies bigint DEFAULT 0, p_favorites bigint DEFAULT 0, p_shares bigint DEFAULT 0, p_high_scores bigint DEFAULT 0, p_active_progress bigint DEFAULT 0, p_completions bigint DEFAULT 0, p_negative_progress bigint DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.read_unit_state(p_unit_id,true)) THEN
    RETURN;
  END IF;
  IF p_upvotes = 0 AND p_downvotes = 0 AND p_replies = 0 AND p_favorites = 0
    AND p_shares = 0 AND p_high_scores = 0 AND p_active_progress = 0
    AND p_completions = 0 AND p_negative_progress = 0 THEN
    RETURN;
  END IF;

  UPDATE unit_engagement_stat SET
    upvotes = upvotes + p_upvotes,
    downvotes = downvotes + p_downvotes,
    replies = replies + p_replies,
    favorites = favorites + p_favorites,
    shares = shares + p_shares,
    high_scores = high_scores + p_high_scores,
    active_progress = active_progress + p_active_progress,
    completions = completions + p_completions,
    negative_progress = negative_progress + p_negative_progress,
    updated_at = now()
  WHERE unit_id = p_unit_id;

  IF NOT FOUND THEN
    IF p_upvotes < 0 OR p_downvotes < 0 OR p_replies < 0 OR p_favorites < 0
      OR p_shares < 0 OR p_high_scores < 0 OR p_active_progress < 0
      OR p_completions < 0 OR p_negative_progress < 0 THEN
      RAISE EXCEPTION 'missing unit_engagement_stat row for decrement: %', p_unit_id
        USING ERRCODE = '23514';
    END IF;
    INSERT INTO unit_engagement_stat (
      unit_id, upvotes, downvotes, replies, favorites, shares, high_scores,
      active_progress, completions, negative_progress
    ) VALUES (
      p_unit_id, p_upvotes, p_downvotes, p_replies, p_favorites, p_shares,
      p_high_scores, p_active_progress, p_completions, p_negative_progress
    )
    ON CONFLICT (unit_id) DO UPDATE SET
      upvotes = unit_engagement_stat.upvotes + excluded.upvotes,
      downvotes = unit_engagement_stat.downvotes + excluded.downvotes,
      replies = unit_engagement_stat.replies + excluded.replies,
      favorites = unit_engagement_stat.favorites + excluded.favorites,
      shares = unit_engagement_stat.shares + excluded.shares,
      high_scores = unit_engagement_stat.high_scores + excluded.high_scores,
      active_progress = unit_engagement_stat.active_progress + excluded.active_progress,
      completions = unit_engagement_stat.completions + excluded.completions,
      negative_progress = unit_engagement_stat.negative_progress + excluded.negative_progress,
      updated_at = now();
  END IF;

  DELETE FROM unit_engagement_stat
  WHERE unit_id = p_unit_id AND upvotes = 0 AND downvotes = 0 AND replies = 0
    AND favorites = 0 AND shares = 0 AND high_scores = 0 AND active_progress = 0
    AND completions = 0 AND negative_progress = 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_unit_reference_limits()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    active_count integer;
    pinned_count integer;
    entering_active boolean := false;
    entering_pinned boolean := false;
    reference_kind text := TG_ARGV[0];
BEGIN
    IF TG_OP = 'INSERT' THEN
        entering_active := NEW.withdrawn_at IS NULL;
        entering_pinned := NEW.withdrawn_at IS NULL AND NEW.pinned;
    ELSE
        entering_active := NEW.withdrawn_at IS NULL AND (
            OLD.withdrawn_at IS NOT NULL
            OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
        );
        entering_pinned := NEW.withdrawn_at IS NULL AND NEW.pinned AND (
            NOT OLD.pinned
            OR OLD.withdrawn_at IS NOT NULL
            OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
        );
    END IF;

    IF entering_active OR entering_pinned THEN
        PERFORM pg_advisory_xact_lock(
            hashtextextended('unit-reference:' || reference_kind || ':' || NEW.unit_id::text, 0)
        );
    END IF;

    IF entering_active THEN
        EXECUTE format(
            'SELECT count(*) FROM ('
            || 'SELECT 1 FROM public.%I '
            || 'WHERE unit_id = $1 AND withdrawn_at IS NULL AND id <> $2 LIMIT 128'
            || ') AS active_reference',
            TG_TABLE_NAME
        )
        INTO active_count
        USING NEW.unit_id, NEW.id;
        IF active_count >= 128 THEN
            RAISE EXCEPTION 'Unit % already has 128 active % references',
                NEW.unit_id, reference_kind
                USING ERRCODE = '23514', CONSTRAINT = 'unit_reference_active_limit';
        END IF;
    END IF;

    IF entering_pinned THEN
        EXECUTE format(
            'SELECT count(*) FROM ('
            || 'SELECT 1 FROM public.%I '
            || 'WHERE unit_id = $1 AND withdrawn_at IS NULL AND pinned AND id <> $2 LIMIT 16'
            || ') AS pinned_reference',
            TG_TABLE_NAME
        )
        INTO pinned_count
        USING NEW.unit_id, NEW.id;
        IF pinned_count >= 16 THEN
            RAISE EXCEPTION 'Unit % already has 16 pinned % references',
                NEW.unit_id, reference_kind
                USING ERRCODE = '23514', CONSTRAINT = 'unit_reference_pinned_limit';
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.initialize_collection_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  INSERT INTO collection_stat (collection_id) VALUES (NEW.id);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.initialize_poll_option_vote_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  INSERT INTO poll_option_vote_stat (option_id) VALUES (NEW.id);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.initialize_realm_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
    INSERT INTO public.realm_stat (realm_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
    RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.maintain_collection_item_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE changed record;
BEGIN
  FOR changed IN
    SELECT OLD.collection_id AS collection_id, -1::bigint AS direction
      WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL
    SELECT NEW.collection_id AS collection_id, 1::bigint AS direction
      WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    UPDATE collection_stat
    SET item_count = item_count + changed.direction, updated_at = now()
    WHERE collection_id = changed.collection_id;
    IF NOT FOUND AND EXISTS (SELECT 1 FROM collection WHERE id = changed.collection_id) THEN
      RAISE EXCEPTION 'missing collection_stat row for %', changed.collection_id
        USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_poll_option_vote_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE changed record;
BEGIN
  FOR changed IN
    SELECT OLD.option_id AS option_id, -1::bigint AS direction
      WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL
    SELECT NEW.option_id AS option_id, 1::bigint AS direction
      WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    UPDATE poll_option_vote_stat
    SET vote_count = vote_count + changed.direction, updated_at = now()
    WHERE option_id = changed.option_id;
    IF NOT FOUND AND EXISTS (SELECT 1 FROM poll_option WHERE id = changed.option_id) THEN
      RAISE EXCEPTION 'missing poll_option_vote_stat row for %', changed.option_id
        USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_reply_unit_state()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE relation post_reply%ROWTYPE;
old_counted boolean;
new_counted boolean;
old_visible boolean;
new_visible boolean;
BEGIN
  SELECT * INTO relation FROM post_reply WHERE post_id = OLD.id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  old_counted := OLD.deleted_at IS NULL;
  new_counted := NEW.deleted_at IS NULL;
  old_visible := old_counted AND OLD.status = 'published' AND OLD.visibility = 'public'
    AND OLD.moderation_status = 'approved';
  new_visible := new_counted AND NEW.status = 'published' AND NEW.visibility = 'public'
    AND NEW.moderation_status = 'approved';
  IF old_counted IS DISTINCT FROM new_counted THEN
    PERFORM apply_unit_engagement_stat(
      relation.root_post_id, p_replies => CASE WHEN new_counted THEN 1 ELSE -1 END
    );
    IF relation.parent_post_id IS NOT NULL THEN
      PERFORM apply_unit_engagement_stat(
        relation.parent_post_id, p_replies => CASE WHEN new_counted THEN 1 ELSE -1 END
      );
    END IF;
  END IF;
  PERFORM apply_post_reply_stat_delta(
    relation.root_post_id,
    relation.parent_post_id,
    new_counted::int - old_counted::int,
    new_visible::int - old_visible::int
  );
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_score_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE
  row_data score%ROWTYPE;
  direction bigint;
  signal_kind text;
  unit_weight double precision;
  profile_weight double precision;
  change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL
    SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data;
    direction := change.direction;
    IF EXISTS (SELECT 1 FROM public.read_unit_state(row_data.unit_id,true))
      AND EXISTS (SELECT 1 FROM realm WHERE id = row_data.realm_id) THEN
      IF direction < 0 THEN
        UPDATE score_stat SET
          total_count = total_count + direction,
          total_score = total_score + direction * row_data.value,
          score_1_count = score_1_count + direction * (row_data.value = 1)::int,
          score_2_count = score_2_count + direction * (row_data.value = 2)::int,
          score_3_count = score_3_count + direction * (row_data.value = 3)::int,
          score_4_count = score_4_count + direction * (row_data.value = 4)::int,
          score_5_count = score_5_count + direction * (row_data.value = 5)::int,
          score_6_count = score_6_count + direction * (row_data.value = 6)::int,
          score_7_count = score_7_count + direction * (row_data.value = 7)::int,
          score_8_count = score_8_count + direction * (row_data.value = 8)::int,
          score_9_count = score_9_count + direction * (row_data.value = 9)::int,
          score_10_count = score_10_count + direction * (row_data.value = 10)::int,
          updated_at = now()
        WHERE unit_id = row_data.unit_id AND realm_id = row_data.realm_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'missing score_stat row for decrement: %, %',
            row_data.unit_id, row_data.realm_id USING ERRCODE = '23514';
        END IF;
      ELSE
        INSERT INTO score_stat (
          unit_id, realm_id, total_count, total_score,
          score_1_count, score_2_count, score_3_count, score_4_count, score_5_count,
          score_6_count, score_7_count, score_8_count, score_9_count, score_10_count
        ) VALUES (
          row_data.unit_id, row_data.realm_id, direction, direction * row_data.value,
          direction * (row_data.value = 1)::int, direction * (row_data.value = 2)::int,
          direction * (row_data.value = 3)::int, direction * (row_data.value = 4)::int,
          direction * (row_data.value = 5)::int, direction * (row_data.value = 6)::int,
          direction * (row_data.value = 7)::int, direction * (row_data.value = 8)::int,
          direction * (row_data.value = 9)::int, direction * (row_data.value = 10)::int
        )
        ON CONFLICT (unit_id, realm_id) DO UPDATE SET
          total_count = score_stat.total_count + excluded.total_count,
          total_score = score_stat.total_score + excluded.total_score,
          score_1_count = score_stat.score_1_count + excluded.score_1_count,
          score_2_count = score_stat.score_2_count + excluded.score_2_count,
          score_3_count = score_stat.score_3_count + excluded.score_3_count,
          score_4_count = score_stat.score_4_count + excluded.score_4_count,
          score_5_count = score_stat.score_5_count + excluded.score_5_count,
          score_6_count = score_stat.score_6_count + excluded.score_6_count,
          score_7_count = score_stat.score_7_count + excluded.score_7_count,
          score_8_count = score_stat.score_8_count + excluded.score_8_count,
          score_9_count = score_stat.score_9_count + excluded.score_9_count,
          score_10_count = score_stat.score_10_count + excluded.score_10_count,
          updated_at = now();
      END IF;
      DELETE FROM score_stat
      WHERE unit_id = row_data.unit_id AND realm_id = row_data.realm_id AND total_count = 0;
    END IF;

    PERFORM apply_unit_engagement_stat(
      row_data.unit_id, p_high_scores => direction * (row_data.value >= 8)::int
    );
    IF row_data.value >= 8 THEN
      signal_kind := 'score_high'; unit_weight := 5; profile_weight := 5;
    ELSIF row_data.value >= 6 THEN
      signal_kind := 'score_medium'; unit_weight := 3; profile_weight := 3;
    ELSIF row_data.value <= 3 THEN
      signal_kind := 'score_low'; unit_weight := 0; profile_weight := -4;
    ELSE
      signal_kind := NULL; unit_weight := 0; profile_weight := 0;
    END IF;
    IF signal_kind IS NOT NULL THEN
      IF unit_weight > 0 THEN
        PERFORM apply_recommendation_unit_signal(
          row_data.unit_id, row_data.updated_at, signal_kind, direction, direction * unit_weight
        );
      END IF;

    END IF;
  END LOOP;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_unit_alias_vote_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.alias_id = NEW.alias_id THEN
        IF OLD.value <> NEW.value THEN
            UPDATE public.unit_alias_vote_stat
            SET score = score + NEW.value - OLD.value, updated_at = now()
            WHERE alias_id = NEW.alias_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'missing unit_alias_vote_stat row for update: %', NEW.alias_id
                    USING ERRCODE = '23514';
            END IF;
        END IF;
        RETURN NULL;
    END IF;

    IF TG_OP IN ('UPDATE', 'DELETE')
       AND EXISTS (SELECT 1 FROM public.unit_alias WHERE id = OLD.alias_id) THEN
        UPDATE public.unit_alias_vote_stat
        SET score = score - OLD.value, vote_count = vote_count - 1, updated_at = now()
        WHERE alias_id = OLD.alias_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'missing unit_alias_vote_stat row for decrement: %', OLD.alias_id
                USING ERRCODE = '23514';
        END IF;
        DELETE FROM public.unit_alias_vote_stat
        WHERE alias_id = OLD.alias_id AND vote_count = 0;
    END IF;

    IF TG_OP IN ('UPDATE', 'INSERT')
       AND EXISTS (SELECT 1 FROM public.unit_alias WHERE id = NEW.alias_id) THEN
        INSERT INTO public.unit_alias_vote_stat (alias_id, score, vote_count)
        VALUES (NEW.alias_id, NEW.value, 1)
        ON CONFLICT (alias_id) DO UPDATE SET
            score = unit_alias_vote_stat.score + excluded.score,
            vote_count = unit_alias_vote_stat.vote_count + 1,
            updated_at = now();
    END IF;
    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_unit_external_link_vote_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.external_link_id = NEW.external_link_id THEN
        IF OLD.value <> NEW.value THEN
            UPDATE public.unit_external_link_vote_stat
            SET score = score + NEW.value - OLD.value, updated_at = now()
            WHERE external_link_id = NEW.external_link_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'missing unit_external_link_vote_stat row for update: %',
                    NEW.external_link_id USING ERRCODE = '23514';
            END IF;
        END IF;
        RETURN NULL;
    END IF;

    IF TG_OP IN ('UPDATE', 'DELETE') AND EXISTS (
        SELECT 1 FROM public.unit_external_link WHERE id = OLD.external_link_id
    ) THEN
        UPDATE public.unit_external_link_vote_stat
        SET score = score - OLD.value, vote_count = vote_count - 1, updated_at = now()
        WHERE external_link_id = OLD.external_link_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'missing unit_external_link_vote_stat row for decrement: %',
                OLD.external_link_id USING ERRCODE = '23514';
        END IF;
        DELETE FROM public.unit_external_link_vote_stat
        WHERE external_link_id = OLD.external_link_id AND vote_count = 0;
    END IF;

    IF TG_OP IN ('UPDATE', 'INSERT') AND EXISTS (
        SELECT 1 FROM public.unit_external_link WHERE id = NEW.external_link_id
    ) THEN
        INSERT INTO public.unit_external_link_vote_stat (external_link_id, score, vote_count)
        VALUES (NEW.external_link_id, NEW.value, 1)
        ON CONFLICT (external_link_id) DO UPDATE SET
            score = unit_external_link_vote_stat.score + excluded.score,
            vote_count = unit_external_link_vote_stat.vote_count + 1,
            updated_at = now();
    END IF;
    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_unit_follow_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE row_data unit_follow%ROWTYPE; direction bigint; change record; target_id uuid;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    target_id := public.reference_value_native_id(row_data.target_reference_id);
      IF direction < 0 THEN
        UPDATE unit_follow_stat SET follower_count = follower_count + direction,
          updated_at = now() WHERE unit_id = target_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'missing unit_follow_stat row for decrement: %',
            target_id USING ERRCODE = '23514';
        END IF;
      ELSE
        INSERT INTO unit_follow_stat (unit_id, unit_publishing_id, unit_music_id, unit_program_id, unit_software_id, unit_entity_id, unit_grouping_id, unit_reference_id, unit_distribution_id, unit_video_id, unit_audio_id, unit_post_id, unit_poll_id, unit_zone_id, unit_realm_id, unit_realm_rule_id, unit_custom_theme_id, unit_collection_id, unit_tag_id, unit_tag_path_id, unit_label_id, follower_count)
        SELECT target_id, value.target_publishing_id, value.target_music_id, value.target_program_id, value.target_software_id, value.target_entity_id, value.target_grouping_id, value.target_reference_id, value.target_distribution_id, value.target_video_id, value.target_audio_id, value.target_post_id, value.target_poll_id, value.target_zone_id, value.target_realm_id, value.target_realm_rule_id, value.target_custom_theme_id, value.target_collection_id, value.target_tag_id, value.target_tag_path_id, value.target_label_id, direction
        FROM public.reference_value value WHERE value.id=row_data.target_reference_id
        ON CONFLICT (unit_id) DO UPDATE SET
          follower_count = unit_follow_stat.follower_count + excluded.follower_count,
          updated_at = now();
      END IF;
      DELETE FROM unit_follow_stat WHERE unit_id = target_id AND follower_count = 0;
  END LOOP;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_unit_reaction_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM apply_reaction_change(
      OLD.profile_id, OLD.unit_id, OLD.realm_id, OLD.reaction::text, OLD.updated_at, -1
    );
  END IF;
  IF TG_OP IN ('UPDATE', 'INSERT') THEN
    PERFORM apply_reaction_change(
      NEW.profile_id, NEW.unit_id, NEW.realm_id, NEW.reaction::text, NEW.updated_at, 1
    );
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_unit_share_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE row_data unit_share%ROWTYPE; direction bigint; change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    PERFORM apply_unit_engagement_stat(row_data.unit_id, p_shares => direction);
    PERFORM apply_recommendation_unit_signal(
      row_data.unit_id, row_data.created_at, 'share', direction, direction * 4
    );

  END LOOP;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_reply_signals_before_unit_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE relation post_reply%ROWTYPE;
BEGIN
  SELECT * INTO relation FROM post_reply WHERE post_id = OLD.id;
  IF NOT FOUND THEN RETURN OLD; END IF;
  PERFORM apply_post_reply_stat_delta(
    relation.root_post_id,
    relation.parent_post_id,
    -(OLD.deleted_at IS NULL)::int,
    -(OLD.deleted_at IS NULL AND OLD.status = 'published' AND OLD.visibility = 'public'
      AND OLD.moderation_status = 'approved')::int
  );
  IF OLD.deleted_at IS NULL THEN
    PERFORM apply_unit_engagement_stat(relation.root_post_id, p_replies => -1);
    IF relation.parent_post_id IS NOT NULL THEN
      PERFORM apply_unit_engagement_stat(relation.parent_post_id, p_replies => -1);
    END IF;
  END IF;
  PERFORM apply_recommendation_unit_signal(
    relation.root_post_id, relation.created_at, 'reply', -1, -4
  );
  IF relation.parent_post_id IS NOT NULL THEN
    PERFORM apply_recommendation_unit_signal(
      relation.parent_post_id, relation.created_at, 'reply', -1, -4
    );
  END IF;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS collection_stat_initialize ON public.collection;
CREATE TRIGGER collection_stat_initialize AFTER INSERT ON public.collection FOR EACH ROW EXECUTE FUNCTION public.initialize_collection_stat();

DROP TRIGGER IF EXISTS collection_item_stat_maintain ON public.collection_item;
CREATE TRIGGER collection_item_stat_maintain AFTER INSERT OR DELETE OR UPDATE OF collection_id ON public.collection_item FOR EACH ROW EXECUTE FUNCTION public.maintain_collection_item_stat();

DROP TRIGGER IF EXISTS poll_option_vote_stat_initialize ON public.poll_option;
CREATE TRIGGER poll_option_vote_stat_initialize AFTER INSERT ON public.poll_option FOR EACH ROW EXECUTE FUNCTION public.initialize_poll_option_vote_stat();

DROP TRIGGER IF EXISTS poll_option_vote_stat_maintain ON public.poll_vote;
CREATE TRIGGER poll_option_vote_stat_maintain AFTER INSERT OR DELETE OR UPDATE OF option_id ON public.poll_vote FOR EACH ROW EXECUTE FUNCTION public.maintain_poll_option_vote_stat();

DROP TRIGGER IF EXISTS realm_stat_initialize ON public.realm;
CREATE TRIGGER realm_stat_initialize AFTER INSERT ON public.realm FOR EACH ROW EXECUTE FUNCTION public.initialize_realm_stat();


DROP TRIGGER IF EXISTS score_stat_maintain ON public.score;
CREATE TRIGGER score_stat_maintain AFTER INSERT OR DELETE OR UPDATE ON public.score FOR EACH ROW EXECUTE FUNCTION public.maintain_score_stat();

DROP TRIGGER IF EXISTS reply_signals_remove_before_unit_delete ON public.post;
CREATE TRIGGER reply_signals_remove_before_unit_delete BEFORE DELETE ON public.post FOR EACH ROW EXECUTE FUNCTION public.remove_reply_signals_before_unit_delete();

DROP TRIGGER IF EXISTS reply_unit_state_maintain ON public.post;
CREATE TRIGGER reply_unit_state_maintain AFTER UPDATE OF status, visibility, moderation_status, deleted_at ON public.post FOR EACH ROW WHEN (((old.status IS DISTINCT FROM new.status) OR (old.visibility IS DISTINCT FROM new.visibility) OR (old.moderation_status IS DISTINCT FROM new.moderation_status) OR (old.deleted_at IS DISTINCT FROM new.deleted_at))) EXECUTE FUNCTION public.maintain_reply_unit_state();

DROP TRIGGER IF EXISTS unit_alias_reference_limits ON public.unit_alias;
CREATE TRIGGER unit_alias_reference_limits BEFORE INSERT OR UPDATE OF unit_id, withdrawn_at, pinned ON public.unit_alias FOR EACH ROW EXECUTE FUNCTION public.enforce_unit_reference_limits('alias');

DROP TRIGGER IF EXISTS unit_alias_vote_stat_maintain ON public.unit_alias_vote;
CREATE TRIGGER unit_alias_vote_stat_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_alias_vote FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_alias_vote_stat();

DROP TRIGGER IF EXISTS unit_external_link_reference_limits ON public.unit_external_link;
CREATE TRIGGER unit_external_link_reference_limits BEFORE INSERT OR UPDATE OF unit_id, withdrawn_at, pinned ON public.unit_external_link FOR EACH ROW EXECUTE FUNCTION public.enforce_unit_reference_limits('external_link');

DROP TRIGGER IF EXISTS unit_external_link_vote_stat_maintain ON public.unit_external_link_vote;
CREATE TRIGGER unit_external_link_vote_stat_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_external_link_vote FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_external_link_vote_stat();

DROP TRIGGER IF EXISTS unit_follow_stat_maintain ON public.unit_follow;
CREATE TRIGGER unit_follow_stat_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_follow FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_follow_stat();

DROP TRIGGER IF EXISTS unit_reaction_stats_maintain ON public.unit_reaction;
CREATE TRIGGER unit_reaction_stats_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_reaction FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_reaction_stats();

DROP TRIGGER IF EXISTS unit_share_stats_maintain ON public.unit_share;
CREATE TRIGGER unit_share_stats_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_share FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_share_stats();

-- Incremental striped counters avoid rescanning retained event history and a single hot daily row.
CREATE OR REPLACE FUNCTION public.record_recommendation_metric() RETURNS trigger
LANGUAGE plpgsql SET search_path TO pg_catalog, public AS $function$
BEGIN
 INSERT INTO recommendation_metric_daily(day,surface,policy_version,shard,impressions,opens,dwell_30s,not_interested)
 VALUES ((NEW.occurred_at AT TIME ZONE 'UTC')::date,NEW.surface,NEW.policy_version,
  (hashtextextended(NEW.request_id::text,0) & 127)::smallint,
  (NEW.type='impression')::integer,(NEW.type='open')::integer,(NEW.type='dwell_30s')::integer,(NEW.type='not_interested')::integer)
 ON CONFLICT(day,surface,policy_version,shard) DO UPDATE SET
  impressions=recommendation_metric_daily.impressions+excluded.impressions,
  opens=recommendation_metric_daily.opens+excluded.opens,
  dwell_30s=recommendation_metric_daily.dwell_30s+excluded.dwell_30s,
  not_interested=recommendation_metric_daily.not_interested+excluded.not_interested;
 RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS recommendation_metric_on_insert ON public.recommendation_event;
CREATE TRIGGER recommendation_metric_on_insert
AFTER INSERT ON public.recommendation_event FOR EACH ROW EXECUTE FUNCTION public.record_recommendation_metric();
