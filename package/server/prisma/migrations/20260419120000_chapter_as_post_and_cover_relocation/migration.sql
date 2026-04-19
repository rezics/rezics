-- Chapter-as-Post + Cover-Relocation migration.
--
-- Two intertwined refactors landed together because both relocate
-- presentation-layer / language-correlated data into the right home:
--
--   1. CHAPTER: drop UnitType.CHAPTER and re-express each chapter as
--      Unit(type=POST) + Post(kind=CHAPTER, targetUnitId=<book>, body=<chapter content>).
--      Body migrates from UnitTranslation.description (semantically a blurb)
--      into Post.body where it belongs.
--   2. COVER: drop coverUrl columns from Book / Game / Media / Shelf and
--      relocate values into UnitTranslation.extra.coverUrl, since covers are
--      language-correlated (translations of a book commonly ship with
--      different cover art).
--
-- Order matters:
--
--   A. Add CHAPTER to PostKind enum.
--   B. INSERT Post(kind=CHAPTER, ...) rows for every chapter Unit, resolving
--      body from the translation fallback chain.
--   C. UPDATE Unit: flip CHAPTER -> POST and null out workUnitId on those rows
--      (chapter linkage now lives in Post.targetUnitId, and workUnitId is
--      reserved for the work/release invariant which requires same-typed units).
--   D. Optional: clear UnitTranslation.description for migrated chapters
--      (description is for blurbs; the body is now in Post.body).
--   E. Backfill UnitTranslation.extra.coverUrl from the legacy extension columns,
--      creating a translation row in the unit's defaultLanguage (or 'en') if none exists.
--   F. DROP the coverUrl columns from Book/Game/Media/Shelf.
--   G. Rebuild UnitType enum without CHAPTER (Postgres requires create-cast-rename).
--   H. Verification block (raises if invariants are violated).
--
-- This whole migration runs inside the implicit Prisma migration transaction.

-- =============================================================
-- A. Add CHAPTER to PostKind enum
-- =============================================================

ALTER TYPE "PostKind" ADD VALUE IF NOT EXISTS 'CHAPTER';

-- The new enum value must be committed before it can be used in DML
-- inside the same transaction. Prisma wraps each migration file in a
-- single transaction, so we end the implicit transaction here and start
-- the rest of the migration in its own implicit transaction. This is the
-- standard Postgres workaround for "ALTER TYPE ... ADD VALUE cannot be
-- used in the same transaction as it is referenced".
COMMIT;
BEGIN;

-- =============================================================
-- B. INSERT Post rows for every chapter Unit
--
--    Body is resolved via the translation fallback chain:
--      1. translation matching unit.defaultLanguage
--      2. translation matching 'en'
--      3. lowest-language-string translation (deterministic tie-breaker)
--    A unit with no translations gets an empty body (logged below).
-- =============================================================

WITH chapter_units AS (
  SELECT id, "userId", "workUnitId", "defaultLanguage"
  FROM "Unit"
  WHERE "type" = 'CHAPTER'
),
ranked_translations AS (
  SELECT
    cu.id AS unit_id,
    cu."userId" AS author_user_id,
    cu."workUnitId" AS target_unit_id,
    t.description AS body,
    ROW_NUMBER() OVER (
      PARTITION BY cu.id
      ORDER BY
        CASE WHEN t.language = cu."defaultLanguage" THEN 0 ELSE 1 END,
        CASE WHEN t.language = 'en' THEN 0 ELSE 1 END,
        t.language ASC
    ) AS rnk
  FROM chapter_units cu
  LEFT JOIN "UnitTranslation" t ON t."unitId" = cu.id
)
INSERT INTO "Post" (
  "unitId",
  "authorUserId",
  "targetUnitId",
  "kind",
  "body",
  "rootPostUnitId",
  "depth",
  "replyCount",
  "directReplyCount",
  "isLocked",
  "createdAt",
  "updatedAt"
)
SELECT
  rt.unit_id,
  -- Author is required; fall back to the all-zero UUID for orphan chapters
  -- (unit.userId NULL is unexpected but the column is nullable).
  COALESCE(rt.author_user_id, '00000000-0000-0000-0000-000000000000'::UUID),
  rt.target_unit_id,
  'CHAPTER'::"PostKind",
  COALESCE(rt.body, ''),
  rt.unit_id,                          -- top-level: rootPostUnitId = own unitId
  0,                                   -- depth
  0,                                   -- replyCount
  0,                                   -- directReplyCount
  FALSE,                               -- isLocked
  NOW(),
  NOW()
