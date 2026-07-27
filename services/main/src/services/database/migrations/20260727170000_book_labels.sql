-- Book outline groups are Label Units, not a specialized Post kind.
INSERT INTO "label" ("id", "created_at", "updated_at")
SELECT "id", "created_at", "updated_at"
FROM "post"
WHERE "kind" = 'chapter_group'::post_kind;

UPDATE "unit"
SET "kind" = 'label'
WHERE "id" IN (
  SELECT "id"
  FROM "post"
  WHERE "kind" = 'chapter_group'::post_kind
);

DELETE FROM "post"
WHERE "kind" = 'chapter_group'::post_kind;

-- PostgreSQL cannot remove an enum value in place. Rebuild the type after all
-- stored rows have been converted, temporarily removing dependants that name it.
DROP TRIGGER "subject_association_wiki_context_post" ON "subject_association";
DROP TRIGGER "unit_association_proposal_wiki_context_post" ON "unit_association_proposal";
DROP TRIGGER "post_association_context_kind_protect" ON "post";
DROP FUNCTION "enforce_wiki_association_context_post"();
DROP FUNCTION "protect_association_context_post_kind"();

ALTER TABLE "post" DROP CONSTRAINT "post_review_subject_check";
ALTER TABLE "post" DROP CONSTRAINT "post_excerpt_subject_check";
ALTER TABLE "post" ALTER COLUMN "kind" DROP DEFAULT;

ALTER TYPE "post_kind" RENAME TO "post_kind_with_chapter_group";
CREATE TYPE "post_kind" AS ENUM (
  'post',
  'reply',
  'excerpt',
  'review',
  'chapter',
  'wiki',
  'picture',
  'governance_note'
);

ALTER TABLE "post"
ALTER COLUMN "kind" TYPE "post_kind"
USING "kind"::text::post_kind;
ALTER TABLE "post" ALTER COLUMN "kind" SET DEFAULT 'post'::post_kind;
DROP TYPE "post_kind_with_chapter_group";

ALTER TABLE "post"
ADD CONSTRAINT "post_review_subject_check"
CHECK (("kind" <> 'review'::post_kind) OR ("subject_unit_id" IS NOT NULL));
ALTER TABLE "post"
ADD CONSTRAINT "post_excerpt_subject_check"
CHECK (("kind" <> 'excerpt'::post_kind) OR ("subject_unit_id" IS NOT NULL));

CREATE FUNCTION "enforce_wiki_association_context_post"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.context_post_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM post
    WHERE id = NEW.context_post_id
      AND kind = 'wiki'::post_kind
  ) THEN
    RAISE EXCEPTION 'association context post % must be a wiki Post', NEW.context_post_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "subject_association_wiki_context_post"
BEFORE INSERT OR UPDATE OF "context_post_id" ON "subject_association"
FOR EACH ROW EXECUTE FUNCTION "enforce_wiki_association_context_post"();

CREATE TRIGGER "unit_association_proposal_wiki_context_post"
BEFORE INSERT OR UPDATE OF "context_post_id", "kind" ON "unit_association_proposal"
FOR EACH ROW EXECUTE FUNCTION "enforce_wiki_association_context_post"();

CREATE FUNCTION "protect_association_context_post_kind"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.kind = 'wiki'::post_kind
    AND NEW.kind <> 'wiki'::post_kind
    AND (
      EXISTS (
        SELECT 1 FROM subject_association
        WHERE context_post_id = OLD.id
      )
      OR EXISTS (
        SELECT 1 FROM unit_association_proposal
        WHERE context_post_id = OLD.id
      )
    )
  THEN
    RAISE EXCEPTION 'referenced association context post % must remain a wiki Post', OLD.id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "post_association_context_kind_protect"
BEFORE UPDATE OF "kind" ON "post"
FOR EACH ROW EXECUTE FUNCTION "protect_association_context_post_kind"();
