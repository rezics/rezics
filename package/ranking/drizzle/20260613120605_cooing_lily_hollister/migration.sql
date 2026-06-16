ALTER TABLE "RankingReactionBucket" RENAME COLUMN "scopeKey" TO "contextUnitId";--> statement-breakpoint
DROP INDEX "RankingReactionBucket_target_scope_reaction_bucketStart_key";--> statement-breakpoint
DROP INDEX "RankingReactionBucket_target_scope_bucketStart_idx";--> statement-breakpoint
ALTER TABLE "RankingReactionBucket" ALTER COLUMN "contextUnitId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "RankingReactionBucket" ALTER COLUMN "contextUnitId" SET DATA TYPE uuid USING (
	CASE
		WHEN "contextUnitId" IS NULL OR "contextUnitId" = 'direct' THEN NULL
		WHEN "contextUnitId" LIKE 'realm:%' THEN substring("contextUnitId" from 7)::uuid
		WHEN "contextUnitId" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN "contextUnitId"::uuid
		ELSE NULL
	END
);--> statement-breakpoint
WITH merged AS (
	SELECT
		(array_agg("id" ORDER BY "createdAt", "id"))[1] AS keep_id,
		"targetId",
		"contextUnitId",
		"reaction",
		"bucketStart",
		max("bucketEnd") AS bucket_end,
		sum("count")::integer AS count,
		min("createdAt") AS created_at,
		max("updatedAt") AS updated_at
	FROM "RankingReactionBucket"
	GROUP BY "targetId", "contextUnitId", "reaction", "bucketStart"
)
UPDATE "RankingReactionBucket" bucket
SET
	"bucketEnd" = merged.bucket_end,
	"count" = merged.count,
	"createdAt" = merged.created_at,
	"updatedAt" = merged.updated_at
FROM merged
WHERE bucket."id" = merged.keep_id;--> statement-breakpoint
DELETE FROM "RankingReactionBucket" bucket
USING (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "targetId", "contextUnitId", "reaction", "bucketStart"
			ORDER BY "createdAt", "id"
		) AS row_number
	FROM "RankingReactionBucket"
) duplicate
WHERE bucket."id" = duplicate."id" AND duplicate.row_number > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "RankingReactionBucket_target_direct_reaction_bucketStart_key" ON "RankingReactionBucket" ("targetId","reaction","bucketStart") WHERE "contextUnitId" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "RankingReactionBucket_target_context_reaction_bucketStart_key" ON "RankingReactionBucket" ("targetId","contextUnitId","reaction","bucketStart") WHERE "contextUnitId" is not null;--> statement-breakpoint
CREATE INDEX "RankingReactionBucket_target_context_bucketStart_idx" ON "RankingReactionBucket" ("targetId","contextUnitId","bucketStart");
