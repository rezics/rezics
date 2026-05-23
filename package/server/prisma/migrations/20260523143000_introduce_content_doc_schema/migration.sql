-- Introduce ContentDoc storage for long-form post content and rich descriptions.

ALTER TABLE "Post" ADD COLUMN "content" JSONB;

UPDATE "Post"
SET "content" = CASE
  WHEN "body" IS NULL OR btrim("body") = '' THEN NULL
  ELSE jsonb_build_object(
    'schema', 'rezics.content',
    'version', 1,
    'main', jsonb_build_object('type', 'markdown', 'source', "body")
  )
END;

ALTER TABLE "Post" DROP COLUMN "body";

ALTER TABLE "UnitTranslation"
ALTER COLUMN "description" TYPE JSONB
USING CASE
  WHEN "description" IS NULL OR btrim("description") = '' THEN NULL
  ELSE jsonb_build_object(
    'schema', 'rezics.content',
    'version', 1,
    'main', jsonb_build_object('type', 'markdown', 'source', "description")
  )
END;

ALTER TABLE "User"
ALTER COLUMN "description" TYPE JSONB
USING CASE
  WHEN "description" IS NULL OR btrim("description") = '' THEN NULL
  ELSE jsonb_build_object(
    'schema', 'rezics.content',
    'version', 1,
    'main', jsonb_build_object('type', 'markdown', 'source', "description")
  )
END;

UPDATE "UnitFieldLock"
SET "path" = 'post.content.main'
WHERE "path" = 'post.body';
