-- Modify "profile_preference" table
ALTER TABLE "profile_preference" ALTER COLUMN "preferred_languages" SET DEFAULT ARRAY['en'::text], ADD COLUMN "filter_feed_by_preferred_languages" boolean NOT NULL DEFAULT false;
-- Modify "users" table
ALTER TABLE "users" ADD COLUMN "registration_content_language" text NOT NULL DEFAULT 'en';
