CREATE TYPE "RankingReactionKind" AS ENUM('upvote', 'downvote');--> statement-breakpoint
CREATE TABLE "RankingReactionBucket" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"targetId" uuid NOT NULL,
	"scopeKey" varchar(128) NOT NULL,
	"reaction" "RankingReactionKind" NOT NULL,
	"bucketStart" timestamp(3) NOT NULL,
	"bucketEnd" timestamp(3) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "RankingReactionBucket_target_scope_reaction_bucketStart_key" ON "RankingReactionBucket" ("targetId","scopeKey","reaction","bucketStart");--> statement-breakpoint
CREATE INDEX "RankingReactionBucket_target_scope_bucketStart_idx" ON "RankingReactionBucket" ("targetId","scopeKey","bucketStart");--> statement-breakpoint
CREATE INDEX "RankingReactionBucket_reaction_bucketStart_idx" ON "RankingReactionBucket" ("reaction","bucketStart");