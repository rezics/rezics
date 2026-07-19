-- atlas:txmode none

BEGIN;

LOCK TABLE
  "collection", "collection_item", "conversation", "conversation_read", "message",
  "post", "post_reply", "realm_tag_vote", "recommendation_event", "score",
  "unit", "unit_alias_vote", "unit_follow", "unit_progress", "unit_reaction",
  "unit_share", "unit_tag_vote"
IN SHARE ROW EXCLUSIVE MODE;

CREATE FUNCTION apply_unit_engagement_stat(
  p_unit_id uuid,
  p_upvotes bigint DEFAULT 0,
  p_downvotes bigint DEFAULT 0,
  p_replies bigint DEFAULT 0,
  p_favorites bigint DEFAULT 0,
  p_shares bigint DEFAULT 0,
  p_high_scores bigint DEFAULT 0,
  p_active_progress bigint DEFAULT 0,
  p_completions bigint DEFAULT 0,
  p_negative_progress bigint DEFAULT 0
) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM unit WHERE id = p_unit_id) THEN
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
$$;

CREATE FUNCTION apply_recommendation_unit_signal(
  p_unit_id uuid,
  p_occurred_at timestamptz,
  p_kind text,
  p_count_delta bigint,
  p_weight_delta double precision
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  bucket timestamptz := date_bin(interval '1 hour', p_occurred_at, timestamptz '2000-01-01 00:00:00+00');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM unit WHERE id = p_unit_id) THEN
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
$$;

CREATE FUNCTION apply_recommendation_profile_signal(
  p_profile_id uuid,
  p_unit_id uuid,
  p_occurred_at timestamptz,
  p_kind text,
  p_count_delta bigint,
  p_weight_delta double precision
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  bucket timestamptz := date_bin(interval '1 hour', p_occurred_at, timestamptz '2000-01-01 00:00:00+00');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profile WHERE id = p_profile_id)
    OR NOT EXISTS (SELECT 1 FROM unit WHERE id = p_unit_id) THEN
    RETURN;
  END IF;
  IF p_count_delta < 0 THEN
    UPDATE recommendation_profile_signal_hourly SET
      signal_count = signal_count + p_count_delta,
      weight = weight + p_weight_delta,
      updated_at = now()
    WHERE profile_id = p_profile_id AND unit_id = p_unit_id
      AND bucket_start = bucket AND kind = p_kind::recommendation_signal_kind;
  ELSE
    INSERT INTO recommendation_profile_signal_hourly (
      profile_id, unit_id, bucket_start, kind, signal_count, weight
    ) VALUES (
      p_profile_id, p_unit_id, bucket, p_kind::recommendation_signal_kind,
      p_count_delta, p_weight_delta
    )
    ON CONFLICT (profile_id, unit_id, bucket_start, kind) DO UPDATE SET
      signal_count = recommendation_profile_signal_hourly.signal_count + excluded.signal_count,
      weight = recommendation_profile_signal_hourly.weight + excluded.weight,
      updated_at = now();
  END IF;

  DELETE FROM recommendation_profile_signal_hourly
  WHERE profile_id = p_profile_id AND unit_id = p_unit_id AND bucket_start = bucket
    AND kind = p_kind::recommendation_signal_kind AND signal_count = 0 AND weight = 0;
END;
$$;

INSERT INTO score_stat (
  unit_id, realm_id, total_count, total_score,
  score_1_count, score_2_count, score_3_count, score_4_count, score_5_count,
  score_6_count, score_7_count, score_8_count, score_9_count, score_10_count
)
SELECT unit_id, realm_id, count(*), sum(value),
  count(*) FILTER (WHERE value = 1), count(*) FILTER (WHERE value = 2),
  count(*) FILTER (WHERE value = 3), count(*) FILTER (WHERE value = 4),
  count(*) FILTER (WHERE value = 5), count(*) FILTER (WHERE value = 6),
  count(*) FILTER (WHERE value = 7), count(*) FILTER (WHERE value = 8),
  count(*) FILTER (WHERE value = 9), count(*) FILTER (WHERE value = 10)
FROM score
GROUP BY unit_id, realm_id;

INSERT INTO unit_alias_vote_stat (alias_id, score, vote_count)
SELECT alias_id, sum(value), count(*) FROM unit_alias_vote GROUP BY alias_id;

INSERT INTO unit_tag_vote_stat (unit_id, tag_id, score, vote_count)
SELECT unit_id, tag_id, sum(value), count(*) FROM unit_tag_vote GROUP BY unit_id, tag_id;

INSERT INTO realm_tag_vote_stat (realm_id, unit_id, tag_id, score, vote_count)
SELECT realm_id, unit_id, tag_id, sum(value), count(*)
FROM realm_tag_vote GROUP BY realm_id, unit_id, tag_id;

INSERT INTO unit_follow_stat (unit_id, follower_count)
SELECT unit_id, count(*) FROM unit_follow GROUP BY unit_id;

INSERT INTO unit_reaction_stat (unit_id, realm_id, reaction, reaction_count)
SELECT unit_id, realm_id, reaction, count(*)
FROM unit_reaction GROUP BY unit_id, realm_id, reaction;

