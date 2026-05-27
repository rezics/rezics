CREATE TYPE "RankingScopeKind" AS ENUM ('global', 'realm', 'work', 'tag', 'parent');
CREATE TYPE "RankingRankKind" AS ENUM ('content', 'post', 'comment');
CREATE TYPE "RankingSignalKind" AS ENUM ('view', 'read');
CREATE TYPE "RankingPatchStatus" AS ENUM ('pending', 'patched', 'failed', 'skipped');

CREATE TABLE "UnitRankProjection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "unitId" UUID NOT NULL,
  "scopeKind" "RankingScopeKind" NOT NULL,
  "scopeId" UUID,
  "scopeKey" VARCHAR(64) NOT NULL,
  "rankKind" "RankingRankKind" NOT NULL,
  "hotScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "topScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "formulaVersion" TEXT NOT NULL,
  "signalSnapshot" JSONB NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rankUpdatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UnitRankProjection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RankingSignalBucket" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "unitId" UUID NOT NULL,
  "signalKind" "RankingSignalKind" NOT NULL,
  "bucketStart" TIMESTAMP(3) NOT NULL,
  "bucketEnd" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "flushedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RankingSignalBucket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RankingFormulaVersion" (
  "version" TEXT NOT NULL,
  "rankKinds" TEXT[],
  "description" TEXT,
  "config" JSONB NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RankingFormulaVersion_pkey" PRIMARY KEY ("version")
);

CREATE TABLE "ServingPatchStatus" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "projectionId" UUID NOT NULL,
  "unitId" UUID NOT NULL,
  "indexName" VARCHAR(64) NOT NULL,
  "documentId" UUID NOT NULL,
  "status" "RankingPatchStatus" NOT NULL DEFAULT 'pending',
  "patchedAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "source" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServingPatchStatus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UnitRankProjection_unitId_scopeKind_scopeKey_rankKind_key" ON "UnitRankProjection"("unitId", "scopeKind", "scopeKey", "rankKind");
CREATE INDEX "UnitRankProjection_unitId_idx" ON "UnitRankProjection"("unitId");
CREATE INDEX "UnitRankProjection_scopeKind_scopeId_rankKind_idx" ON "UnitRankProjection"("scopeKind", "scopeId", "rankKind");
CREATE INDEX "UnitRankProjection_rankKind_hotScore_idx" ON "UnitRankProjection"("rankKind", "hotScore");
CREATE INDEX "UnitRankProjection_rankKind_trendingScore_idx" ON "UnitRankProjection"("rankKind", "trendingScore");
CREATE UNIQUE INDEX "RankingSignalBucket_unitId_signalKind_bucketStart_key" ON "RankingSignalBucket"("unitId", "signalKind", "bucketStart");
CREATE INDEX "RankingSignalBucket_signalKind_bucketStart_idx" ON "RankingSignalBucket"("signalKind", "bucketStart");
CREATE INDEX "RankingSignalBucket_unitId_flushedAt_idx" ON "RankingSignalBucket"("unitId", "flushedAt");
CREATE INDEX "ServingPatchStatus_unitId_idx" ON "ServingPatchStatus"("unitId");
CREATE INDEX "ServingPatchStatus_indexName_documentId_idx" ON "ServingPatchStatus"("indexName", "documentId");
CREATE INDEX "ServingPatchStatus_status_lastAttemptAt_idx" ON "ServingPatchStatus"("status", "lastAttemptAt");

ALTER TABLE "ServingPatchStatus"
  ADD CONSTRAINT "ServingPatchStatus_projectionId_fkey"
  FOREIGN KEY ("projectionId")
  REFERENCES "UnitRankProjection"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
