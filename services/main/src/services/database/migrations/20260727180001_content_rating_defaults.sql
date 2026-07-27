-- Bring records created under the empty-array default into the new non-empty contract.
UPDATE "profile_preference"
SET "content_ratings" = ARRAY['general'::content_rating, 'r15'::content_rating]
WHERE cardinality("content_ratings") = 0;

-- Modify "profile_preference" table
ALTER TABLE "profile_preference" ADD CONSTRAINT "profile_preference_content_ratings_check" CHECK (cardinality(content_ratings) > 0), ALTER COLUMN "content_ratings" SET DEFAULT ARRAY['general'::content_rating, 'r15'::content_rating];
