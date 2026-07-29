-- Realm pages are a fixed, ordered Realm setting. Presence enables a Page and
-- array order is the public navigation order.
CREATE TYPE "realm_page_kind" AS ENUM ('main', 'tags', 'wiki');
ALTER TABLE "realm"
  ADD COLUMN "enabled_pages" "realm_page_kind"[] NOT NULL
    DEFAULT ARRAY['main']::"realm_page_kind"[],
  ADD CONSTRAINT "realm_enabled_pages_cardinality_check"
    CHECK (cardinality("enabled_pages") BETWEEN 1 AND 3),
  ADD CONSTRAINT "realm_enabled_pages_main_check"
    CHECK (cardinality(array_positions("enabled_pages", 'main'::"realm_page_kind")) = 1),
  ADD CONSTRAINT "realm_enabled_pages_no_null_check"
    CHECK (array_position("enabled_pages", NULL) IS NULL),
  ADD CONSTRAINT "realm_enabled_pages_tags_unique_check"
    CHECK (cardinality(array_positions("enabled_pages", 'tags'::"realm_page_kind")) <= 1),
  ADD CONSTRAINT "realm_enabled_pages_wiki_unique_check"
    CHECK (cardinality(array_positions("enabled_pages", 'wiki'::"realm_page_kind")) <= 1);

ALTER TYPE "unit_permission" ADD VALUE 'realm.tags.manage' AFTER 'realm.pins.manage';
ALTER TYPE "platform_capability" ADD VALUE 'realm.tags.manage' AFTER 'realm.pins.manage';
ALTER TABLE "unit_access_invitation"
  DROP CONSTRAINT "unit_access_invitation_permissions_check",
  ADD CONSTRAINT "unit_access_invitation_permissions_check"
    CHECK (cardinality("permissions") BETWEEN 1 AND 22);

-- Realm taxonomy Tag nodes carry their query authority in the versioned
-- Content Structure state. This keeps tree edits and strategy edits inside the
-- same optimistic-concurrency boundary.
ALTER TABLE "content_structure_node"
  ADD COLUMN "realm_tag_query_strategy" text,
  ADD CONSTRAINT "content_structure_node_realm_tag_query_strategy_check"
    CHECK (
      "realm_tag_query_strategy" IS NULL
      OR "realm_tag_query_strategy" IN (
        'global_effective',
        'realm_community',
        'realm_policy'
      )
    );

UPDATE "content_structure_node" AS node
SET "realm_tag_query_strategy" = 'global_effective'
FROM "content_structure" AS structure
INNER JOIN "tag" ON TRUE
WHERE structure."id" = node."structure_id"
  AND structure."kind" = 'realm.taxonomy'
  AND "tag"."id" = node."content_unit_id";

CREATE FUNCTION "enforce_realm_taxonomy_tag_query_strategy"() RETURNS trigger
LANGUAGE plpgsql AS $$
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
$$;

CREATE TRIGGER "content_structure_node_realm_tag_query_strategy"
BEFORE INSERT OR UPDATE OF
  "structure_id",
  "content_unit_id",
  "realm_tag_query_strategy",
  "deleted_at"
ON "content_structure_node"
FOR EACH ROW EXECUTE FUNCTION "enforce_realm_taxonomy_tag_query_strategy"();

-- Realm Tag Context is one canonical Wiki explanation per Realm and Tag. Votes
-- remain Unit–Tag assertions and no longer use Context as their parent row.
DROP TRIGGER "realm_tag_vote_stat_maintain" ON "realm_tag_vote";
DROP FUNCTION "maintain_realm_tag_vote_stat"();

ALTER TABLE "realm_tag_vote_stat"
  DROP CONSTRAINT "realm_tag_vote_stat_context_fkey";
ALTER TABLE "realm_tag_vote"
  DROP CONSTRAINT "realm_tag_vote_context_fkey";
