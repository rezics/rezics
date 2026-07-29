-- Realm-owned navigation is the Wiki's ordered navigation resource. Rename the
-- persisted kind and every immutable history payload so current reads, replay,
-- restore, and new writes use the same contract.
ALTER TABLE "content_structure"
  DROP CONSTRAINT "content_structure_kind_check",
  DROP CONSTRAINT "content_structure_navigation_document_key_check";

UPDATE "content_structure"
SET "kind" = 'wiki.navigation'
WHERE "kind" = 'realm.navigation';

-- Match services/history/content.ts canonicalRevisionJson exactly: object keys
-- are sorted, arrays retain order, and separators contain no whitespace.
CREATE FUNCTION pg_temp.canonical_revision_json(jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS 'SELECT NULL::text';

CREATE OR REPLACE FUNCTION pg_temp.canonical_revision_json(value jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT CASE jsonb_typeof(value)
    WHEN 'object' THEN
      '{' || COALESCE((
        SELECT string_agg(
          to_jsonb(entry.key)::text || ':' || pg_temp.canonical_revision_json(entry.value),
          ',' ORDER BY entry.key
        )
        FROM jsonb_each(value) AS entry
      ), '') || '}'
    WHEN 'array' THEN
      '[' || COALESCE((
        SELECT string_agg(
          pg_temp.canonical_revision_json(entry.value),
          ',' ORDER BY entry.ordinality
        )
        FROM jsonb_array_elements(value) WITH ORDINALITY AS entry(value, ordinality)
      ), '') || ']'
    ELSE value::text
  END
$$;

WITH rewritten AS (
  SELECT
    "id",
    "encoding",
    "base_content_id",
    replace("payload"::text, '"realm.navigation"', '"wiki.navigation"')::jsonb AS "payload"
  FROM "revision_content"
  WHERE "model" = 'rezics.content-structure.v1'
    AND "payload"::text LIKE '%"realm.navigation"%'
),
canonical AS (
  SELECT
    "id",
    "payload",
    pg_temp.canonical_revision_json("payload") AS "payload_text",
    CASE
      WHEN "encoding" = 'full' THEN pg_temp.canonical_revision_json("payload")
      ELSE pg_temp.canonical_revision_json(
        jsonb_build_object(
          'encoding', "encoding",
          'baseContentId', "base_content_id",
          'payload', "payload"
        )
      )
    END AS "content_text"
  FROM rewritten
)
UPDATE "revision_content" AS content
SET
  "payload" = canonical."payload",
  "sha256" = encode(sha256(convert_to(canonical."content_text", 'UTF8')), 'hex'),
  "byte_size" = octet_length(canonical."payload_text")
FROM canonical
WHERE content."id" = canonical."id";

DROP FUNCTION pg_temp.canonical_revision_json(jsonb);

ALTER TABLE "content_structure"
  ADD CONSTRAINT "content_structure_kind_check"
    CHECK ("kind" IN (
      'book.contents',
      'post.contents',
      'realm.taxonomy',
      'wiki.navigation',
      'zone.navigation',
      'page-structure'
    )),
  ADD CONSTRAINT "content_structure_navigation_document_key_check"
    CHECK (
      ("kind" IN ('wiki.navigation', 'zone.navigation'))
      = ("document_key" IS NOT NULL)
    );
