CREATE TABLE "ReactionSummary" (
	"targetId" uuid,
	"reaction" varchar(32),
	"scopeKey" varchar(128) DEFAULT 'direct',
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ReactionSummary_pkey" PRIMARY KEY("targetId","reaction","scopeKey")
);
--> statement-breakpoint
CREATE TABLE "ReactionTargetUsage" (
	"userId" uuid,
	"targetId" uuid,
	"activeCount" integer DEFAULT 0 NOT NULL,
	"maxActive" integer DEFAULT 3 NOT NULL,
	CONSTRAINT "ReactionTargetUsage_pkey" PRIMARY KEY("userId","targetId")
);
--> statement-breakpoint
CREATE TABLE "Reaction" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"userId" uuid NOT NULL,
	"targetId" uuid NOT NULL,
	"reaction" varchar(32) NOT NULL,
	"scopeKey" varchar(128) DEFAULT 'direct' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ReactionSummary_targetId_idx" ON "ReactionSummary" ("targetId");--> statement-breakpoint
CREATE INDEX "ReactionSummary_targetId_reaction_idx" ON "ReactionSummary" ("targetId","reaction");--> statement-breakpoint
CREATE INDEX "ReactionTargetUsage_targetId_idx" ON "ReactionTargetUsage" ("targetId");--> statement-breakpoint
CREATE UNIQUE INDEX "Reaction_userId_targetId_reaction_scopeKey_key" ON "Reaction" ("userId","targetId","reaction","scopeKey");--> statement-breakpoint
CREATE INDEX "Reaction_targetId_idx" ON "Reaction" ("targetId");--> statement-breakpoint
CREATE INDEX "Reaction_targetId_reaction_idx" ON "Reaction" ("targetId","reaction");--> statement-breakpoint
CREATE INDEX "Reaction_targetId_reaction_scopeKey_idx" ON "Reaction" ("targetId","reaction","scopeKey");--> statement-breakpoint
CREATE INDEX "Reaction_userId_reaction_idx" ON "Reaction" ("userId","reaction");--> statement-breakpoint
CREATE INDEX "Reaction_userId_targetId_idx" ON "Reaction" ("userId","targetId");--> statement-breakpoint
CREATE INDEX "Reaction_userId_createdAt_idx" ON "Reaction" ("userId","createdAt");