ALTER TABLE "realm_tag_context"
  DROP CONSTRAINT "realm_tag_context_pkey",
  DROP CONSTRAINT "realm_tag_context_not_self_check",
  DROP CONSTRAINT "realm_tag_context_tag_id_tag_id_fkey",
  ADD CONSTRAINT "realm_tag_context_tag_id_tag_id_fkey"
    FOREIGN KEY ("tag_id") REFERENCES "tag" ("id") ON DELETE RESTRICT;

DROP TRIGGER "search_projection_touch_realm_tag_context_insert" ON "realm_tag_context";
DROP TRIGGER "search_projection_touch_realm_tag_context_update" ON "realm_tag_context";
DROP TRIGGER "search_projection_touch_realm_tag_context_delete" ON "realm_tag_context";

DELETE FROM "realm_tag_context" AS context
WHERE NOT EXISTS (
  SELECT 1
  FROM "post"
  WHERE "post"."id" = context."context_post_id"
    AND "post"."kind" = 'wiki'
);

WITH ranked_contexts AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY "realm_id", "tag_id"
      ORDER BY "updated_at" DESC, "created_at" DESC, "context_post_id" DESC
    ) AS rank
  FROM "realm_tag_context"
)
DELETE FROM "realm_tag_context"
USING ranked_contexts
WHERE "realm_tag_context".ctid = ranked_contexts.ctid
  AND ranked_contexts.rank > 1;

WITH ranked_posts AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY "context_post_id"
      ORDER BY "updated_at" DESC, "realm_id", "tag_id"
    ) AS rank
  FROM "realm_tag_context"
)
DELETE FROM "realm_tag_context"
USING ranked_posts
WHERE "realm_tag_context".ctid = ranked_posts.ctid
  AND ranked_posts.rank > 1;

DROP INDEX "realm_tag_context_tag_idx";
ALTER TABLE "realm_tag_context"
  DROP COLUMN "unit_id",
  ADD CONSTRAINT "realm_tag_context_pkey" PRIMARY KEY ("realm_id", "tag_id");
CREATE UNIQUE INDEX "realm_tag_context_post_unique"
  ON "realm_tag_context" ("context_post_id");

ALTER TABLE "realm_tag_vote"
  ADD CONSTRAINT "realm_tag_vote_realm_fkey"
    FOREIGN KEY ("realm_id") REFERENCES "realm" ("id") ON DELETE CASCADE,
  ADD CONSTRAINT "realm_tag_vote_unit_fkey"
    FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON DELETE CASCADE,
  ADD CONSTRAINT "realm_tag_vote_tag_fkey"
    FOREIGN KEY ("tag_id") REFERENCES "tag" ("id") ON DELETE CASCADE,
  ADD CONSTRAINT "realm_tag_vote_not_self_check"
    CHECK ("unit_id" <> "tag_id");
CREATE INDEX "realm_tag_vote_realm_tag_unit_idx"
  ON "realm_tag_vote" ("realm_id", "tag_id", "unit_id");

ALTER TABLE "realm_tag_vote_stat"
  ADD CONSTRAINT "realm_tag_vote_stat_realm_fkey"
    FOREIGN KEY ("realm_id") REFERENCES "realm" ("id") ON DELETE CASCADE,
  ADD CONSTRAINT "realm_tag_vote_stat_unit_fkey"
    FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON DELETE CASCADE,
  ADD CONSTRAINT "realm_tag_vote_stat_tag_fkey"
    FOREIGN KEY ("tag_id") REFERENCES "tag" ("id") ON DELETE CASCADE;
CREATE INDEX "realm_tag_vote_stat_realm_tag_unit_idx"
  ON "realm_tag_vote_stat" ("realm_id", "tag_id", "unit_id");

TRUNCATE TABLE "realm_tag_vote_stat";
INSERT INTO "realm_tag_vote_stat" (
  "realm_id",
  "unit_id",
  "tag_id",
  "score",
  "vote_count"
)
SELECT
  "realm_id",
  "unit_id",
  "tag_id",
  sum("value")::bigint,
  count(*)::bigint
