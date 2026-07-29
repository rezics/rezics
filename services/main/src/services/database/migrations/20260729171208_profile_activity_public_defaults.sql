-- Modify "profile_preference" table
ALTER TABLE "profile_preference" ALTER COLUMN "score_visibility" SET DEFAULT 'public', ALTER COLUMN "progress_visibility" SET DEFAULT 'public';
-- Modify "score" table
ALTER TABLE "score" ALTER COLUMN "visibility" SET DEFAULT 'public';
-- Modify "unit_progress" table
ALTER TABLE "unit_progress" ALTER COLUMN "visibility" SET DEFAULT 'public';