INSERT INTO unit_reaction_global_stat (unit_id, reaction, reaction_count)
SELECT unit_id, reaction, count(*) FROM unit_reaction GROUP BY unit_id, reaction;

INSERT INTO post_reply_stat (post_id)
SELECT id FROM post;

UPDATE post_reply_stat target SET
  undeleted_direct_count = (
    SELECT count(*) FROM post_reply reply
    JOIN unit reply_unit ON reply_unit.id = reply.post_id
    WHERE reply.parent_post_id = target.post_id AND reply_unit.deleted_at IS NULL
  ),
  undeleted_descendant_count = (
    SELECT count(*) FROM post_reply reply
    JOIN unit reply_unit ON reply_unit.id = reply.post_id
    WHERE reply.root_post_id = target.post_id AND reply_unit.deleted_at IS NULL
  ),
  visible_direct_count = (
    SELECT count(*) FROM post_reply reply
    JOIN unit reply_unit ON reply_unit.id = reply.post_id
    WHERE reply.parent_post_id = target.post_id AND reply_unit.deleted_at IS NULL
      AND reply_unit.status = 'published' AND reply_unit.visibility = 'public'
      AND reply_unit.moderation_status = 'approved'
  ),
  visible_descendant_count = (
    SELECT count(*) FROM post_reply reply
    JOIN unit reply_unit ON reply_unit.id = reply.post_id
    WHERE reply.root_post_id = target.post_id AND reply_unit.deleted_at IS NULL
      AND reply_unit.status = 'published' AND reply_unit.visibility = 'public'
      AND reply_unit.moderation_status = 'approved'
  );

INSERT INTO conversation_stat (conversation_id, last_message_id, last_message_at)
SELECT conversation.id, latest.id, latest.created_at
FROM conversation
LEFT JOIN LATERAL (
  SELECT message.id, message.created_at FROM message
  WHERE message.conversation_id = conversation.id
  ORDER BY message.created_at DESC, message.id DESC LIMIT 1
) latest ON true;

INSERT INTO conversation_participant_stat (
  conversation_id, profile_id, last_message_id, last_message_at, sort_at, unread_count
)
SELECT conversation.id, participant.profile_id, latest.id, latest.created_at,
  coalesce(latest.created_at, conversation.created_at),
  count(unread.id) FILTER (WHERE unread.id IS NOT NULL)
FROM conversation
CROSS JOIN LATERAL (
  VALUES (conversation.participant_low_profile_id), (conversation.participant_high_profile_id)
) participant(profile_id)
LEFT JOIN LATERAL (
  SELECT message.id, message.created_at FROM message
  WHERE message.conversation_id = conversation.id
  ORDER BY message.created_at DESC, message.id DESC LIMIT 1
) latest ON true
LEFT JOIN conversation_read ON conversation_read.conversation_id = conversation.id
  AND conversation_read.profile_id = participant.profile_id
LEFT JOIN message marker ON marker.id = conversation_read.last_read_message_id
LEFT JOIN message unread ON unread.conversation_id = conversation.id
  AND unread.sender_profile_id <> participant.profile_id
  AND unread.deleted_at IS NULL
  AND (marker.id IS NULL OR (unread.created_at, unread.id) > (marker.created_at, marker.id))
GROUP BY conversation.id, participant.profile_id, latest.id, latest.created_at, conversation.created_at;

WITH change AS (
  SELECT unit_id,
    count(*) FILTER (WHERE reaction = 'upvote') AS upvotes,
    count(*) FILTER (WHERE reaction = 'downvote') AS downvotes,
    0::bigint AS replies, 0::bigint AS favorites, 0::bigint AS shares,
    0::bigint AS high_scores, 0::bigint AS active_progress,
    0::bigint AS completions, 0::bigint AS negative_progress
  FROM unit_reaction GROUP BY unit_id
  UNION ALL
  SELECT target_id, 0, 0, count(*), 0, 0, 0, 0, 0, 0 FROM (
    SELECT reply.root_post_id AS target_id
    FROM post_reply reply JOIN unit reply_unit ON reply_unit.id = reply.post_id
    WHERE reply_unit.deleted_at IS NULL
    UNION ALL
    SELECT reply.parent_post_id
    FROM post_reply reply JOIN unit reply_unit ON reply_unit.id = reply.post_id
    WHERE reply.parent_post_id IS NOT NULL AND reply_unit.deleted_at IS NULL
  ) reply_target GROUP BY target_id
  UNION ALL
  SELECT item.unit_id, 0, 0, 0, count(*), 0, 0, 0, 0, 0
  FROM collection_item item JOIN collection owner ON owner.id = item.collection_id
  WHERE owner.source = 'system' AND owner.system_key = 'favorites' GROUP BY item.unit_id
  UNION ALL
  SELECT unit_id, 0, 0, 0, 0, count(*), 0, 0, 0, 0 FROM unit_share GROUP BY unit_id
  UNION ALL
  SELECT unit_id, 0, 0, 0, 0, 0, count(*) FILTER (WHERE value >= 8), 0, 0, 0
  FROM score GROUP BY unit_id
  UNION ALL
  SELECT unit_id, 0, 0, 0, 0, 0, 0,
    count(*) FILTER (WHERE status = 'active'),
    count(*) FILTER (WHERE status = 'completed'),
    count(*) FILTER (WHERE status = 'dropped')
  FROM unit_progress WHERE deleted_at IS NULL GROUP BY unit_id
)
INSERT INTO unit_engagement_stat (
  unit_id, upvotes, downvotes, replies, favorites, shares, high_scores,
  active_progress, completions, negative_progress
)
SELECT unit_id, sum(upvotes), sum(downvotes), sum(replies), sum(favorites), sum(shares),
  sum(high_scores), sum(active_progress), sum(completions), sum(negative_progress)
