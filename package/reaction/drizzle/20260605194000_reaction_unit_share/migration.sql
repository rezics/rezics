CREATE TABLE "UnitShare" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"userId" uuid NOT NULL,
	"targetId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "UnitShareSummary" (
	"targetId" uuid PRIMARY KEY NOT NULL,
	"shareCount" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "UnitShare_userId_targetId_key" ON "UnitShare" USING btree ("userId","targetId");--> statement-breakpoint
CREATE INDEX "UnitShare_targetId_idx" ON "UnitShare" USING btree ("targetId");--> statement-breakpoint
CREATE INDEX "UnitShare_userId_createdAt_idx" ON "UnitShare" USING btree ("userId","createdAt");
