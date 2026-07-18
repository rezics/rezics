ALTER TYPE "unit_kind" ADD VALUE 'realm_rule';--> statement-breakpoint
ALTER TYPE "post_kind" ADD VALUE 'chapter_group' BEFORE 'wiki';--> statement-breakpoint
DROP TABLE "realm_dock";--> statement-breakpoint
DROP TABLE "zone_menu";--> statement-breakpoint
DROP TABLE "zone_page";--> statement-breakpoint
ALTER TABLE "unit_alias" RENAME COLUMN "value" TO "term";--> statement-breakpoint
ALTER TABLE "unit_alias" RENAME COLUMN "normalized_value" TO "normalized_term";--> statement-breakpoint
ALTER TABLE "content_structure_node" DROP CONSTRAINT "content_structure_node_title_not_blank";--> statement-breakpoint
ALTER TABLE "profile" DROP CONSTRAINT "profile_name_not_blank";--> statement-breakpoint
ALTER TABLE "poll_option" DROP CONSTRAINT "poll_option_label_not_blank";--> statement-breakpoint
ALTER TABLE "realm_rule" DROP CONSTRAINT "realm_rule_language_check";--> statement-breakpoint
ALTER TABLE "realm_rule" DROP CONSTRAINT "realm_rule_title_not_blank";--> statement-breakpoint
ALTER TABLE "unit_alias" RENAME CONSTRAINT "unit_alias_value_not_blank" TO "unit_alias_term_not_blank";--> statement-breakpoint
DROP INDEX "unit_alias_unit_normalized_key";--> statement-breakpoint
DROP INDEX "unit_alias_unit_pinned_position_idx";--> statement-breakpoint
DROP INDEX "profile_name_search_idx";--> statement-breakpoint
DROP INDEX "profile_summary_search_idx";--> statement-breakpoint
DROP INDEX "profile_description_search_idx";--> statement-breakpoint
DROP INDEX "poll_option_label_search_idx";--> statement-breakpoint
ALTER TABLE "unit_alias" DROP COLUMN "pinned";--> statement-breakpoint
ALTER TABLE "unit_alias" DROP COLUMN "position";--> statement-breakpoint
ALTER TABLE "unit_link" DROP COLUMN "label";--> statement-breakpoint
ALTER TABLE "content_structure_node" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "profile" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "profile" DROP COLUMN "summary";--> statement-breakpoint
ALTER TABLE "profile" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "poll_option" DROP COLUMN "label";--> statement-breakpoint
ALTER TABLE "realm_rule" DROP COLUMN "language";--> statement-breakpoint
ALTER TABLE "realm_rule" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "realm_rule" DROP COLUMN "content";--> statement-breakpoint
ALTER TABLE "series_release" DROP COLUMN "label";--> statement-breakpoint
ALTER TABLE "software_requirement" DROP COLUMN "language";--> statement-breakpoint
ALTER TABLE "software_requirement" DROP COLUMN "raw_text";--> statement-breakpoint
ALTER TABLE "content_structure_node" ALTER COLUMN "content_unit_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "realm_rule" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "software_requirement" DROP CONSTRAINT "software_requirement_identity_key";--> statement-breakpoint
ALTER TABLE "software_requirement" ADD CONSTRAINT "software_requirement_identity_key" UNIQUE NULLS NOT DISTINCT("software_id","platform_entity_id","tier");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_alias_unit_language_normalized_key" ON "unit_alias" ("unit_id",coalesce("language", ''),"normalized_term") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "unit_alias_term_search_idx" ON "unit_alias" USING pgroonga ("term") WHERE "deleted_at" is null;--> statement-breakpoint
ALTER TABLE "realm_rule" ADD CONSTRAINT "realm_rule_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_alias" DROP CONSTRAINT "unit_alias_term_not_blank", ADD CONSTRAINT "unit_alias_term_not_blank" CHECK (btrim("term") <> '' and btrim("normalized_term") <> '');