FROM change GROUP BY unit_id;

WITH raw_signal AS (
  SELECT target_unit_id AS unit_id, occurred_at,
    type::text::recommendation_signal_kind AS kind,
    CASE type WHEN 'open' THEN 1 WHEN 'dwell_30s' THEN 2 ELSE 0 END::double precision AS weight
  FROM recommendation_event
  WHERE profile_id IS NOT NULL AND type IN ('impression', 'open', 'dwell_30s', 'not_interested')
  UNION ALL
  SELECT unit_id, updated_at, reaction::text::recommendation_signal_kind,
    CASE reaction WHEN 'upvote' THEN 3 ELSE 0 END::double precision FROM unit_reaction
  UNION ALL
  SELECT root_post_id, created_at, 'reply'::recommendation_signal_kind, 4::double precision
  FROM post_reply
  UNION ALL
  SELECT parent_post_id, created_at, 'reply'::recommendation_signal_kind, 4::double precision
  FROM post_reply WHERE parent_post_id IS NOT NULL
  UNION ALL
  SELECT item.unit_id, item.created_at, 'favorite'::recommendation_signal_kind, 5::double precision
  FROM collection_item item JOIN collection owner ON owner.id = item.collection_id
  WHERE owner.source = 'system' AND owner.system_key = 'favorites'
  UNION ALL
  SELECT unit_id, created_at, 'share'::recommendation_signal_kind, 4::double precision FROM unit_share
  UNION ALL
  SELECT unit_id, updated_at,
    CASE WHEN value >= 8 THEN 'score_high' ELSE 'score_medium' END::recommendation_signal_kind,
    CASE WHEN value >= 8 THEN 5 ELSE 3 END::double precision FROM score WHERE value >= 6
  UNION ALL
  SELECT unit_id, last_seen_at,
    CASE status WHEN 'active' THEN 'progress_active' ELSE 'progress_completed' END::recommendation_signal_kind,
    CASE status WHEN 'active' THEN 3 ELSE 5 END::double precision
  FROM unit_progress WHERE deleted_at IS NULL AND status IN ('active', 'completed')
)
INSERT INTO recommendation_unit_signal_hourly (unit_id, bucket_start, kind, signal_count, weight)
SELECT unit_id, date_bin(interval '1 hour', occurred_at, timestamptz '2000-01-01 00:00:00+00'),
  kind, count(*), sum(weight)
FROM raw_signal GROUP BY unit_id, date_bin(interval '1 hour', occurred_at, timestamptz '2000-01-01 00:00:00+00'), kind;

WITH raw_signal AS (
  SELECT profile_id, target_unit_id AS unit_id, occurred_at,
    type::text::recommendation_signal_kind AS kind,
    CASE type WHEN 'open' THEN 1 WHEN 'dwell_30s' THEN 2 WHEN 'not_interested' THEN -4 ELSE 0 END::double precision AS weight
  FROM recommendation_event
  WHERE profile_id IS NOT NULL AND type IN ('open', 'dwell_30s', 'not_interested')
  UNION ALL
  SELECT profile_id, unit_id, updated_at, reaction::text::recommendation_signal_kind,
    CASE reaction WHEN 'upvote' THEN 3 ELSE -4 END::double precision FROM unit_reaction
  UNION ALL
  SELECT item.added_by_profile_id, item.unit_id, item.created_at,
    'favorite'::recommendation_signal_kind, 5::double precision
  FROM collection_item item JOIN collection owner ON owner.id = item.collection_id
  WHERE owner.source = 'system' AND owner.system_key = 'favorites'
    AND item.added_by_profile_id IS NOT NULL
  UNION ALL
  SELECT profile_id, unit_id, created_at, 'share'::recommendation_signal_kind, 4::double precision
  FROM unit_share
  UNION ALL
  SELECT profile_id, unit_id, updated_at,
    CASE WHEN value >= 8 THEN 'score_high'
      WHEN value >= 6 THEN 'score_medium' ELSE 'score_low' END::recommendation_signal_kind,
    CASE WHEN value >= 8 THEN 5 WHEN value >= 6 THEN 3 ELSE -4 END::double precision
  FROM score WHERE value >= 6 OR value <= 3
  UNION ALL
  SELECT profile_id, unit_id, last_seen_at,
    CASE status WHEN 'active' THEN 'progress_active'
      WHEN 'completed' THEN 'progress_completed' ELSE 'progress_dropped' END::recommendation_signal_kind,
    CASE status WHEN 'active' THEN 3 WHEN 'completed' THEN 5 ELSE -4 END::double precision
  FROM unit_progress WHERE deleted_at IS NULL AND status IN ('active', 'completed', 'dropped')
)
INSERT INTO recommendation_profile_signal_hourly (
  profile_id, unit_id, bucket_start, kind, signal_count, weight
)
SELECT profile_id, unit_id,
  date_bin(interval '1 hour', occurred_at, timestamptz '2000-01-01 00:00:00+00'),
  kind, count(*), sum(weight)
