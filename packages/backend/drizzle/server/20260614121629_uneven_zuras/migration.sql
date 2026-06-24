ALTER TABLE "User" RENAME COLUMN "bio" TO "summary";--> statement-breakpoint
ALTER TABLE "Comment" ADD COLUMN "language" text DEFAULT 'zh-hant' NOT NULL;--> statement-breakpoint
CREATE INDEX "Comment_language_idx" ON "Comment" ("language");