-- Add an optional wiki Post context to subject associations.
ALTER TABLE "subject_association" ADD COLUMN "context_post_id" uuid NULL, ADD CONSTRAINT "subject_association_context_post_id_post_id_fkey" FOREIGN KEY ("context_post_id") REFERENCES "post" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "subject_association_context_post_idx" to table: "subject_association"
CREATE INDEX "subject_association_context_post_idx" ON "subject_association" ("context_post_id") WHERE "context_post_id" IS NOT NULL;
-- Modify "unit_association_proposal" table
ALTER TABLE "unit_association_proposal" ADD COLUMN "context_post_id" uuid NULL, ADD CONSTRAINT "unit_association_proposal_context_post_shape_check" CHECK (((kind = 'credit'::association_kind) AND (context_post_id IS NULL)) OR (kind = 'subject'::association_kind)), ADD CONSTRAINT "unit_association_proposal_context_post_id_post_id_fkey" FOREIGN KEY ("context_post_id") REFERENCES "post" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "unit_association_proposal_context_post_idx" to table: "unit_association_proposal"
CREATE INDEX "unit_association_proposal_context_post_idx" ON "unit_association_proposal" ("context_post_id") WHERE "context_post_id" IS NOT NULL;

-- Cross-row constraint: an optional association context is always a wiki Post.
-- This does not compare the context Post subject with the association source Unit.
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

-- The foreign keys protect deletion; this trigger also prevents changing a
-- referenced wiki Post into another Post kind.
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