FROM raw_signal GROUP BY profile_id, unit_id,
  date_bin(interval '1 hour', occurred_at, timestamptz '2000-01-01 00:00:00+00'), kind;

CREATE FUNCTION maintain_score_stat() RETURNS trigger
LANGUAGE plpgsql AS $$
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
    IF EXISTS (SELECT 1 FROM unit WHERE id = row_data.unit_id)
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
      PERFORM apply_recommendation_profile_signal(
        row_data.profile_id, row_data.unit_id, row_data.updated_at, signal_kind,
        direction, direction * profile_weight
      );
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER score_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON score
FOR EACH ROW EXECUTE FUNCTION maintain_score_stat();

CREATE FUNCTION maintain_unit_alias_vote_stat() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE row_data unit_alias_vote%ROWTYPE; direction bigint; change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    IF EXISTS (SELECT 1 FROM unit_alias WHERE id = row_data.alias_id) THEN
      IF direction < 0 THEN
        UPDATE unit_alias_vote_stat SET score = score + direction * row_data.value,
          vote_count = vote_count + direction, updated_at = now()
        WHERE alias_id = row_data.alias_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'missing unit_alias_vote_stat row for decrement: %',
            row_data.alias_id USING ERRCODE = '23514';
        END IF;
      ELSE
        INSERT INTO unit_alias_vote_stat (alias_id, score, vote_count)
        VALUES (row_data.alias_id, direction * row_data.value, direction)
        ON CONFLICT (alias_id) DO UPDATE SET
          score = unit_alias_vote_stat.score + excluded.score,
          vote_count = unit_alias_vote_stat.vote_count + excluded.vote_count,
          updated_at = now();
      END IF;
      DELETE FROM unit_alias_vote_stat WHERE alias_id = row_data.alias_id AND vote_count = 0;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER unit_alias_vote_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON unit_alias_vote
FOR EACH ROW EXECUTE FUNCTION maintain_unit_alias_vote_stat();

CREATE FUNCTION maintain_unit_tag_vote_stat() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE row_data unit_tag_vote%ROWTYPE; direction bigint; change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    IF EXISTS (
      SELECT 1 FROM unit_tag WHERE unit_id = row_data.unit_id AND tag_id = row_data.tag_id
    ) THEN
      IF direction < 0 THEN
        UPDATE unit_tag_vote_stat SET score = score + direction * row_data.value,
          vote_count = vote_count + direction, updated_at = now()
        WHERE unit_id = row_data.unit_id AND tag_id = row_data.tag_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'missing unit_tag_vote_stat row for decrement: %, %',
            row_data.unit_id, row_data.tag_id USING ERRCODE = '23514';
        END IF;
      ELSE
        INSERT INTO unit_tag_vote_stat (unit_id, tag_id, score, vote_count)
        VALUES (row_data.unit_id, row_data.tag_id, direction * row_data.value, direction)
        ON CONFLICT (unit_id, tag_id) DO UPDATE SET
          score = unit_tag_vote_stat.score + excluded.score,
          vote_count = unit_tag_vote_stat.vote_count + excluded.vote_count,
          updated_at = now();
      END IF;
      DELETE FROM unit_tag_vote_stat
      WHERE unit_id = row_data.unit_id AND tag_id = row_data.tag_id AND vote_count = 0;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER unit_tag_vote_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON unit_tag_vote
FOR EACH ROW EXECUTE FUNCTION maintain_unit_tag_vote_stat();

CREATE FUNCTION maintain_realm_tag_vote_stat() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE row_data realm_tag_vote%ROWTYPE; direction bigint; change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    IF EXISTS (
      SELECT 1 FROM realm_tag_context
      WHERE realm_id = row_data.realm_id AND unit_id = row_data.unit_id
        AND tag_id = row_data.tag_id
    ) THEN
      IF direction < 0 THEN
        UPDATE realm_tag_vote_stat SET score = score + direction * row_data.value,
          vote_count = vote_count + direction, updated_at = now()
        WHERE realm_id = row_data.realm_id AND unit_id = row_data.unit_id
          AND tag_id = row_data.tag_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'missing realm_tag_vote_stat row for decrement: %, %, %',
            row_data.realm_id, row_data.unit_id, row_data.tag_id USING ERRCODE = '23514';
        END IF;
      ELSE
        INSERT INTO realm_tag_vote_stat (realm_id, unit_id, tag_id, score, vote_count)
        VALUES (
          row_data.realm_id, row_data.unit_id, row_data.tag_id,
          direction * row_data.value, direction
        )
        ON CONFLICT (realm_id, unit_id, tag_id) DO UPDATE SET
          score = realm_tag_vote_stat.score + excluded.score,
          vote_count = realm_tag_vote_stat.vote_count + excluded.vote_count,
          updated_at = now();
      END IF;
      DELETE FROM realm_tag_vote_stat
      WHERE realm_id = row_data.realm_id AND unit_id = row_data.unit_id
        AND tag_id = row_data.tag_id AND vote_count = 0;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER realm_tag_vote_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON realm_tag_vote
