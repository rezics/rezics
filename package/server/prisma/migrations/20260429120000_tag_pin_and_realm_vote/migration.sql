-- AlterTable: UnitTag — add pinned + position
ALTER TABLE "UnitTag" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UnitTag" ADD COLUMN "position" TEXT;

-- AlterTable: RealmTagUnit — add score, voteCount, pinned, position, updatedAt
ALTER TABLE "RealmTagUnit" ADD COLUMN "score" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RealmTagUnit" ADD COLUMN "voteCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RealmTagUnit" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RealmTagUnit" ADD COLUMN "position" TEXT;
ALTER TABLE "RealmTagUnit" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable: RealmTagVote
CREATE TABLE "RealmTagVote" (
    "realmUnitId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "tagUnitId" UUID NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RealmTagVote_pkey" PRIMARY KEY ("realmUnitId","userId","unitId","tagUnitId")
);

-- CreateIndex: pin-first lookup on UnitTag
CREATE INDEX "UnitTag_unitId_pinned_position_idx" ON "UnitTag"("unitId", "pinned", "position");

-- CreateIndex: pin-first lookup and score lookup on RealmTagUnit
CREATE INDEX "RealmTagUnit_realmUnitId_unitId_pinned_position_idx" ON "RealmTagUnit"("realmUnitId", "unitId", "pinned", "position");
CREATE INDEX "RealmTagUnit_realmUnitId_unitId_score_idx" ON "RealmTagUnit"("realmUnitId", "unitId", "score");

-- CreateIndex: lookup indexes for RealmTagVote
CREATE INDEX "RealmTagVote_realmUnitId_unitId_tagUnitId_idx" ON "RealmTagVote"("realmUnitId", "unitId", "tagUnitId");
CREATE INDEX "RealmTagVote_userId_idx" ON "RealmTagVote"("userId");

-- AddForeignKey: RealmTagVote → Unit (realm, unit, tag)
ALTER TABLE "RealmTagVote" ADD CONSTRAINT "RealmTagVote_realmUnitId_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RealmTagVote" ADD CONSTRAINT "RealmTagVote_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RealmTagVote" ADD CONSTRAINT "RealmTagVote_tagUnitId_fkey" FOREIGN KEY ("tagUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- BACKFILL: convert legacy "official boost" UnitTag rows.
-- Idempotent: re-running on an already-migrated DB is a no-op.
-- Marker: position values prefixed with '!legacy-' identify rows
-- that were converted from the legacy score>=1000 sentinel.
-- ============================================================

-- Step 1. Pin rows whose legacy score >= 1000 (and not already pinned).
-- Position is assigned deterministically by descending legacy score then
-- by (unitId, tagUnitId) as a stable tiebreaker. The leading '!' makes
-- these positions sort lexicographically before any base62 fractional
-- indexing key (which starts at '0'..'9' or 'A'..'Z' or 'a'..'z').
WITH legacy_pinned AS (
    SELECT
        "unitId",
        "tagUnitId",
        ROW_NUMBER() OVER (
            ORDER BY "score" DESC, "unitId", "tagUnitId"
        ) AS rn
    FROM "UnitTag"
    WHERE "score" >= 1000 AND "pinned" = false
)
UPDATE "UnitTag" ut
SET
    "pinned" = true,
    "position" = '!legacy-' || lpad(legacy_pinned.rn::text, 6, '0')
FROM legacy_pinned
WHERE ut."unitId" = legacy_pinned."unitId"
  AND ut."tagUnitId" = legacy_pinned."tagUnitId";

-- Step 2. Reset score and voteCount on legacy-converted rows from TagVote
-- aggregate. Scoped to '!legacy-' positions so re-running is safe and so
-- non-legacy pinned rows (e.g. seed installer output) are not touched.
UPDATE "UnitTag" ut
SET
    "score" = COALESCE(agg.sum_value, 0),
    "voteCount" = COALESCE(agg.cnt, 0)
FROM (
    SELECT "unitId", "tagUnitId",
           SUM("value")::INTEGER AS sum_value,
           COUNT(*)::INTEGER AS cnt
    FROM "TagVote"
    GROUP BY "unitId", "tagUnitId"
) agg
WHERE ut."unitId" = agg."unitId"
  AND ut."tagUnitId" = agg."tagUnitId"
  AND ut."pinned" = true
  AND ut."position" LIKE '!legacy-%';

-- Step 3. For legacy-converted rows with no TagVote rows at all, force
-- score and voteCount to 0 (the previous UPDATE leaves them untouched
-- because the join misses).
UPDATE "UnitTag" ut
SET "score" = 0, "voteCount" = 0
WHERE ut."pinned" = true
  AND ut."position" LIKE '!legacy-%'
  AND NOT EXISTS (
    SELECT 1 FROM "TagVote" tv
    WHERE tv."unitId" = ut."unitId"
      AND tv."tagUnitId" = ut."tagUnitId"
  );
