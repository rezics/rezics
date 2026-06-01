ALTER TABLE "Reaction"
  ADD COLUMN "scopeKey" VARCHAR(128) NOT NULL DEFAULT 'direct';

ALTER TABLE "ReactionSummary"
  ADD COLUMN "scopeKey" VARCHAR(128) NOT NULL DEFAULT 'direct';

DROP INDEX IF EXISTS "Reaction_userId_targetId_reaction_key";
ALTER TABLE "ReactionSummary" DROP CONSTRAINT "ReactionSummary_pkey";

CREATE UNIQUE INDEX "Reaction_userId_targetId_reaction_scopeKey_key"
  ON "Reaction"("userId", "targetId", "reaction", "scopeKey");

CREATE INDEX "Reaction_targetId_reaction_scopeKey_idx"
  ON "Reaction"("targetId", "reaction", "scopeKey");

CREATE INDEX "Reaction_userId_targetId_idx"
  ON "Reaction"("userId", "targetId");

ALTER TABLE "ReactionSummary"
  ADD CONSTRAINT "ReactionSummary_pkey"
  PRIMARY KEY ("targetId", "reaction", "scopeKey");

CREATE INDEX "ReactionSummary_targetId_reaction_idx"
  ON "ReactionSummary"("targetId", "reaction");

CREATE TABLE "ReactionTargetUsage" (
  "userId" UUID NOT NULL,
  "targetId" UUID NOT NULL,
  "activeCount" INTEGER NOT NULL DEFAULT 0,
  "maxActive" INTEGER NOT NULL DEFAULT 3,
  CONSTRAINT "ReactionTargetUsage_pkey" PRIMARY KEY ("userId", "targetId")
);

CREATE INDEX "ReactionTargetUsage_targetId_idx"
  ON "ReactionTargetUsage"("targetId");

INSERT INTO "ReactionTargetUsage" ("userId", "targetId", "activeCount", "maxActive")
SELECT "userId", "targetId", COUNT(*)::integer, 3
FROM "Reaction"
GROUP BY "userId", "targetId"
ON CONFLICT ("userId", "targetId") DO UPDATE
SET "activeCount" = EXCLUDED."activeCount";
