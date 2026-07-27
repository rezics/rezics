-- Modify "users" table
ALTER TABLE "users" ADD CONSTRAINT "users_registration_content_language_check" CHECK (registration_content_language = ANY (ARRAY['zh'::text, 'en'::text]));
