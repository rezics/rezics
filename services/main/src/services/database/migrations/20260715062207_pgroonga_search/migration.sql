CREATE EXTENSION IF NOT EXISTS pgroonga;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comment_content_search_idx" ON "comment" USING pgroonga ("content" pgroonga_jsonb_full_text_search_ops_v2);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "poll_option_label_search_idx" ON "poll_option" USING pgroonga ("label") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_name_search_idx" ON "profile" USING pgroonga ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_summary_search_idx" ON "profile" USING pgroonga ("summary");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_description_search_idx" ON "profile" USING pgroonga ("description" pgroonga_jsonb_full_text_search_ops_v2);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unit_slug_search_idx" ON "unit" USING pgroonga ("slug") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unit_localization_title_search_idx" ON "unit_localization" USING pgroonga ("title");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unit_localization_summary_search_idx" ON "unit_localization" USING pgroonga ("summary");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unit_localization_description_search_idx" ON "unit_localization" USING pgroonga ("description" pgroonga_jsonb_full_text_search_ops_v2);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unit_localization_content_search_idx" ON "unit_localization" USING pgroonga ("content" pgroonga_jsonb_full_text_search_ops_v2);