FROM "realm_tag_vote"
GROUP BY "realm_id", "unit_id", "tag_id";

CREATE FUNCTION "maintain_realm_tag_vote_stat"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  row_data realm_tag_vote%ROWTYPE;
  direction bigint;
  change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL
    SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data;
    direction := change.direction;
    IF direction < 0 THEN
      UPDATE realm_tag_vote_stat
      SET
        score = score + direction * row_data.value,
        vote_count = vote_count + direction,
        updated_at = now()
      WHERE realm_id = row_data.realm_id
        AND unit_id = row_data.unit_id
        AND tag_id = row_data.tag_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'missing realm_tag_vote_stat row for decrement: %, %, %',
          row_data.realm_id, row_data.unit_id, row_data.tag_id
          USING ERRCODE = '23514';
      END IF;
    ELSE
      INSERT INTO realm_tag_vote_stat (realm_id, unit_id, tag_id, score, vote_count)
      VALUES (
        row_data.realm_id,
        row_data.unit_id,
        row_data.tag_id,
        direction * row_data.value,
        direction
      )
      ON CONFLICT (realm_id, unit_id, tag_id) DO UPDATE SET
        score = realm_tag_vote_stat.score + excluded.score,
        vote_count = realm_tag_vote_stat.vote_count + excluded.vote_count,
        updated_at = now();
    END IF;
    DELETE FROM realm_tag_vote_stat
    WHERE realm_id = row_data.realm_id
      AND unit_id = row_data.unit_id
      AND tag_id = row_data.tag_id
      AND vote_count = 0;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER "realm_tag_vote_stat_maintain"
AFTER INSERT OR UPDATE OR DELETE ON "realm_tag_vote"
FOR EACH ROW EXECUTE FUNCTION "maintain_realm_tag_vote_stat"();

CREATE TRIGGER "search_projection_touch_realm_tag_vote_insert"
AFTER INSERT ON "realm_tag_vote"
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION "search_touch_current_statement"('unit_id');

CREATE TRIGGER "search_projection_touch_realm_tag_vote_update"
AFTER UPDATE ON "realm_tag_vote"
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION "search_touch_current_statement"('unit_id');

CREATE TRIGGER "search_projection_touch_realm_tag_vote_delete"
AFTER DELETE ON "realm_tag_vote"
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT
EXECUTE FUNCTION "search_touch_current_statement"('unit_id');

CREATE FUNCTION "enforce_realm_tag_context_wiki_post"() RETURNS trigger
LANGUAGE plpgsql AS $$
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
$$;

CREATE TRIGGER "realm_tag_context_wiki_post"
BEFORE INSERT OR UPDATE OF "context_post_id" ON "realm_tag_context"
FOR EACH ROW EXECUTE FUNCTION "enforce_realm_tag_context_wiki_post"();

CREATE FUNCTION "protect_realm_tag_context_post_kind"() RETURNS trigger
LANGUAGE plpgsql AS $$
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
$$;

CREATE TRIGGER "post_realm_tag_context_kind"
BEFORE UPDATE OF "kind" ON "post"
FOR EACH ROW EXECUTE FUNCTION "protect_realm_tag_context_post_kind"();

DROP INDEX "realm_unit_tag_tag_idx";
CREATE INDEX "realm_unit_tag_tag_idx"
  ON "realm_unit_tag" ("realm_id", "tag_id", "unit_id");

CREATE TRIGGER "search_projection_touch_realm_unit_tag_insert"
AFTER INSERT ON "realm_unit_tag"
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION "search_touch_current_statement"('unit_id');

CREATE TRIGGER "search_projection_touch_realm_unit_tag_update"
AFTER UPDATE ON "realm_unit_tag"
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION "search_touch_current_statement"('unit_id');

CREATE TRIGGER "search_projection_touch_realm_unit_tag_delete"
AFTER DELETE ON "realm_unit_tag"
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT
EXECUTE FUNCTION "search_touch_current_statement"('unit_id');