FOR EACH ROW EXECUTE FUNCTION maintain_realm_tag_vote_stat();

CREATE FUNCTION maintain_unit_follow_stat() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE row_data unit_follow%ROWTYPE; direction bigint; change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    IF EXISTS (SELECT 1 FROM unit WHERE id = row_data.unit_id) THEN
      IF direction < 0 THEN
        UPDATE unit_follow_stat SET follower_count = follower_count + direction,
          updated_at = now() WHERE unit_id = row_data.unit_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'missing unit_follow_stat row for decrement: %',
            row_data.unit_id USING ERRCODE = '23514';
        END IF;
      ELSE
        INSERT INTO unit_follow_stat (unit_id, follower_count)
        VALUES (row_data.unit_id, direction)
        ON CONFLICT (unit_id) DO UPDATE SET
          follower_count = unit_follow_stat.follower_count + excluded.follower_count,
          updated_at = now();
      END IF;
      DELETE FROM unit_follow_stat WHERE unit_id = row_data.unit_id AND follower_count = 0;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER unit_follow_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON unit_follow
FOR EACH ROW EXECUTE FUNCTION maintain_unit_follow_stat();

CREATE FUNCTION apply_reaction_change(
  p_profile_id uuid,
  p_unit_id uuid,
  p_realm_id uuid,
  p_reaction text,
  p_occurred_at timestamptz,
  p_direction bigint
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE unit_weight double precision; profile_weight double precision;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM unit WHERE id = p_unit_id) THEN RETURN; END IF;

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
  PERFORM apply_recommendation_profile_signal(
    p_profile_id, p_unit_id, p_occurred_at, p_reaction,
    p_direction, p_direction * profile_weight
  );
END;
$$;

CREATE FUNCTION maintain_unit_reaction_stats() RETURNS trigger
LANGUAGE plpgsql AS $$
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
$$;

CREATE TRIGGER unit_reaction_stats_maintain
AFTER INSERT OR UPDATE OR DELETE ON unit_reaction
FOR EACH ROW EXECUTE FUNCTION maintain_unit_reaction_stats();

CREATE FUNCTION refresh_post_reply_stat(p_post_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM post WHERE id = p_post_id) THEN RETURN; END IF;
  INSERT INTO post_reply_stat (
    post_id, undeleted_direct_count, undeleted_descendant_count,
    visible_direct_count, visible_descendant_count
  ) SELECT p_post_id,
    count(*) FILTER (WHERE reply.parent_post_id = p_post_id AND reply_unit.deleted_at IS NULL),
    count(*) FILTER (WHERE reply.root_post_id = p_post_id AND reply_unit.deleted_at IS NULL),
    count(*) FILTER (
      WHERE reply.parent_post_id = p_post_id AND reply_unit.deleted_at IS NULL
        AND reply_unit.status = 'published' AND reply_unit.visibility = 'public'
        AND reply_unit.moderation_status = 'approved'
    ),
    count(*) FILTER (
      WHERE reply.root_post_id = p_post_id AND reply_unit.deleted_at IS NULL
        AND reply_unit.status = 'published' AND reply_unit.visibility = 'public'
        AND reply_unit.moderation_status = 'approved'
    )
  FROM post_reply reply
  JOIN unit reply_unit ON reply_unit.id = reply.post_id
  WHERE reply.parent_post_id = p_post_id OR reply.root_post_id = p_post_id
  ON CONFLICT (post_id) DO UPDATE SET
    undeleted_direct_count = excluded.undeleted_direct_count,
    undeleted_descendant_count = excluded.undeleted_descendant_count,
    visible_direct_count = excluded.visible_direct_count,
    visible_descendant_count = excluded.visible_descendant_count,
    updated_at = now();
END;
$$;

CREATE FUNCTION maintain_post_reply_stats() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF TG_OP = 'DELETE' AND EXISTS (SELECT 1 FROM unit WHERE id = OLD.post_id) THEN
      IF EXISTS (SELECT 1 FROM unit WHERE id = OLD.post_id AND deleted_at IS NULL) THEN
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
    PERFORM refresh_post_reply_stat(OLD.root_post_id);
    IF OLD.parent_post_id IS NOT NULL THEN PERFORM refresh_post_reply_stat(OLD.parent_post_id); END IF;
  END IF;
  IF TG_OP IN ('UPDATE', 'INSERT') THEN
    IF TG_OP = 'INSERT' AND EXISTS (
      SELECT 1 FROM unit WHERE id = NEW.post_id AND deleted_at IS NULL
    ) THEN
      PERFORM apply_unit_engagement_stat(NEW.root_post_id, p_replies => 1);
      IF NEW.parent_post_id IS NOT NULL THEN
        PERFORM apply_unit_engagement_stat(NEW.parent_post_id, p_replies => 1);
      END IF;
    END IF;
    IF TG_OP = 'INSERT' THEN
      PERFORM apply_recommendation_unit_signal(
        NEW.root_post_id, NEW.created_at, 'reply', 1, 4
      );
      IF NEW.parent_post_id IS NOT NULL THEN
        PERFORM apply_recommendation_unit_signal(
          NEW.parent_post_id, NEW.created_at, 'reply', 1, 4
        );
      END IF;
    END IF;
    PERFORM refresh_post_reply_stat(NEW.root_post_id);
    IF NEW.parent_post_id IS NOT NULL THEN PERFORM refresh_post_reply_stat(NEW.parent_post_id); END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER post_reply_stats_maintain
