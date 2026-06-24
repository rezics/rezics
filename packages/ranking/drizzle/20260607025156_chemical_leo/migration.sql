ALTER TABLE "RankingReactionBucket" ALTER COLUMN "updatedAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "RankingSignalBucket" ALTER COLUMN "updatedAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "ServingPatchStatus" ALTER COLUMN "updatedAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "UnitRankProjection" ALTER COLUMN "updatedAt" SET DEFAULT now();