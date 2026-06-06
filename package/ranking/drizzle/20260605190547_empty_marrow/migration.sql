ALTER TABLE "UnitRankProjection" ADD COLUMN "bestScore" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "UnitRankProjection" ADD COLUMN "risingScore" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "UnitRankProjection" ADD COLUMN "controversyScore" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "UnitRankProjection_rankKind_bestScore_idx" ON "UnitRankProjection" ("rankKind","bestScore");--> statement-breakpoint
CREATE INDEX "UnitRankProjection_rankKind_risingScore_idx" ON "UnitRankProjection" ("rankKind","risingScore");--> statement-breakpoint
CREATE INDEX "UnitRankProjection_rankKind_controversyScore_idx" ON "UnitRankProjection" ("rankKind","controversyScore");