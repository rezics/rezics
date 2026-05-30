-- Collapse Post root-target projection into Post.targetUnitId.
--
-- Replies now carry the thread/root container target directly in targetUnitId;
-- direct reply topology remains parentPostUnitId/rootPostUnitId/path. Preserve
-- existing scoped-search semantics before dropping the rootTarget* shadow.

UPDATE "Post" AS p
SET "targetUnitId" = COALESCE(r."targetUnitId", p."rootTargetUnitId")
FROM "Post" AS r
WHERE p."rootPostUnitId" = r."unitId"
  AND COALESCE(r."targetUnitId", p."rootTargetUnitId") IS NOT NULL
  AND p."targetUnitId" IS DISTINCT FROM COALESCE(
    r."targetUnitId",
    p."rootTargetUnitId"
  );

UPDATE "Post"
SET "targetUnitId" = "rootTargetUnitId"
WHERE "rootPostUnitId" IS NULL
  AND "rootTargetUnitId" IS NOT NULL
  AND "targetUnitId" IS DISTINCT FROM "rootTargetUnitId";

DROP INDEX IF EXISTS "Post_rootTargetUnitId_createdAt_idx";
DROP INDEX IF EXISTS "Post_rootTargetUnitId_state_idx";

ALTER TABLE "Post"
  DROP COLUMN IF EXISTS "rootTargetUnitId",
  DROP COLUMN IF EXISTS "rootTargetUnitType";

CREATE INDEX IF NOT EXISTS "Post_targetUnitId_state_idx"
  ON "Post"("targetUnitId", "state");
