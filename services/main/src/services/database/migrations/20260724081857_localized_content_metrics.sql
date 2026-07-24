-- Create "unit_localization_content_metric" table
CREATE TABLE "unit_localization_content_metric" (
  "unit_id" uuid NOT NULL,
  "language" text NOT NULL,
  "word_count" integer NOT NULL,
  "character_count" integer NOT NULL,
  "algorithm_version" integer NOT NULL,
  "source_sha256" text NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("unit_id", "language"),
  CONSTRAINT "unit_localization_content_metric_localization_fkey" FOREIGN KEY ("unit_id", "language") REFERENCES "unit_localization" ("unit_id", "language") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_localization_content_metric_algorithm_version_check" CHECK (algorithm_version > 0),
  CONSTRAINT "unit_localization_content_metric_character_count_check" CHECK (character_count >= 0),
  CONSTRAINT "unit_localization_content_metric_language_check" CHECK (language = ANY (ARRAY['zh'::text, 'en'::text])),
  CONSTRAINT "unit_localization_content_metric_source_sha256_check" CHECK (source_sha256 ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "unit_localization_content_metric_word_count_check" CHECK (word_count >= 0)
);
