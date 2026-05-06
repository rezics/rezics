-- Add pair-level realm tag interpretation contexts.
CREATE TABLE "RealmTagContext" (
    "realmUnitId" UUID NOT NULL,
    "tagUnitId" UUID NOT NULL,
    "contextUnitId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RealmTagContext_pkey" PRIMARY KEY ("realmUnitId","tagUnitId")
);

CREATE UNIQUE INDEX "RealmTagContext_contextUnitId_key" ON "RealmTagContext"("contextUnitId");
CREATE INDEX "RealmTagContext_tagUnitId_idx" ON "RealmTagContext"("tagUnitId");

ALTER TABLE "RealmTagContext"
  ADD CONSTRAINT "RealmTagContext_realmUnitId_fkey"
  FOREIGN KEY ("realmUnitId") REFERENCES "Realm"("unitId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RealmTagContext"
  ADD CONSTRAINT "RealmTagContext_tagUnitId_fkey"
  FOREIGN KEY ("tagUnitId") REFERENCES "Unit"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RealmTagContext"
  ADD CONSTRAINT "RealmTagContext_contextUnitId_fkey"
  FOREIGN KEY ("contextUnitId") REFERENCES "Unit"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- RealmTagUnit now relates to Realm on the realm side. The existing FK to
-- Unit is replaced by an FK to Realm(unitId); relation renames are Prisma-only.
ALTER TABLE "RealmTagUnit" DROP CONSTRAINT IF EXISTS "RealmTagUnit_realmUnitId_fkey";

ALTER TABLE "RealmTagUnit"
  ADD CONSTRAINT "RealmTagUnit_realmUnitId_fkey"
  FOREIGN KEY ("realmUnitId") REFERENCES "Realm"("unitId")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- RealmTagVote is now a vote on the RealmTagUnit application. Replace the
-- three independent Unit FKs with one composite FK to RealmTagUnit and reorder
-- the primary key to match generated selector usage.
ALTER TABLE "RealmTagVote" DROP CONSTRAINT IF EXISTS "RealmTagVote_realmUnitId_fkey";
ALTER TABLE "RealmTagVote" DROP CONSTRAINT IF EXISTS "RealmTagVote_tagUnitId_fkey";
ALTER TABLE "RealmTagVote" DROP CONSTRAINT IF EXISTS "RealmTagVote_unitId_fkey";
ALTER TABLE "RealmTagVote" DROP CONSTRAINT IF EXISTS "RealmTagVote_pkey";

ALTER TABLE "RealmTagVote"
  ADD CONSTRAINT "RealmTagVote_pkey"
  PRIMARY KEY ("realmUnitId","tagUnitId","unitId","userId");

ALTER TABLE "RealmTagVote"
  ADD CONSTRAINT "RealmTagVote_realmUnitId_tagUnitId_unitId_fkey"
  FOREIGN KEY ("realmUnitId","tagUnitId","unitId")
  REFERENCES "RealmTagUnit"("realmUnitId","tagUnitId","unitId")
  ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "RealmTagVote_realmUnitId_unitId_tagUnitId_idx";
DROP INDEX IF EXISTS "RealmTagUnit_realmUnitId_unitId_score_idx";
CREATE INDEX "RealmTagUnit_score_idx" ON "RealmTagUnit"("score");
