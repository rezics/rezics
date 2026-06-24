CREATE TYPE "RankingPatchStatus" AS ENUM('pending', 'patched', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "RankingRankKind" AS ENUM('content', 'post', 'comment');--> statement-breakpoint
CREATE TYPE "RankingScopeKind" AS ENUM('global', 'realm', 'work', 'tag', 'parent');--> statement-breakpoint
CREATE TYPE "RankingSignalKind" AS ENUM('view', 'read');--> statement-breakpoint
CREATE TABLE "RankingFormulaVersion" (
	"version" text PRIMARY KEY,
	"rankKinds" text[],
	"description" text,
	"config" jsonb NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RankingSignalBucket" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"unitId" uuid NOT NULL,
	"signalKind" "RankingSignalKind" NOT NULL,
	"bucketStart" timestamp(3) NOT NULL,
	"bucketEnd" timestamp(3) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"flushedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ServingPatchStatus" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"projectionId" uuid NOT NULL,
	"unitId" uuid NOT NULL,
	"indexName" varchar(64) NOT NULL,
	"documentId" uuid NOT NULL,
	"status" "RankingPatchStatus" DEFAULT 'pending'::"RankingPatchStatus" NOT NULL,
	"patchedAt" timestamp(3),
	"lastAttemptAt" timestamp(3),
	"retryCount" integer DEFAULT 0 NOT NULL,
	"lastError" text,
	"source" jsonb,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UnitRankProjection" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"unitId" uuid NOT NULL,
	"scopeKind" "RankingScopeKind" NOT NULL,
	"scopeId" uuid,
	"scopeKey" varchar(64) NOT NULL,
	"rankKind" "RankingRankKind" NOT NULL,
	"hotScore" double precision DEFAULT 0 NOT NULL,
	"topScore" double precision DEFAULT 0 NOT NULL,
	"trendingScore" double precision DEFAULT 0 NOT NULL,
	"qualityScore" double precision DEFAULT 0 NOT NULL,
	"formulaVersion" text NOT NULL,
	"signalSnapshot" jsonb NOT NULL,
	"computedAt" timestamp(3) DEFAULT now() NOT NULL,
	"rankUpdatedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "RankingSignalBucket_unitId_signalKind_bucketStart_key" ON "RankingSignalBucket" ("unitId","signalKind","bucketStart");--> statement-breakpoint
CREATE INDEX "RankingSignalBucket_signalKind_bucketStart_idx" ON "RankingSignalBucket" ("signalKind","bucketStart");--> statement-breakpoint
CREATE INDEX "RankingSignalBucket_unitId_flushedAt_idx" ON "RankingSignalBucket" ("unitId","flushedAt");--> statement-breakpoint
CREATE INDEX "ServingPatchStatus_unitId_idx" ON "ServingPatchStatus" ("unitId");--> statement-breakpoint
CREATE INDEX "ServingPatchStatus_indexName_documentId_idx" ON "ServingPatchStatus" ("indexName","documentId");--> statement-breakpoint
CREATE INDEX "ServingPatchStatus_status_lastAttemptAt_idx" ON "ServingPatchStatus" ("status","lastAttemptAt");--> statement-breakpoint
CREATE UNIQUE INDEX "UnitRankProjection_unitId_scopeKind_scopeKey_rankKind_key" ON "UnitRankProjection" ("unitId","scopeKind","scopeKey","rankKind");--> statement-breakpoint
CREATE INDEX "UnitRankProjection_unitId_idx" ON "UnitRankProjection" ("unitId");--> statement-breakpoint
CREATE INDEX "UnitRankProjection_scopeKind_scopeId_rankKind_idx" ON "UnitRankProjection" ("scopeKind","scopeId","rankKind");--> statement-breakpoint
CREATE INDEX "UnitRankProjection_rankKind_hotScore_idx" ON "UnitRankProjection" ("rankKind","hotScore");--> statement-breakpoint
CREATE INDEX "UnitRankProjection_rankKind_trendingScore_idx" ON "UnitRankProjection" ("rankKind","trendingScore");--> statement-breakpoint
ALTER TABLE "ServingPatchStatus" ADD CONSTRAINT "ServingPatchStatus_projectionId_UnitRankProjection_id_fkey" FOREIGN KEY ("projectionId") REFERENCES "UnitRankProjection"("id") ON DELETE CASCADE ON UPDATE CASCADE;