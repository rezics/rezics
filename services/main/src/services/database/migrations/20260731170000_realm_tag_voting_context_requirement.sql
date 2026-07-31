-- Realm-scoped Tag voting is an explicit Realm capability. Every vote and
-- derived aggregate is owned by the Realm's canonical explanation of the Tag.
ALTER TABLE "realm"
  ADD COLUMN "realm_tag_voting_enabled" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

CREATE INDEX "realm_tag_context_tag_realm_idx"
  ON "realm_tag_context" ("tag_id", "realm_id");
--> statement-breakpoint

-- Votes whose canonical context was removed by the preceding context
-- normalization cannot satisfy the new ownership invariant. Their aggregate
-- rows are maintained by the existing vote trigger; the explicit stat cleanup
-- also removes any pre-existing aggregate drift before adding the foreign keys.
DELETE FROM "realm_tag_vote" AS vote
WHERE NOT EXISTS (
  SELECT 1
  FROM "realm_tag_context" AS context
  WHERE context."realm_id" = vote."realm_id"
    AND context."tag_id" = vote."tag_id"
);
--> statement-breakpoint

DELETE FROM "realm_tag_vote_stat" AS stat
WHERE NOT EXISTS (
  SELECT 1
  FROM "realm_tag_context" AS context
  WHERE context."realm_id" = stat."realm_id"
    AND context."tag_id" = stat."tag_id"
);
--> statement-breakpoint

-- Existing context-owned votes prove that the Realm was already using this
-- capability before its policy became explicit.
UPDATE "realm" AS target_realm
SET "realm_tag_voting_enabled" = true
WHERE EXISTS (
  SELECT 1
  FROM "realm_tag_vote" AS vote
  WHERE vote."realm_id" = target_realm."id"
);
--> statement-breakpoint

ALTER TABLE "realm_tag_vote"
  ADD CONSTRAINT "realm_tag_vote_context_fkey"
  FOREIGN KEY ("realm_id", "tag_id")
  REFERENCES "realm_tag_context" ("realm_id", "tag_id")
  ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "realm_tag_vote_stat"
  ADD CONSTRAINT "realm_tag_vote_stat_context_fkey"
  FOREIGN KEY ("realm_id", "tag_id")
  REFERENCES "realm_tag_context" ("realm_id", "tag_id")
  ON DELETE CASCADE;
--> statement-breakpoint

CREATE FUNCTION "enforce_realm_tag_voting_enabled"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM 1
  FROM public.realm
  WHERE id = NEW.realm_id
    AND realm_tag_voting_enabled
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Realm-scoped Tag voting is not enabled for Realm %', NEW.realm_id
      USING
        ERRCODE = '23514',
        CONSTRAINT = 'realm_tag_vote_realm_tag_voting_enabled';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER "realm_tag_vote_realm_tag_voting_enabled"
BEFORE INSERT OR UPDATE ON "realm_tag_vote"
FOR EACH ROW
EXECUTE FUNCTION "enforce_realm_tag_voting_enabled"();
--> statement-breakpoint

-- Context changes affect both the Tag candidate document and Realm discovery.
CREATE TRIGGER "search_projection_touch_realm_tag_context_insert"
AFTER INSERT ON "realm_tag_context"
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION "search_touch_current_statement"('realm_id', 'tag_id');
--> statement-breakpoint

CREATE TRIGGER "search_projection_touch_realm_tag_context_update"
AFTER UPDATE ON "realm_tag_context"
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION "search_touch_current_statement"('realm_id', 'tag_id');
--> statement-breakpoint

CREATE TRIGGER "search_projection_touch_realm_tag_context_delete"
AFTER DELETE ON "realm_tag_context"
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT
EXECUTE FUNCTION "search_touch_current_statement"('realm_id', 'tag_id');
