-- Manual migration (redesign-post-index-ltree).
--
-- Replaces the hand-rolled `Post.sortPath` materialized path with a native
-- Postgres `ltree` column `Post.path` indexed by GiST. This file is authored by
-- hand (note the `manual_` name): it enables the `ltree` extension, creates a
-- label sequence and a base36 helper, adds the nullable `path` column,
-- backfills every existing post from the `parentPostUnitId`/`depth` adjacency in
-- creation order, validates the result, and creates the raw-owned GiST index.
-- The GiST index is intentionally NOT modeled as a Prisma `@@index`.
--
-- The legacy `sortPath` column is dropped in the follow-on migration
-- `20260529140000_drop_post_sort_path` so that, before that step, reverting code
-- restores prior behavior without data loss.

-- 1. Enable the ltree extension (per database; pre-deploy project posture).
CREATE EXTENSION IF NOT EXISTS ltree;

-- 2. Global, append-only label source. base36 keeps labels short and valid as
--    ltree tokens ([A-Za-z0-9_]); the sequence removes the read-max-then-write
--    sibling-collision race of the old scheme.
CREATE SEQUENCE IF NOT EXISTS post_path_label_seq;

-- 3. base36 renderer for a bigint label. IMMUTABLE so it is usable in indexes
--    and cheap in backfill; retained for runtime path generation.
CREATE OR REPLACE FUNCTION rezics_to_base36(n bigint)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits CONSTANT text := '0123456789abcdefghijklmnopqrstuvwxyz';
  out text := '';
  v bigint := n;
BEGIN
  IF v IS NULL THEN
    RETURN NULL;
  END IF;
  IF v < 0 THEN
    RAISE EXCEPTION 'rezics_to_base36: negative input %', v;
  END IF;
  IF v = 0 THEN
    RETURN '0';
  END IF;
  WHILE v > 0 LOOP
    out := substr(digits, (v % 36)::int + 1, 1) || out;
    v := v / 36;
  END LOOP;
  RETURN out;
END;
$$;

-- 4. Add the path column (nullable during backfill).
ALTER TABLE "Post" ADD COLUMN "path" ltree;

-- 5. Backfill. Roots (no parent) get a single label; replies extend their
--    parent's path with one freshly minted label. Processing strictly by depth
--    guarantees every parent path is set before its children are visited, so
--    `path = parent.path || <newLabel>` holds without ever rewriting an
--    ancestor.
UPDATE "Post"
SET "path" = text2ltree(rezics_to_base36(nextval('post_path_label_seq')))
WHERE "parentPostUnitId" IS NULL;

DO $$
DECLARE
  d int;
  maxd int;
BEGIN
  SELECT COALESCE(MAX("depth"), 0) INTO maxd FROM "Post";
  FOR d IN 1..maxd LOOP
    UPDATE "Post" AS c
    SET "path" = p."path" || text2ltree(rezics_to_base36(nextval('post_path_label_seq')))
    FROM "Post" AS p
    WHERE c."parentPostUnitId" = p."unitId"
      AND c."depth" = d
      AND p."path" IS NOT NULL;
  END LOOP;
END $$;

-- 6. Validate the backfill; fail the migration on any mismatch.
DO $$
DECLARE
  bad bigint;
BEGIN
  SELECT count(*) INTO bad FROM "Post" WHERE "path" IS NULL;
  IF bad > 0 THEN
    RAISE EXCEPTION 'ltree backfill incomplete: % post(s) with NULL path', bad;
  END IF;

  SELECT count(*) INTO bad FROM "Post" WHERE nlevel("path") <> "depth" + 1;
  IF bad > 0 THEN
    RAISE EXCEPTION 'ltree backfill depth mismatch: % post(s) where nlevel(path) <> depth + 1', bad;
  END IF;

  SELECT count(*) INTO bad FROM (
    SELECT "path" FROM "Post" GROUP BY "path" HAVING count(*) > 1
  ) dups;
  IF bad > 0 THEN
    RAISE EXCEPTION 'ltree backfill produced % duplicate path(s)', bad;
  END IF;

  -- Subtree membership must agree with the rootPostUnitId adjacency: every
  -- post's path is contained in (a descendant of, or equal to) its root path.
  SELECT count(*) INTO bad
  FROM "Post" c
  JOIN "Post" r ON r."unitId" = COALESCE(c."rootPostUnitId", c."unitId")
  WHERE NOT (c."path" <@ r."path");
  IF bad > 0 THEN
    RAISE EXCEPTION 'ltree backfill: % post(s) whose path is not contained in their root path', bad;
  END IF;
END $$;

-- 7. Raw-owned GiST index backing `path <@ anchor.path` subtree containment.
--    Deliberately not a Prisma-managed @@index([path], type: Gist).
CREATE INDEX "Post_path_gist_idx" ON "Post" USING GIST ("path");

-- 8. Retain a btree on rootPostUnitId for the hot whole-thread retrieval path
--    (the old [rootPostUnitId, sortPath] index is dropped with the column in
--    the follow-on migration).
CREATE INDEX "Post_rootPostUnitId_createdAt_idx" ON "Post"("rootPostUnitId", "createdAt");
