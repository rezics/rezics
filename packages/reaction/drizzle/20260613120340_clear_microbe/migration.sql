ALTER TABLE "ReactionSummary" RENAME COLUMN "scopeKey" TO "contextUnitId";--> statement-breakpoint
ALTER TABLE "Reaction" RENAME COLUMN "scopeKey" TO "contextUnitId";--> statement-breakpoint
DROP INDEX "Reaction_userId_targetId_reaction_scopeKey_key";--> statement-breakpoint
DROP INDEX "Reaction_targetId_reaction_scopeKey_idx";--> statement-breakpoint
ALTER TABLE "ReactionSummary" DROP CONSTRAINT "ReactionSummary_pkey";--> statement-breakpoint
ALTER TABLE "ReactionSummary" ALTER COLUMN "contextUnitId" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "ReactionSummary" ALTER COLUMN "contextUnitId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ReactionSummary" ALTER COLUMN "contextUnitId" SET DATA TYPE uuid USING (
	CASE
		WHEN "contextUnitId" IS NULL OR "contextUnitId" = 'direct' THEN NULL
		WHEN "contextUnitId" LIKE 'realm:%' THEN substring("contextUnitId" from 7)::uuid
		WHEN "contextUnitId" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN "contextUnitId"::uuid
		ELSE NULL
	END
);--> statement-breakpoint
ALTER TABLE "Reaction" ALTER COLUMN "contextUnitId" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "Reaction" ALTER COLUMN "contextUnitId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "Reaction" ALTER COLUMN "contextUnitId" SET DATA TYPE uuid USING (
	CASE
		WHEN "contextUnitId" IS NULL OR "contextUnitId" = 'direct' THEN NULL
		WHEN "contextUnitId" LIKE 'realm:%' THEN substring("contextUnitId" from 7)::uuid
		WHEN "contextUnitId" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN "contextUnitId"::uuid
		ELSE NULL
	END
);--> statement-breakpoint
DELETE FROM "Reaction" reaction
USING (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "userId", "targetId", "reaction", "contextUnitId"
			ORDER BY "createdAt", "id"
		) AS row_number
	FROM "Reaction"
) duplicate
WHERE reaction."id" = duplicate."id" AND duplicate.row_number > 1;--> statement-breakpoint
DELETE FROM "ReactionSummary";--> statement-breakpoint
INSERT INTO "ReactionSummary" ("targetId", "reaction", "contextUnitId", "count")
SELECT "targetId", "reaction", "contextUnitId", count(*)::integer
FROM "Reaction"
GROUP BY "targetId", "reaction", "contextUnitId";--> statement-breakpoint
CREATE UNIQUE INDEX "ReactionSummary_targetId_reaction_direct_key" ON "ReactionSummary" ("targetId","reaction") WHERE "contextUnitId" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "ReactionSummary_targetId_reaction_context_key" ON "ReactionSummary" ("targetId","reaction","contextUnitId") WHERE "contextUnitId" is not null;--> statement-breakpoint
CREATE INDEX "ReactionSummary_targetId_reaction_contextUnitId_idx" ON "ReactionSummary" ("targetId","reaction","contextUnitId");--> statement-breakpoint
CREATE UNIQUE INDEX "Reaction_userId_targetId_reaction_direct_key" ON "Reaction" ("userId","targetId","reaction") WHERE "contextUnitId" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "Reaction_userId_targetId_reaction_context_key" ON "Reaction" ("userId","targetId","reaction","contextUnitId") WHERE "contextUnitId" is not null;--> statement-breakpoint
CREATE INDEX "Reaction_targetId_reaction_contextUnitId_idx" ON "Reaction" ("targetId","reaction","contextUnitId");
