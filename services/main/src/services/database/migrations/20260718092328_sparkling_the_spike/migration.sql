ALTER TABLE "unit_link" ALTER COLUMN "position" SET DATA TYPE text collate "C" USING "position"::text collate "C";--> statement-breakpoint
ALTER TABLE "unit_link" ALTER COLUMN "position" SET DEFAULT 'a0';--> statement-breakpoint
ALTER TABLE "collection_item" ALTER COLUMN "position" SET DATA TYPE text collate "C" USING "position"::text collate "C";--> statement-breakpoint
ALTER TABLE "collection_item" ALTER COLUMN "position" SET DEFAULT 'a0';--> statement-breakpoint
ALTER TABLE "content_structure_node" ALTER COLUMN "position" SET DATA TYPE text collate "C" USING "position"::text collate "C";--> statement-breakpoint
ALTER TABLE "unit_localization" ALTER COLUMN "position" SET DATA TYPE text collate "C" USING "position"::text collate "C";--> statement-breakpoint
ALTER TABLE "unit_localization" ALTER COLUMN "position" SET DEFAULT ('a0' || replace(uuidv7()::text, '-', '') || 'V');--> statement-breakpoint
ALTER TABLE "credit_attribution" ALTER COLUMN "position" SET DATA TYPE text collate "C" USING "position"::text collate "C";--> statement-breakpoint
ALTER TABLE "credit_attribution" ALTER COLUMN "position" SET DEFAULT 'a0';--> statement-breakpoint
ALTER TABLE "subject_attribution" ALTER COLUMN "position" SET DATA TYPE text collate "C" USING "position"::text collate "C";--> statement-breakpoint
ALTER TABLE "subject_attribution" ALTER COLUMN "position" SET DEFAULT 'a0';--> statement-breakpoint
ALTER TABLE "poll_option" ALTER COLUMN "position" SET DATA TYPE integer USING "position"::integer;--> statement-breakpoint
ALTER TABLE "realm_pin" ALTER COLUMN "position" SET DATA TYPE text collate "C" USING "position"::text collate "C";--> statement-breakpoint
ALTER TABLE "realm_pin" ALTER COLUMN "position" SET DEFAULT 'a0';--> statement-breakpoint
ALTER TABLE "realm_rule" ALTER COLUMN "position" SET DATA TYPE integer USING "position"::integer;--> statement-breakpoint
ALTER TABLE "series_release" ALTER COLUMN "position" SET DATA TYPE text collate "C" USING "position"::text collate "C";--> statement-breakpoint
ALTER TABLE "profile_unit_tag" ALTER COLUMN "position" SET DATA TYPE text collate "C" USING "position"::text collate "C";--> statement-breakpoint
ALTER TABLE "profile_unit_tag" ALTER COLUMN "position" SET DEFAULT 'a0';--> statement-breakpoint
ALTER TABLE "realm_unit_tag" ALTER COLUMN "position" SET DATA TYPE text collate "C" USING "position"::text collate "C";--> statement-breakpoint
ALTER TABLE "realm_unit_tag" ALTER COLUMN "position" SET DEFAULT 'a0';--> statement-breakpoint
ALTER TABLE "unit_tag" ALTER COLUMN "position" SET DATA TYPE text collate "C" USING "position"::text collate "C";