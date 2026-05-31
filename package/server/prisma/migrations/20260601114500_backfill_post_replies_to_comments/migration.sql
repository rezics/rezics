-- Move legacy Post reply rows into the first-class Comment extension.
--
-- Unit ids are preserved so reactions, moderation references, links, and
-- promotion rows keep pointing at the same Unit. Direct children of the root
-- become comments with parentCommentUnitId = NULL; nested replies keep their
-- parent Unit id. Comment paths are the old post ltree paths relative to the
-- root post label, matching the runtime Comment path writer.

CREATE TEMP TABLE "_legacy_post_reply_comment_realm" AS
SELECT
  p."unitId",
  COALESCE(
    (
      SELECT ur."realmUnitId"
      FROM "UnitRealm" ur
      WHERE ur."unitId" = p."unitId"
      ORDER BY
        CASE WHEN ur."state" = 'VISIBLE' THEN 0 ELSE 1 END,
        ur."createdAt",
        ur."realmUnitId"
      LIMIT 1
    ),
    (
      SELECT ur."realmUnitId"
      FROM "UnitRealm" ur
      WHERE ur."unitId" = p."rootPostUnitId"
      ORDER BY
        CASE WHEN ur."state" = 'VISIBLE' THEN 0 ELSE 1 END,
        ur."createdAt",
        ur."realmUnitId"
      LIMIT 1
    )
  ) AS "realmUnitId"
FROM "Post" p
WHERE p."depth" > 0
   OR p."parentPostUnitId" IS NOT NULL;

DO $$
DECLARE
  unresolved bigint;
BEGIN
  SELECT count(*) INTO unresolved
  FROM "_legacy_post_reply_comment_realm"
  WHERE "realmUnitId" IS NULL;

  IF unresolved > 0 THEN
    RAISE EXCEPTION 'Cannot backfill % legacy Post reply row(s): no realm partition could be resolved', unresolved;
  END IF;
END $$;

INSERT INTO "Comment" (
  "unitId",
  "rootUnitId",
  "realmUnitId",
  "parentCommentUnitId",
  "authorUserId",
  "content",
  "depth",
  "path",
  "replyCount",
  "directReplyCount",
  "lastReplyAt",
  "isLocked",
  "state",
  "createdAt",
  "updatedAt"
)
SELECT
  p."unitId",
  p."rootPostUnitId",
  r."realmUnitId",
  CASE
    WHEN p."parentPostUnitId" = p."rootPostUnitId" THEN NULL
    ELSE p."parentPostUnitId"
  END,
  p."authorUserId",
  p."content",
  p."depth",
  CASE
    WHEN p."path" IS NULL THEN NULL
    WHEN nlevel(p."path") > 1 THEN subpath(p."path", 1)
    ELSE p."path"
  END,
  p."replyCount",
  p."directReplyCount",
  p."lastReplyAt",
  p."isLocked",
  p."state",
  p."createdAt",
  p."updatedAt"
FROM "Post" p
JOIN "_legacy_post_reply_comment_realm" r ON r."unitId" = p."unitId"
WHERE p."rootPostUnitId" IS NOT NULL
  AND (
    p."depth" > 0
    OR p."parentPostUnitId" IS NOT NULL
  )
ON CONFLICT ("unitId") DO UPDATE SET
  "rootUnitId" = EXCLUDED."rootUnitId",
  "realmUnitId" = EXCLUDED."realmUnitId",
  "parentCommentUnitId" = EXCLUDED."parentCommentUnitId",
  "authorUserId" = EXCLUDED."authorUserId",
  "content" = EXCLUDED."content",
  "depth" = EXCLUDED."depth",
  "path" = EXCLUDED."path",
  "replyCount" = EXCLUDED."replyCount",
  "directReplyCount" = EXCLUDED."directReplyCount",
  "lastReplyAt" = EXCLUDED."lastReplyAt",
  "isLocked" = EXCLUDED."isLocked",
  "state" = EXCLUDED."state",
  "createdAt" = EXCLUDED."createdAt",
  "updatedAt" = EXCLUDED."updatedAt";

DO $$
DECLARE
  missing bigint;
BEGIN
  SELECT count(*) INTO missing
  FROM "Post" p
  LEFT JOIN "Comment" c ON c."unitId" = p."unitId"
  WHERE (
      p."depth" > 0
      OR p."parentPostUnitId" IS NOT NULL
    )
    AND c."unitId" IS NULL;

  IF missing > 0 THEN
    RAISE EXCEPTION 'Legacy Post reply backfill incomplete: % row(s) not copied to Comment', missing;
  END IF;
END $$;

UPDATE "Unit" u
SET "type" = 'COMMENT'
FROM "Post" p
WHERE u."id" = p."unitId"
  AND (
    p."depth" > 0
    OR p."parentPostUnitId" IS NOT NULL
  );

DELETE FROM "Post"
WHERE "depth" > 0
   OR "parentPostUnitId" IS NOT NULL;

DROP TABLE "_legacy_post_reply_comment_realm";