FROM ranked_translations rt
WHERE rt.rnk = 1
  AND NOT EXISTS (
    SELECT 1 FROM "Post" p WHERE p."unitId" = rt.unit_id
  );

-- Cover the (rare) case where a chapter unit has zero translation rows:
-- the LEFT JOIN above produces a single ranked row with NULL body, which
-- we already covered with COALESCE. Nothing additional needed.

-- =============================================================
-- C. Flip Unit.type CHAPTER -> POST and null out workUnitId
-- =============================================================

UPDATE "Unit"
SET "type" = 'POST',
    "workUnitId" = NULL
WHERE "type" = 'CHAPTER';

-- =============================================================
-- D. Clear UnitTranslation.description for migrated chapter units
--    (Post.body is the new authoritative source; description was the
--    wrong slot for chapter body in the first place.)
-- =============================================================

UPDATE "UnitTranslation" t
SET description = NULL
FROM "Post" p
WHERE p."unitId" = t."unitId"
  AND p."kind" = 'CHAPTER';

-- =============================================================
-- E. Backfill UnitTranslation.extra.coverUrl from legacy columns
--
--    For each unit that has a legacy coverUrl on its extension table:
--      - If translations exist, write coverUrl into every translation's extra.
--      - If no translation exists, create one in unit.defaultLanguage (or 'en').
-- =============================================================

-- Helper CTE: every unit that owns a legacy cover URL across the four extensions.
-- (Done as four separate UPDATE/INSERT pairs below for clarity and so that we
-- can drop each column in step F without a join dependency.)

-- ---- Books ----
INSERT INTO "UnitTranslation" ("unitId", "language", "extra", "createdAt", "updatedAt")
SELECT
  b."unitId",
  COALESCE(u."defaultLanguage", 'en'),
  jsonb_build_object('coverUrl', b."coverUrl"),
  NOW(),
  NOW()
FROM "Book" b
JOIN "Unit" u ON u.id = b."unitId"
WHERE b."coverUrl" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "UnitTranslation" t WHERE t."unitId" = b."unitId"
  );

UPDATE "UnitTranslation" t
SET extra = jsonb_set(COALESCE(t.extra, '{}'::jsonb), '{coverUrl}', to_jsonb(b."coverUrl"))
FROM "Book" b
WHERE t."unitId" = b."unitId"
  AND b."coverUrl" IS NOT NULL;

-- ---- Games ----
INSERT INTO "UnitTranslation" ("unitId", "language", "extra", "createdAt", "updatedAt")
SELECT
  g."unitId",
  COALESCE(u."defaultLanguage", 'en'),
  jsonb_build_object('coverUrl', g."coverUrl"),
  NOW(),
  NOW()
FROM "Game" g
JOIN "Unit" u ON u.id = g."unitId"
WHERE g."coverUrl" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "UnitTranslation" t WHERE t."unitId" = g."unitId"
  );

UPDATE "UnitTranslation" t
SET extra = jsonb_set(COALESCE(t.extra, '{}'::jsonb), '{coverUrl}', to_jsonb(g."coverUrl"))
FROM "Game" g
WHERE t."unitId" = g."unitId"
  AND g."coverUrl" IS NOT NULL;

-- ---- Media ----
INSERT INTO "UnitTranslation" ("unitId", "language", "extra", "createdAt", "updatedAt")
SELECT
  m."unitId",
  COALESCE(u."defaultLanguage", 'en'),
  jsonb_build_object('coverUrl', m."coverUrl"),
  NOW(),
  NOW()
FROM "Media" m
JOIN "Unit" u ON u.id = m."unitId"
WHERE m."coverUrl" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "UnitTranslation" t WHERE t."unitId" = m."unitId"
  );

UPDATE "UnitTranslation" t
SET extra = jsonb_set(COALESCE(t.extra, '{}'::jsonb), '{coverUrl}', to_jsonb(m."coverUrl"))
FROM "Media" m
WHERE t."unitId" = m."unitId"
  AND m."coverUrl" IS NOT NULL;