AFTER INSERT OR UPDATE OR DELETE ON post_reply
FOR EACH ROW EXECUTE FUNCTION maintain_post_reply_stats();

CREATE FUNCTION protect_post_reply_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.post_id, OLD.root_post_id, OLD.parent_post_id, OLD.context_realm_id, OLD.depth, OLD.created_at)
    IS DISTINCT FROM
    (NEW.post_id, NEW.root_post_id, NEW.parent_post_id, NEW.context_realm_id, NEW.depth, NEW.created_at) THEN
    RAISE EXCEPTION 'post_reply identity is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER post_reply_identity_protect
BEFORE UPDATE ON post_reply FOR EACH ROW EXECUTE FUNCTION protect_post_reply_identity();

CREATE FUNCTION initialize_post_reply_stat() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO post_reply_stat (post_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NULL;
END;
$$;

CREATE TRIGGER post_reply_stat_initialize
AFTER INSERT ON post FOR EACH ROW EXECUTE FUNCTION initialize_post_reply_stat();

CREATE FUNCTION maintain_reply_unit_state() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE relation post_reply%ROWTYPE;
old_counted boolean;
new_counted boolean;
BEGIN
  SELECT * INTO relation FROM post_reply WHERE post_id = OLD.id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  old_counted := OLD.deleted_at IS NULL;
  new_counted := NEW.deleted_at IS NULL;
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
  PERFORM refresh_post_reply_stat(relation.root_post_id);
  IF relation.parent_post_id IS NOT NULL THEN
    PERFORM refresh_post_reply_stat(relation.parent_post_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER reply_unit_state_maintain
AFTER UPDATE OF status, visibility, moderation_status, deleted_at ON unit
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status
  OR OLD.visibility IS DISTINCT FROM NEW.visibility
  OR OLD.moderation_status IS DISTINCT FROM NEW.moderation_status
  OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
EXECUTE FUNCTION maintain_reply_unit_state();

CREATE FUNCTION remove_reply_signals_before_unit_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE relation post_reply%ROWTYPE;
BEGIN
  SELECT * INTO relation FROM post_reply WHERE post_id = OLD.id;
  IF NOT FOUND THEN RETURN OLD; END IF;
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
$$;

CREATE TRIGGER reply_signals_remove_before_unit_delete
BEFORE DELETE ON unit FOR EACH ROW EXECUTE FUNCTION remove_reply_signals_before_unit_delete();

CREATE FUNCTION initialize_conversation_stats() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO conversation_stat (conversation_id) VALUES (NEW.id);
  INSERT INTO conversation_participant_stat (conversation_id, profile_id, sort_at)
  VALUES (NEW.id, NEW.participant_low_profile_id, NEW.created_at),
    (NEW.id, NEW.participant_high_profile_id, NEW.created_at);
  RETURN NULL;
END;
$$;

CREATE TRIGGER conversation_stats_initialize
AFTER INSERT ON conversation FOR EACH ROW EXECUTE FUNCTION initialize_conversation_stats();

CREATE FUNCTION protect_conversation_aggregate_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.id, OLD.participant_low_profile_id, OLD.participant_high_profile_id, OLD.created_at)
    IS DISTINCT FROM
    (NEW.id, NEW.participant_low_profile_id, NEW.participant_high_profile_id, NEW.created_at) THEN
    RAISE EXCEPTION 'conversation aggregate identity is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER conversation_aggregate_identity_protect
BEFORE UPDATE ON conversation
FOR EACH ROW EXECUTE FUNCTION protect_conversation_aggregate_identity();

CREATE FUNCTION refresh_conversation_last_message(p_conversation_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE latest message%ROWTYPE;
created_at_value timestamptz;
BEGIN
  SELECT * INTO latest FROM message
  WHERE conversation_id = p_conversation_id
  ORDER BY created_at DESC, id DESC LIMIT 1;
  SELECT created_at INTO created_at_value FROM conversation WHERE id = p_conversation_id;
  IF created_at_value IS NULL THEN RETURN; END IF;
  UPDATE conversation_stat SET last_message_id = latest.id,
    last_message_at = latest.created_at, updated_at = now()
  WHERE conversation_id = p_conversation_id;
  UPDATE conversation_participant_stat SET last_message_id = latest.id,
    last_message_at = latest.created_at,
    sort_at = coalesce(latest.created_at, created_at_value), updated_at = now()
  WHERE conversation_id = p_conversation_id;
END;
$$;

CREATE FUNCTION message_is_unread(
  p_conversation_id uuid,
  p_recipient_id uuid,
  p_message_created_at timestamptz,
  p_message_id uuid
) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT marker.id IS NULL OR (p_message_created_at, p_message_id) > (marker.created_at, marker.id)
  FROM (SELECT 1) seed
  LEFT JOIN conversation_read read_state
    ON read_state.conversation_id = p_conversation_id AND read_state.profile_id = p_recipient_id
  LEFT JOIN message marker ON marker.id = read_state.last_read_message_id;
$$;

CREATE FUNCTION maintain_message_stats() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE recipient_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE conversation_stat SET last_message_id = NEW.id, last_message_at = NEW.created_at,
      updated_at = now()
    WHERE conversation_id = NEW.conversation_id
      AND (last_message_at IS NULL OR (last_message_at, last_message_id) < (NEW.created_at, NEW.id));
    UPDATE conversation_participant_stat SET last_message_id = NEW.id,
      last_message_at = NEW.created_at, sort_at = NEW.created_at, updated_at = now()
    WHERE conversation_id = NEW.conversation_id
      AND (last_message_at IS NULL OR (last_message_at, last_message_id) < (NEW.created_at, NEW.id));
    SELECT CASE WHEN participant_low_profile_id = NEW.sender_profile_id
      THEN participant_high_profile_id ELSE participant_low_profile_id END
    INTO recipient_id FROM conversation WHERE id = NEW.conversation_id;
    IF NEW.deleted_at IS NULL AND message_is_unread(
      NEW.conversation_id, recipient_id, NEW.created_at, NEW.id
    ) THEN
      UPDATE conversation_participant_stat SET unread_count = unread_count + 1,
        updated_at = now()
      WHERE conversation_id = NEW.conversation_id AND profile_id = recipient_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN
    SELECT CASE WHEN participant_low_profile_id = NEW.sender_profile_id
      THEN participant_high_profile_id ELSE participant_low_profile_id END
    INTO recipient_id FROM conversation WHERE id = NEW.conversation_id;
    IF message_is_unread(NEW.conversation_id, recipient_id, NEW.created_at, NEW.id) THEN
      UPDATE conversation_participant_stat SET
        unread_count = unread_count + CASE
          WHEN OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN -1
          WHEN OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN 1 ELSE 0 END,
        updated_at = now()
      WHERE conversation_id = NEW.conversation_id AND profile_id = recipient_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT CASE WHEN participant_low_profile_id = OLD.sender_profile_id
      THEN participant_high_profile_id ELSE participant_low_profile_id END
    INTO recipient_id FROM conversation WHERE id = OLD.conversation_id;
    IF recipient_id IS NOT NULL AND OLD.deleted_at IS NULL AND message_is_unread(
      OLD.conversation_id, recipient_id, OLD.created_at, OLD.id
    ) THEN
      UPDATE conversation_participant_stat SET unread_count = unread_count - 1,
        updated_at = now()
      WHERE conversation_id = OLD.conversation_id AND profile_id = recipient_id;
    END IF;
    PERFORM refresh_conversation_last_message(OLD.conversation_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER message_stats_maintain
AFTER INSERT OR UPDATE OF deleted_at OR DELETE ON message
FOR EACH ROW EXECUTE FUNCTION maintain_message_stats();

CREATE FUNCTION protect_message_aggregate_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.id, OLD.conversation_id, OLD.sender_profile_id, OLD.created_at)
    IS DISTINCT FROM (NEW.id, NEW.conversation_id, NEW.sender_profile_id, NEW.created_at) THEN
    RAISE EXCEPTION 'message aggregate identity is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER message_aggregate_identity_protect
BEFORE UPDATE ON message
FOR EACH ROW EXECUTE FUNCTION protect_message_aggregate_identity();

CREATE FUNCTION maintain_conversation_read_stat() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE marker_created_at timestamptz;
marker_id uuid;
row_data conversation_read%ROWTYPE;
BEGIN
  row_data := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF TG_OP <> 'DELETE' THEN
    SELECT created_at, id INTO marker_created_at, marker_id FROM message
    WHERE id = row_data.last_read_message_id AND conversation_id = row_data.conversation_id;
  END IF;
  UPDATE conversation_participant_stat target SET unread_count = (
    SELECT count(*) FROM message candidate
    WHERE candidate.conversation_id = row_data.conversation_id
      AND candidate.sender_profile_id <> row_data.profile_id
      AND candidate.deleted_at IS NULL
      AND (marker_id IS NULL OR (candidate.created_at, candidate.id) > (marker_created_at, marker_id))
  ), updated_at = now()
  WHERE target.conversation_id = row_data.conversation_id AND target.profile_id = row_data.profile_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER conversation_read_stat_maintain
AFTER INSERT OR UPDATE OF last_read_message_id OR DELETE ON conversation_read
FOR EACH ROW EXECUTE FUNCTION maintain_conversation_read_stat();

CREATE FUNCTION protect_conversation_read_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.conversation_id, OLD.profile_id) IS DISTINCT FROM (NEW.conversation_id, NEW.profile_id) THEN
    RAISE EXCEPTION 'conversation read identity is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER conversation_read_identity_protect
BEFORE UPDATE ON conversation_read
FOR EACH ROW EXECUTE FUNCTION protect_conversation_read_identity();

CREATE FUNCTION maintain_recommendation_event_signals() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE row_data recommendation_event%ROWTYPE; direction bigint;
unit_weight double precision; profile_weight double precision;
change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    IF row_data.profile_id IS NOT NULL
      AND row_data.type IN ('impression', 'open', 'dwell_30s', 'not_interested') THEN
      unit_weight := CASE row_data.type WHEN 'open' THEN 1 WHEN 'dwell_30s' THEN 2 ELSE 0 END;
      profile_weight := CASE row_data.type WHEN 'open' THEN 1 WHEN 'dwell_30s' THEN 2
        WHEN 'not_interested' THEN -4 ELSE 0 END;
      PERFORM apply_recommendation_unit_signal(
        row_data.target_unit_id, row_data.occurred_at,
        row_data.type::text, direction, direction * unit_weight
      );
      IF row_data.type <> 'impression' THEN
        PERFORM apply_recommendation_profile_signal(
          row_data.profile_id, row_data.target_unit_id, row_data.occurred_at,
          row_data.type::text, direction,
          direction * profile_weight
        );
      END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER recommendation_event_signals_maintain
AFTER INSERT OR UPDATE ON recommendation_event
FOR EACH ROW EXECUTE FUNCTION maintain_recommendation_event_signals();

CREATE FUNCTION maintain_unit_share_stats() RETURNS trigger
LANGUAGE plpgsql AS $$
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
    PERFORM apply_recommendation_profile_signal(
      row_data.profile_id, row_data.unit_id, row_data.created_at, 'share', direction,
      direction * 4
    );
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER unit_share_stats_maintain
AFTER INSERT OR UPDATE OR DELETE ON unit_share
FOR EACH ROW EXECUTE FUNCTION maintain_unit_share_stats();

CREATE FUNCTION maintain_favorite_item_stats() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE row_data collection_item%ROWTYPE; direction bigint; is_favorite boolean; change record;
BEGIN
  IF TG_OP = 'UPDATE' AND
    (OLD.collection_id, OLD.unit_id, OLD.added_by_profile_id, OLD.created_at) IS NOT DISTINCT FROM
    (NEW.collection_id, NEW.unit_id, NEW.added_by_profile_id, NEW.created_at) THEN
    RETURN NULL;
  END IF;
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    SELECT source = 'system' AND system_key = 'favorites' INTO is_favorite
    FROM collection WHERE id = row_data.collection_id;
    IF coalesce(is_favorite, false) THEN
      PERFORM apply_unit_engagement_stat(row_data.unit_id, p_favorites => direction);
      PERFORM apply_recommendation_unit_signal(
        row_data.unit_id, row_data.created_at, 'favorite', direction, direction * 5
      );
      IF row_data.added_by_profile_id IS NOT NULL THEN
        PERFORM apply_recommendation_profile_signal(
          row_data.added_by_profile_id, row_data.unit_id, row_data.created_at,
          'favorite', direction, direction * 5
        );
      END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER favorite_item_stats_maintain
AFTER INSERT OR UPDATE OR DELETE ON collection_item
FOR EACH ROW EXECUTE FUNCTION maintain_favorite_item_stats();

CREATE FUNCTION protect_collection_aggregate_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.source, OLD.system_key) IS DISTINCT FROM (NEW.source, NEW.system_key) THEN
    RAISE EXCEPTION 'collection source and system key are immutable'
      USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN
    DELETE FROM collection_item WHERE collection_id = OLD.id;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER collection_aggregate_identity_protect
