-- engagement-subscription
--
-- Introduces the generic `Subscription` edge model, denormalizes
-- `Unit.subscriberCount`, backfills existing `Follow` and `RealmMember`
-- rows into Subscription with `channels = ['*']`, recomputes
-- `User.followersCount` / `followingsCount` and `Unit.subscriberCount`
-- from the backfill, then drops the legacy `Follow` table.
--
-- Per `CLAUDE.md`, development-stage breaking cutover: no dual-read
-- window, no Follow alias table. Rollback path is restore-from-backup.
-- Run `openspec/changes/engagement-subscription/snapshot.sql` against
-- the live DB BEFORE applying this migration and preserve the output
-- to compare against the post-migration counts in task 9.4.

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "subscriberUnitId" UUID NOT NULL,
    "targetUnitId" UUID NOT NULL,
    "channels" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_subscriberUnitId_targetUnitId_key" ON "Subscription"("subscriberUnitId", "targetUnitId");

-- CreateIndex
CREATE INDEX "Subscription_targetUnitId_idx" ON "Subscription"("targetUnitId");

-- CreateIndex
CREATE INDEX "Subscription_subscriberUnitId_idx" ON "Subscription"("subscriberUnitId");

-- GIN index for the three-tier wildcard fan-out query in
-- `resolveRecipients`. Prisma does not model GIN, so this is raw.
-- Postgres `text[]` with GIN supports `@>` array-containment in O(log n).
CREATE INDEX "subscription_channels_gin" ON "Subscription" USING GIN ("channels");

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN "subscriberCount" INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------
-- Data backfill: Follow -> Subscription
-- ---------------------------------------------------------------------
-- Every existing follow row becomes a Subscription with channels=['*'].
-- ON CONFLICT covers the (rare) case where a (followerId, followingId)
-- pair already exists in Subscription via some prior staging run; the
-- @@unique on (subscriberUnitId, targetUnitId) is the conflict target.
INSERT INTO "Subscription" ("id", "subscriberUnitId", "targetUnitId", "channels", "createdAt", "updatedAt")
SELECT uuidv7(), "followerId", "followingId", ARRAY['*']::TEXT[], "createdAt", "createdAt"
FROM "Follow"
ON CONFLICT ("subscriberUnitId", "targetUnitId") DO NOTHING;

-- ---------------------------------------------------------------------
-- Data backfill: RealmMember -> Subscription (per design D5)
-- ---------------------------------------------------------------------
-- Members get an implicit subscription with channels=['*'] unless they
-- already have one (e.g. from a prior lurker subscription).
INSERT INTO "Subscription" ("id", "subscriberUnitId", "targetUnitId", "channels", "createdAt", "updatedAt")
SELECT uuidv7(), "userId", "realmUnitId", ARRAY['*']::TEXT[], NOW(), NOW()
FROM "RealmMember"
ON CONFLICT ("subscriberUnitId", "targetUnitId") DO NOTHING;

-- ---------------------------------------------------------------------
-- Recompute Unit.subscriberCount (design D8)
-- ---------------------------------------------------------------------
UPDATE "Unit" u
SET "subscriberCount" = sub.cnt
FROM (
    SELECT "targetUnitId", COUNT(*)::INTEGER AS cnt
    FROM "Subscription"
    GROUP BY "targetUnitId"
) sub
WHERE u."id" = sub."targetUnitId";

-- ---------------------------------------------------------------------
-- Recompute User.followersCount / followingsCount (design D6)
-- ---------------------------------------------------------------------
-- Restricted to USER->USER edges; non-USER target subscriptions feed
-- Unit.subscriberCount only.
UPDATE "User" usr
SET "followersCount" = COALESCE(c.cnt, 0)
FROM (
    SELECT s."targetUnitId" AS unit_id, COUNT(*)::INTEGER AS cnt
    FROM "Subscription" s
    JOIN "Unit" su ON su."id" = s."subscriberUnitId" AND su."type" = 'USER'
    JOIN "Unit" tu ON tu."id" = s."targetUnitId"     AND tu."type" = 'USER'
    GROUP BY s."targetUnitId"
) c
WHERE usr."unitId" = c.unit_id;

-- Users with zero followers post-migration: zero them explicitly so the
-- denormalized counter agrees with the recomputed source of truth.
UPDATE "User" usr
SET "followersCount" = 0
WHERE NOT EXISTS (
    SELECT 1
    FROM "Subscription" s
    JOIN "Unit" su ON su."id" = s."subscriberUnitId" AND su."type" = 'USER'
    JOIN "Unit" tu ON tu."id" = s."targetUnitId"     AND tu."type" = 'USER'
    WHERE s."targetUnitId" = usr."unitId"
);

UPDATE "User" usr
SET "followingsCount" = COALESCE(c.cnt, 0)
FROM (
    SELECT s."subscriberUnitId" AS unit_id, COUNT(*)::INTEGER AS cnt
    FROM "Subscription" s
    JOIN "Unit" su ON su."id" = s."subscriberUnitId" AND su."type" = 'USER'
    JOIN "Unit" tu ON tu."id" = s."targetUnitId"     AND tu."type" = 'USER'
    GROUP BY s."subscriberUnitId"
) c
WHERE usr."unitId" = c.unit_id;

UPDATE "User" usr
SET "followingsCount" = 0
WHERE NOT EXISTS (
    SELECT 1
    FROM "Subscription" s
    JOIN "Unit" su ON su."id" = s."subscriberUnitId" AND su."type" = 'USER'
    JOIN "Unit" tu ON tu."id" = s."targetUnitId"     AND tu."type" = 'USER'
    WHERE s."subscriberUnitId" = usr."unitId"
);

-- ---------------------------------------------------------------------
-- Drop legacy Follow table and its FKs
-- ---------------------------------------------------------------------
ALTER TABLE "Follow" DROP CONSTRAINT IF EXISTS "Follow_followerId_fkey";
ALTER TABLE "Follow" DROP CONSTRAINT IF EXISTS "Follow_followingId_fkey";
DROP TABLE "Follow";

-- ---------------------------------------------------------------------
-- AddForeignKey for Subscription (added last so the backfill INSERTs
-- above do not pay the per-row FK validation cost; the data they
-- reference is guaranteed valid because it originates from Follow /
-- RealmMember which already FK to Unit.)
-- ---------------------------------------------------------------------
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_subscriberUnitId_fkey" FOREIGN KEY ("subscriberUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_targetUnitId_fkey" FOREIGN KEY ("targetUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