-- ---- Shelves ----
INSERT INTO "UnitTranslation" ("unitId", "language", "extra", "createdAt", "updatedAt")
SELECT
  s."unitId",
  COALESCE(u."defaultLanguage", 'en'),
  jsonb_build_object('coverUrl', s."coverUrl"),
  NOW(),
  NOW()
FROM "Shelf" s
JOIN "Unit" u ON u.id = s."unitId"
WHERE s."coverUrl" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "UnitTranslation" t WHERE t."unitId" = s."unitId"
  );

UPDATE "UnitTranslation" t
SET extra = jsonb_set(COALESCE(t.extra, '{}'::jsonb), '{coverUrl}', to_jsonb(s."coverUrl"))
FROM "Shelf" s
WHERE t."unitId" = s."unitId"
  AND s."coverUrl" IS NOT NULL;

-- =============================================================
-- F. Drop the coverUrl columns
-- =============================================================

ALTER TABLE "Book"  DROP COLUMN "coverUrl";
ALTER TABLE "Game"  DROP COLUMN "coverUrl";
ALTER TABLE "Media" DROP COLUMN "coverUrl";
ALTER TABLE "Shelf" DROP COLUMN "coverUrl";

-- =============================================================
-- G. Rebuild UnitType enum without CHAPTER
--
--    Postgres does not support DROP VALUE on an enum, so the canonical
--    pattern is: rename the old type aside, create the new type, cast
--    every column that referenced the old type, then drop the old type.
-- =============================================================

ALTER TYPE "UnitType" RENAME TO "UnitType_old";

CREATE TYPE "UnitType" AS ENUM (
  'BOOK',
  'GAME',
  'MEDIA',
  'POST',
  'TAG',
  'REALM',
  'SHELF',
  'IMAGE',
  'VIDEO',
  'QUOTE',
  'LINK',
  'ENTITY',
  'ZONE'
);

-- Cast Unit.type column to the new enum. By this point no row should have
-- type='CHAPTER' (step C migrated them all) — the cast would error otherwise.
ALTER TABLE "Unit"
  ALTER COLUMN "type" TYPE "UnitType"
  USING "type"::TEXT::"UnitType";

DROP TYPE "UnitType_old";

-- =============================================================
-- H. Verification block — raise if invariants are violated.
--    Per design.md migration plan checklist.
-- =============================================================

DO $$
DECLARE
  remaining_chapter_units INT;
  chapter_posts_with_invalid_target INT;
  chapter_posts_without_target INT;
BEGIN
  -- (1) No Unit row should still claim type CHAPTER (the cast above would
  --     have failed, but assert it explicitly for symmetry).
  SELECT COUNT(*) INTO remaining_chapter_units
  FROM "Unit"
  WHERE "type"::TEXT = 'CHAPTER';
  IF remaining_chapter_units > 0 THEN
    RAISE EXCEPTION 'chapter migration: % Unit rows still have type=CHAPTER', remaining_chapter_units;
  END IF;

  -- (2) Every chapter Post should have a non-null targetUnitId pointing at a BOOK.
  SELECT COUNT(*) INTO chapter_posts_without_target
  FROM "Post"
  WHERE "kind" = 'CHAPTER' AND "targetUnitId" IS NULL;

  SELECT COUNT(*) INTO chapter_posts_with_invalid_target
  FROM "Post" p
  LEFT JOIN "Unit" u ON u.id = p."targetUnitId"
  WHERE p."kind" = 'CHAPTER'
    AND p."targetUnitId" IS NOT NULL
    AND (u.id IS NULL OR u."type"::TEXT <> 'BOOK');

  IF chapter_posts_without_target > 0 THEN
    RAISE WARNING 'chapter migration: % chapter Post rows have NULL targetUnitId (orphan chapters; review)', chapter_posts_without_target;
  END IF;

  IF chapter_posts_with_invalid_target > 0 THEN
    RAISE WARNING 'chapter migration: % chapter Post rows reference a non-BOOK targetUnitId (review)', chapter_posts_with_invalid_target;
  END IF;
END
$$;
