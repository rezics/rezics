-- Modify "profile_preference" table
ALTER TABLE "profile_preference" DROP CONSTRAINT "profile_preference_languages_check", ADD CONSTRAINT "profile_preference_languages_check" CHECK ((cardinality(preferred_languages) > 0) AND (preferred_languages <@ ARRAY['zh'::text, 'en'::text]) AND (cardinality(array_positions(preferred_languages, 'zh'::text)) <= 1) AND (cardinality(array_positions(preferred_languages, 'en'::text)) <= 1)), ADD CONSTRAINT "profile_preference_interface_locale_check" CHECK (interface_locale = ANY (ARRAY['en'::text, 'zh-hant'::text])), ALTER COLUMN "preferred_languages" SET DEFAULT ARRAY['zh'::text], ADD COLUMN "interface_locale" text NOT NULL DEFAULT 'zh-hant';
-- Modify "realm_rule_acceptance" table
ALTER TABLE "realm_rule_acceptance" ADD CONSTRAINT "realm_rule_acceptance_language_check" CHECK ((language IS NULL) OR (language = ANY (ARRAY['zh'::text, 'en'::text])));
-- Drop index "unit_alias_unit_language_normalized_key" from table: "unit_alias"
DROP INDEX "unit_alias_unit_language_normalized_key";
-- Modify "unit_alias" table
ALTER TABLE "unit_alias" ADD CONSTRAINT "unit_alias_language_check" CHECK ((language IS NULL) OR (language = ANY (ARRAY['zh'::text, 'en'::text])));
-- Create index "unit_alias_unit_language_normalized_key" to table: "unit_alias"
CREATE UNIQUE INDEX "unit_alias_unit_language_normalized_key" ON "unit_alias" ("unit_id", "language", "normalized_term") WHERE ((deleted_at IS NULL) AND (language IS NOT NULL));
-- Create index "unit_alias_unit_unscoped_normalized_key" to table: "unit_alias"
CREATE UNIQUE INDEX "unit_alias_unit_unscoped_normalized_key" ON "unit_alias" ("unit_id", "normalized_term") WHERE ((deleted_at IS NULL) AND (language IS NULL));
-- Modify "unit_localization" table
ALTER TABLE "unit_localization" DROP CONSTRAINT "unit_localization_language_check", ADD CONSTRAINT "unit_localization_language_check" CHECK (language = ANY (ARRAY['zh'::text, 'en'::text]));