BEFORE UPDATE OF source, system_key OR DELETE ON collection
FOR EACH ROW EXECUTE FUNCTION protect_collection_aggregate_identity();

CREATE FUNCTION maintain_unit_progress_stats() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE row_data unit_progress%ROWTYPE; direction bigint;
signal_kind text; signal_weight double precision;
change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    IF row_data.deleted_at IS NULL AND row_data.status IN ('active', 'completed', 'dropped') THEN
      PERFORM apply_unit_engagement_stat(
        row_data.unit_id,
        p_active_progress => direction * (row_data.status = 'active')::int,
        p_completions => direction * (row_data.status = 'completed')::int,
        p_negative_progress => direction * (row_data.status = 'dropped')::int
      );
      signal_kind := CASE row_data.status WHEN 'active' THEN 'progress_active'
        WHEN 'completed' THEN 'progress_completed' ELSE 'progress_dropped' END;
      signal_weight := CASE row_data.status WHEN 'active' THEN 3
        WHEN 'completed' THEN 5 ELSE -4 END;
      IF signal_weight > 0 THEN
        PERFORM apply_recommendation_unit_signal(
          row_data.unit_id, row_data.last_seen_at, signal_kind, direction,
          direction * signal_weight
        );
      END IF;
      PERFORM apply_recommendation_profile_signal(
        row_data.profile_id, row_data.unit_id, row_data.last_seen_at, signal_kind,
        direction, direction * signal_weight
      );
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER unit_progress_stats_maintain
AFTER INSERT OR UPDATE OF profile_id, unit_id, status, last_seen_at, deleted_at OR DELETE ON unit_progress
FOR EACH ROW EXECUTE FUNCTION maintain_unit_progress_stats();

COMMIT;
