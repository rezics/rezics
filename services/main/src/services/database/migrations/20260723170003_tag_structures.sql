-- Add community-immutable Tag structures and their effective Tag projections.
-- Modify "unit" table
ALTER TABLE "unit" DROP CONSTRAINT "unit_kind_check", ADD CONSTRAINT "unit_kind_check" CHECK (kind = ANY (ARRAY['slug_namespace'::text, 'profile'::text, 'book'::text, 'software'::text, 'media'::text, 'release'::text, 'entity'::text, 'label'::text, 'tag'::text, 'structure'::text, 'series'::text, 'zone'::text, 'zone_page'::text, 'collection'::text, 'post'::text, 'poll'::text, 'realm'::text, 'realm_rule'::text]));
-- Modify "tag" table
ALTER TABLE "tag" DROP CONSTRAINT "tag_id_unit_id_fkey", ADD CONSTRAINT "tag_unit_kind_check" CHECK (unit_kind = 'tag'::text), ADD COLUMN "unit_kind" text NOT NULL DEFAULT 'tag', ADD CONSTRAINT "tag_unit_kind_fkey" FOREIGN KEY ("id", "unit_kind") REFERENCES "unit" ("id", "kind") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Create "unit_effective_tag" table
CREATE TABLE "unit_effective_tag" (
  "unit_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  "direct" boolean NOT NULL DEFAULT false,
  "structure_support_count" bigint NOT NULL DEFAULT 0,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("unit_id", "tag_id"),
  CONSTRAINT "unit_effective_tag_tag_id_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_effective_tag_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_effective_tag_not_self_check" CHECK (unit_id <> tag_id),
  CONSTRAINT "unit_effective_tag_source_check" CHECK (direct OR (structure_support_count > 0)),
  CONSTRAINT "unit_effective_tag_structure_count_check" CHECK (structure_support_count >= 0)
);
-- Create index "unit_effective_tag_tag_idx" to table: "unit_effective_tag"
CREATE INDEX "unit_effective_tag_tag_idx" ON "unit_effective_tag" ("tag_id", "unit_id");
-- Create "unit_effective_tag_vote" table
CREATE TABLE "unit_effective_tag_vote" (
  "unit_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "value" integer NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("unit_id", "tag_id", "profile_id"),
  CONSTRAINT "unit_effective_tag_vote_effective_tag_fkey" FOREIGN KEY ("unit_id", "tag_id") REFERENCES "unit_effective_tag" ("unit_id", "tag_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_effective_tag_vote_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_effective_tag_vote_value_check" CHECK (value = ANY (ARRAY['-1'::integer, 1]))
);
-- Create index "unit_effective_tag_vote_profile_idx" to table: "unit_effective_tag_vote"
CREATE INDEX "unit_effective_tag_vote_profile_idx" ON "unit_effective_tag_vote" ("profile_id", "unit_id");
-- Create "unit_structure" table
CREATE TABLE "unit_structure" (
  "id" uuid NOT NULL,
  "unit_kind" text NOT NULL DEFAULT 'structure',
  "kind" text NOT NULL,
  "definition_version" integer NOT NULL DEFAULT 1,
  "member_unit_ids" uuid[] NOT NULL,
  "created_by_profile_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "unit_structure_definition_key" UNIQUE ("kind", "definition_version", "member_unit_ids"),
  CONSTRAINT "unit_structure_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_structure_unit_kind_fkey" FOREIGN KEY ("id", "unit_kind") REFERENCES "unit" ("id", "kind") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_structure_definition_version_check" CHECK (definition_version = 1),
  CONSTRAINT "unit_structure_kind_check" CHECK (kind = 'tag.hierarchy_path'::text),
  CONSTRAINT "unit_structure_member_count_check" CHECK ((cardinality(member_unit_ids) >= 2) AND (cardinality(member_unit_ids) <= 16)),
  CONSTRAINT "unit_structure_member_null_check" CHECK (array_position(member_unit_ids, NULL::uuid) IS NULL),
  CONSTRAINT "unit_structure_not_self_check" CHECK (NOT (id = ANY (member_unit_ids))),
  CONSTRAINT "unit_structure_unit_kind_check" CHECK (unit_kind = 'structure'::text)
);
-- Create index "unit_structure_created_by_idx" to table: "unit_structure"
CREATE INDEX "unit_structure_created_by_idx" ON "unit_structure" ("created_by_profile_id", "created_at");
-- Create "unit_structure_application" table
CREATE TABLE "unit_structure_application" (
  "unit_id" uuid NOT NULL,
  "structure_id" uuid NOT NULL,
  "created_by_profile_id" uuid NULL,
  "pinned" boolean NOT NULL DEFAULT false,
  "position" text NULL COLLATE "C",
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("unit_id", "structure_id"),
  CONSTRAINT "unit_structure_application_MtoBK1Ir0Rdk_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "unit_structure_application_structure_id_unit_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "unit_structure" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_structure_application_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_structure_application_not_self_check" CHECK (unit_id <> structure_id)
);
-- Create index "unit_structure_application_structure_idx" to table: "unit_structure_application"
CREATE INDEX "unit_structure_application_structure_idx" ON "unit_structure_application" ("structure_id", "unit_id");
-- Create index "unit_structure_application_unit_position_idx" to table: "unit_structure_application"
CREATE INDEX "unit_structure_application_unit_position_idx" ON "unit_structure_application" ("unit_id", "pinned", "position", "structure_id");
-- Create "unit_structure_application_vote" table
CREATE TABLE "unit_structure_application_vote" (
  "unit_id" uuid NOT NULL,
  "structure_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "value" integer NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("unit_id", "structure_id", "profile_id"),
  CONSTRAINT "unit_structure_application_vote_application_fkey" FOREIGN KEY ("unit_id", "structure_id") REFERENCES "unit_structure_application" ("unit_id", "structure_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_structure_application_vote_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_structure_application_vote_value_check" CHECK (value = ANY (ARRAY['-1'::integer, 1]))
);
-- Create index "unit_structure_application_vote_profile_idx" to table: "unit_structure_application_vote"
CREATE INDEX "unit_structure_application_vote_profile_idx" ON "unit_structure_application_vote" ("profile_id", "unit_id");
-- Create "unit_structure_application_vote_stat" table
CREATE TABLE "unit_structure_application_vote_stat" (
  "unit_id" uuid NOT NULL,
  "structure_id" uuid NOT NULL,
  "score" bigint NOT NULL DEFAULT 0,
  "vote_count" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("unit_id", "structure_id"),
  CONSTRAINT "unit_structure_application_vote_stat_application_fkey" FOREIGN KEY ("unit_id", "structure_id") REFERENCES "unit_structure_application" ("unit_id", "structure_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_structure_application_vote_stat_count_check" CHECK (vote_count >= 0),
  CONSTRAINT "unit_structure_application_vote_stat_score_check" CHECK (abs(score) <= vote_count)
);
-- Create "unit_structure_edge" table
CREATE TABLE "unit_structure_edge" (
  "structure_id" uuid NOT NULL,
  "ordinal" integer NOT NULL,
  "parent_unit_id" uuid NOT NULL,
  "child_unit_id" uuid NOT NULL,
  PRIMARY KEY ("structure_id", "ordinal"),
  CONSTRAINT "unit_structure_edge_child_unit_id_unit_id_fkey" FOREIGN KEY ("child_unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_structure_edge_parent_unit_id_unit_id_fkey" FOREIGN KEY ("parent_unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_structure_edge_structure_id_unit_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "unit_structure" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_structure_edge_not_self_check" CHECK (parent_unit_id <> child_unit_id),
  CONSTRAINT "unit_structure_edge_ordinal_check" CHECK (ordinal >= 0)
);
-- Create index "unit_structure_edge_child_idx" to table: "unit_structure_edge"
CREATE INDEX "unit_structure_edge_child_idx" ON "unit_structure_edge" ("child_unit_id", "parent_unit_id", "structure_id");
-- Create index "unit_structure_edge_parent_idx" to table: "unit_structure_edge"
CREATE INDEX "unit_structure_edge_parent_idx" ON "unit_structure_edge" ("parent_unit_id", "child_unit_id", "structure_id");
-- Create "unit_structure_member" table
CREATE TABLE "unit_structure_member" (
  "structure_id" uuid NOT NULL,
  "ordinal" integer NOT NULL,
  "member_unit_id" uuid NOT NULL,
  "member_unit_kind" text NOT NULL,
  PRIMARY KEY ("structure_id", "ordinal"),
  CONSTRAINT "unit_structure_member_structure_member_key" UNIQUE ("structure_id", "member_unit_id"),
  CONSTRAINT "unit_structure_member_structure_id_unit_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "unit_structure" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_structure_member_unit_kind_fkey" FOREIGN KEY ("member_unit_id", "member_unit_kind") REFERENCES "unit" ("id", "kind") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_structure_member_ordinal_check" CHECK (ordinal >= 0)
);
-- Create index "unit_structure_member_unit_idx" to table: "unit_structure_member"
CREATE INDEX "unit_structure_member_unit_idx" ON "unit_structure_member" ("member_unit_id", "structure_id", "ordinal");
-- Create "unit_structure_vote" table
CREATE TABLE "unit_structure_vote" (
  "structure_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "value" integer NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("structure_id", "profile_id"),
  CONSTRAINT "unit_structure_vote_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_structure_vote_structure_id_unit_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "unit_structure" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_structure_vote_value_check" CHECK (value = ANY (ARRAY['-1'::integer, 1]))
);
-- Create index "unit_structure_vote_profile_idx" to table: "unit_structure_vote"
CREATE INDEX "unit_structure_vote_profile_idx" ON "unit_structure_vote" ("profile_id", "structure_id");
-- Create "unit_structure_vote_stat" table
CREATE TABLE "unit_structure_vote_stat" (
  "structure_id" uuid NOT NULL,
  "score" bigint NOT NULL DEFAULT 0,
  "vote_count" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("structure_id"),
  CONSTRAINT "unit_structure_vote_stat_structure_id_unit_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "unit_structure" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_structure_vote_stat_count_check" CHECK (vote_count >= 0),
  CONSTRAINT "unit_structure_vote_stat_score_check" CHECK (abs(score) <= vote_count)
);
-- Create "unit_tag_structure_support" table
CREATE TABLE "unit_tag_structure_support" (
  "unit_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "structure_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("unit_id", "tag_id", "profile_id", "structure_id"),
  CONSTRAINT "unit_tag_structure_support_application_vote_fkey" FOREIGN KEY ("unit_id", "structure_id", "profile_id") REFERENCES "unit_structure_application_vote" ("unit_id", "structure_id", "profile_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_tag_structure_support_member_fkey" FOREIGN KEY ("structure_id", "tag_id") REFERENCES "unit_structure_member" ("structure_id", "member_unit_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_tag_structure_support_tag_id_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "unit_tag_structure_support_effective_vote_idx" to table: "unit_tag_structure_support"
CREATE INDEX "unit_tag_structure_support_effective_vote_idx" ON "unit_tag_structure_support" ("unit_id", "tag_id", "profile_id");
-- Create index "unit_tag_structure_support_structure_idx" to table: "unit_tag_structure_support"
CREATE INDEX "unit_tag_structure_support_structure_idx" ON "unit_tag_structure_support" ("structure_id", "unit_id", "profile_id");
-- Backfill the effective projection before moving the existing aggregate FK.
INSERT INTO "unit_effective_tag" (
  "unit_id",
  "tag_id",
  "direct",
  "structure_support_count",
  "created_at",
  "updated_at"
)
SELECT "unit_id", "tag_id", true, 0, "created_at", "updated_at"
FROM "unit_tag";

INSERT INTO "unit_effective_tag_vote" (
  "unit_id",
  "tag_id",
  "profile_id",
  "value",
  "created_at",
  "updated_at"
)
SELECT "unit_id", "tag_id", "profile_id", "value", "created_at", "updated_at"
FROM "unit_tag_vote";
-- Modify "unit_tag_vote_stat" table
ALTER TABLE "unit_tag_vote_stat" DROP CONSTRAINT "unit_tag_vote_stat_unit_tag_fkey", ADD CONSTRAINT "unit_tag_vote_stat_effective_tag_fkey" FOREIGN KEY ("unit_id", "tag_id") REFERENCES "unit_effective_tag" ("unit_id", "tag_id") ON UPDATE NO ACTION ON DELETE CASCADE;

-- Serialize projection maintenance by logical key. Recomputing under these
-- transaction locks remains exact when independent Profiles vote concurrently.
CREATE FUNCTION lock_unit_effective_tag_key(
  target_unit_id uuid,
  target_tag_id uuid
) RETURNS void
LANGUAGE sql
AS $$
  SELECT pg_advisory_xact_lock(hashtextextended(
    target_unit_id::text || ':' || target_tag_id::text,
    71001
  ))
$$;

CREATE FUNCTION lock_unit_effective_tag_vote_key(
  target_unit_id uuid,
  target_tag_id uuid,
  target_profile_id uuid
) RETURNS void
LANGUAGE sql
AS $$
  SELECT pg_advisory_xact_lock(hashtextextended(
    target_unit_id::text || ':' || target_tag_id::text || ':' || target_profile_id::text,
    71002
  ))
$$;

CREATE FUNCTION lock_unit_structure_definition_key(
  target_structure_id uuid
) RETURNS void
LANGUAGE sql
AS $$
  SELECT pg_advisory_xact_lock(hashtextextended(
    target_structure_id::text,
    71005
  ))
$$;

-- Validate one community-immutable structure definition and construct its
-- member/edge projections.
CREATE FUNCTION prepare_unit_structure_definition() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  invalid_member_count integer;
BEGIN
  IF cardinality(NEW.member_unit_ids) <>
    (SELECT count(DISTINCT member_id) FROM unnest(NEW.member_unit_ids) member_id)
  THEN
    RAISE EXCEPTION 'Unit structure members must be distinct'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.kind = 'tag.hierarchy_path' THEN
    SELECT count(*) INTO invalid_member_count
    FROM unnest(NEW.member_unit_ids) member_id
    LEFT JOIN tag ON tag.id = member_id
    LEFT JOIN unit ON unit.id = member_id
    WHERE tag.id IS NULL
       OR unit.kind <> 'tag'
       OR unit.status <> 'published'
       OR unit.visibility <> 'public'
       OR unit.moderation_status <> 'approved'
       OR unit.deleted_at IS NOT NULL;
    IF invalid_member_count <> 0 THEN
      RAISE EXCEPTION 'Tag hierarchy paths require active public Tag members'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported Unit structure kind: %', NEW.kind
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    PERFORM lock_unit_structure_definition_key(NEW.id);
    IF EXISTS (
      SELECT 1
      FROM unit_structure_application application
      WHERE application.structure_id = NEW.id
        AND application.unit_id = ANY(NEW.member_unit_ids)
    ) THEN
      RAISE EXCEPTION 'A Tag hierarchy path cannot contain an existing application target'
        USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM unit_structure_application_vote application_vote
      CROSS JOIN unnest(NEW.member_unit_ids) member_id
      JOIN unit_tag_vote direct_vote
        ON direct_vote.unit_id = application_vote.unit_id
       AND direct_vote.tag_id = member_id
       AND direct_vote.profile_id = application_vote.profile_id
       AND direct_vote.value = -1
      WHERE application_vote.structure_id = NEW.id
        AND application_vote.value = 1
    ) THEN
      RAISE EXCEPTION 'Administrative Structure correction conflicts with a negative direct Tag vote'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER unit_structure_definition_validate
BEFORE INSERT OR UPDATE ON unit_structure
FOR EACH ROW EXECUTE FUNCTION prepare_unit_structure_definition();

CREATE FUNCTION project_unit_structure_definition() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM unit_structure_edge
    WHERE structure_id = NEW.id;
    DELETE FROM unit_structure_member
    WHERE structure_id = NEW.id;
  END IF;

  INSERT INTO unit_structure_member (
    structure_id,
    ordinal,
    member_unit_id,
    member_unit_kind
  )
  SELECT NEW.id, member.ordinality - 1, member.id, source.kind
  FROM unnest(NEW.member_unit_ids) WITH ORDINALITY AS member(id, ordinality)
  JOIN unit source ON source.id = member.id;

  INSERT INTO unit_structure_edge (
    structure_id,
    ordinal,
    parent_unit_id,
    child_unit_id
  )
  SELECT NEW.id, member.ordinality - 1, member.id, NEW.member_unit_ids[member.ordinality + 1]
  FROM unnest(NEW.member_unit_ids) WITH ORDINALITY AS member(id, ordinality)
  WHERE member.ordinality < cardinality(NEW.member_unit_ids);

  IF TG_OP = 'UPDATE' THEN
    INSERT INTO unit_tag_structure_support (
      unit_id,
      tag_id,
      profile_id,
      structure_id
    )
    SELECT
      application_vote.unit_id,
      member.member_unit_id,
      application_vote.profile_id,
      application_vote.structure_id
    FROM unit_structure_application_vote application_vote
    JOIN unit_structure_member member
      ON member.structure_id = application_vote.structure_id
    WHERE application_vote.structure_id = NEW.id
      AND application_vote.value = 1
    ORDER BY
      application_vote.unit_id,
      member.member_unit_id,
      application_vote.profile_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER unit_structure_definition_project
AFTER INSERT OR UPDATE ON unit_structure
FOR EACH ROW EXECUTE FUNCTION project_unit_structure_definition();

CREATE FUNCTION protect_immutable_unit_structure() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_TABLE_NAME = 'unit_structure'
     AND TG_OP = 'UPDATE'
     AND current_setting('rezics.unit_structure_admin_edit_id', true) = OLD.id::text
     AND NEW.id IS NOT DISTINCT FROM OLD.id
     AND NEW.unit_kind IS NOT DISTINCT FROM OLD.unit_kind
     AND NEW.kind IS NOT DISTINCT FROM OLD.kind
     AND NEW.definition_version IS NOT DISTINCT FROM OLD.definition_version
     AND NEW.created_by_profile_id IS NOT DISTINCT FROM OLD.created_by_profile_id
     AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Unit structure definitions and projections are immutable'
    USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER unit_structure_definition_immutable
BEFORE UPDATE OR DELETE ON unit_structure
FOR EACH ROW EXECUTE FUNCTION protect_immutable_unit_structure();

CREATE TRIGGER unit_structure_member_immutable
BEFORE INSERT OR UPDATE OR DELETE ON unit_structure_member
FOR EACH ROW EXECUTE FUNCTION protect_immutable_unit_structure();

CREATE TRIGGER unit_structure_edge_immutable
BEFORE INSERT OR UPDATE OR DELETE ON unit_structure_edge
FOR EACH ROW EXECUTE FUNCTION protect_immutable_unit_structure();

-- Keep the effective context as the union of direct applications and structure support.
CREATE FUNCTION refresh_unit_effective_tag(
  target_unit_id uuid,
  target_tag_id uuid
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  has_direct boolean;
  support_count bigint;
BEGIN
  PERFORM lock_unit_effective_tag_key(target_unit_id, target_tag_id);
  SELECT EXISTS (
    SELECT 1 FROM unit_tag
    WHERE unit_id = target_unit_id AND tag_id = target_tag_id
  ) INTO has_direct;
  SELECT count(*)
  FROM unit_tag_structure_support
  WHERE unit_id = target_unit_id AND tag_id = target_tag_id
  INTO support_count;

  IF has_direct OR support_count > 0 THEN
    INSERT INTO unit_effective_tag (
      unit_id,
      tag_id,
      direct,
      structure_support_count
    )
    VALUES (target_unit_id, target_tag_id, has_direct, support_count)
    ON CONFLICT (unit_id, tag_id) DO UPDATE SET
      direct = excluded.direct,
      structure_support_count = excluded.structure_support_count,
      updated_at = now();
  ELSE
    DELETE FROM unit_effective_tag
    WHERE unit_id = target_unit_id AND tag_id = target_tag_id;
  END IF;
END
$$;

CREATE FUNCTION refresh_unit_effective_tag_vote(
  target_unit_id uuid,
  target_tag_id uuid,
  target_profile_id uuid
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  direct_value integer;
  has_structure_support boolean;
BEGIN
  PERFORM lock_unit_effective_tag_vote_key(
    target_unit_id,
    target_tag_id,
    target_profile_id
  );
  SELECT value INTO direct_value
  FROM unit_tag_vote
  WHERE unit_id = target_unit_id
    AND tag_id = target_tag_id
    AND profile_id = target_profile_id;
  SELECT EXISTS (
    SELECT 1 FROM unit_tag_structure_support
    WHERE unit_id = target_unit_id
      AND tag_id = target_tag_id
      AND profile_id = target_profile_id
  ) INTO has_structure_support;

  IF direct_value IS NOT NULL OR has_structure_support THEN
    INSERT INTO unit_effective_tag_vote (
      unit_id,
      tag_id,
      profile_id,
      value
    )
    VALUES (
      target_unit_id,
      target_tag_id,
      target_profile_id,
      coalesce(direct_value, 1)
    )
    ON CONFLICT (unit_id, tag_id, profile_id) DO UPDATE SET
      value = excluded.value,
      updated_at = now();
  ELSE
    DELETE FROM unit_effective_tag_vote
    WHERE unit_id = target_unit_id
      AND tag_id = target_tag_id
      AND profile_id = target_profile_id;
  END IF;
END
$$;

CREATE FUNCTION maintain_effective_tag_from_direct_context() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM refresh_unit_effective_tag(
    coalesce(NEW.unit_id, OLD.unit_id),
    coalesce(NEW.tag_id, OLD.tag_id)
  );
  RETURN NULL;
END
$$;

CREATE TRIGGER unit_tag_effective_context_maintain
AFTER INSERT OR DELETE ON unit_tag
FOR EACH ROW EXECUTE FUNCTION maintain_effective_tag_from_direct_context();

CREATE FUNCTION reject_conflicting_direct_tag_vote() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM lock_unit_effective_tag_vote_key(
    NEW.unit_id,
    NEW.tag_id,
    NEW.profile_id
  );
  IF NEW.value = -1 AND EXISTS (
    SELECT 1 FROM unit_tag_structure_support
    WHERE unit_id = NEW.unit_id
      AND tag_id = NEW.tag_id
      AND profile_id = NEW.profile_id
  ) THEN
    RAISE EXCEPTION 'A negative direct Tag vote conflicts with positive structure support'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER unit_tag_vote_structure_conflict
BEFORE INSERT OR UPDATE ON unit_tag_vote
FOR EACH ROW EXECUTE FUNCTION reject_conflicting_direct_tag_vote();

CREATE FUNCTION maintain_effective_tag_from_direct_vote() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM refresh_unit_effective_tag_vote(
    coalesce(NEW.unit_id, OLD.unit_id),
    coalesce(NEW.tag_id, OLD.tag_id),
    coalesce(NEW.profile_id, OLD.profile_id)
  );
  RETURN NULL;
END
$$;

CREATE TRIGGER unit_tag_vote_effective_maintain
AFTER INSERT OR UPDATE OR DELETE ON unit_tag_vote
FOR EACH ROW EXECUTE FUNCTION maintain_effective_tag_from_direct_vote();

CREATE FUNCTION maintain_effective_tag_from_structure_support() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_unit_id uuid := coalesce(NEW.unit_id, OLD.unit_id);
  target_tag_id uuid := coalesce(NEW.tag_id, OLD.tag_id);
  target_profile_id uuid := coalesce(NEW.profile_id, OLD.profile_id);
BEGIN
  PERFORM refresh_unit_effective_tag(target_unit_id, target_tag_id);
  PERFORM refresh_unit_effective_tag_vote(
    target_unit_id,
    target_tag_id,
    target_profile_id
  );
  RETURN NULL;
END
$$;

CREATE TRIGGER unit_tag_structure_support_effective_maintain
AFTER INSERT OR DELETE ON unit_tag_structure_support
FOR EACH ROW EXECUTE FUNCTION maintain_effective_tag_from_structure_support();

CREATE FUNCTION reject_conflicting_structure_application_vote() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM lock_unit_structure_definition_key(NEW.structure_id);
  IF EXISTS (
    SELECT 1
    FROM unit_structure_member member
    WHERE member.structure_id = NEW.structure_id
      AND member.member_unit_id = NEW.unit_id
  ) THEN
    RAISE EXCEPTION 'A Tag hierarchy path cannot be applied to one of its members'
      USING ERRCODE = '23514';
  END IF;
  PERFORM lock_unit_effective_tag_vote_key(
    NEW.unit_id,
    member.member_unit_id,
    NEW.profile_id
  )
  FROM unit_structure_member member
  WHERE member.structure_id = NEW.structure_id
  ORDER BY member.member_unit_id;

  IF NEW.value = 1 AND EXISTS (
    SELECT 1
    FROM unit_structure_member member
    JOIN unit_tag_vote direct_vote
      ON direct_vote.unit_id = NEW.unit_id
     AND direct_vote.tag_id = member.member_unit_id
     AND direct_vote.profile_id = NEW.profile_id
     AND direct_vote.value = -1
    WHERE member.structure_id = NEW.structure_id
  ) THEN
    RAISE EXCEPTION 'Positive structure support conflicts with a negative direct Tag vote'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER unit_structure_application_vote_tag_conflict
BEFORE INSERT OR UPDATE ON unit_structure_application_vote
FOR EACH ROW EXECUTE FUNCTION reject_conflicting_structure_application_vote();

CREATE FUNCTION maintain_structure_application_support() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR NEW.value = -1 THEN
    DELETE FROM unit_tag_structure_support
    WHERE unit_id = coalesce(NEW.unit_id, OLD.unit_id)
      AND structure_id = coalesce(NEW.structure_id, OLD.structure_id)
      AND profile_id = coalesce(NEW.profile_id, OLD.profile_id);
  ELSE
    INSERT INTO unit_tag_structure_support (
      unit_id,
      tag_id,
      profile_id,
      structure_id
    )
    SELECT NEW.unit_id, member.member_unit_id, NEW.profile_id, NEW.structure_id
    FROM unit_structure_member member
    WHERE member.structure_id = NEW.structure_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER unit_structure_application_vote_support_maintain
AFTER INSERT OR UPDATE OR DELETE ON unit_structure_application_vote
FOR EACH ROW EXECUTE FUNCTION maintain_structure_application_support();

-- Aggregate the deduplicated effective vote projection, not its provenance rows.
DROP TRIGGER unit_tag_vote_stat_maintain ON unit_tag_vote;
CREATE OR REPLACE FUNCTION maintain_unit_tag_vote_stat() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_unit_id uuid := coalesce(NEW.unit_id, OLD.unit_id);
  target_tag_id uuid := coalesce(NEW.tag_id, OLD.tag_id);
BEGIN
  PERFORM lock_unit_effective_tag_key(target_unit_id, target_tag_id);
  INSERT INTO unit_tag_vote_stat (unit_id, tag_id, score, vote_count)
  SELECT
    target_unit_id,
    target_tag_id,
    coalesce(sum(value), 0)::bigint,
    count(*)::bigint
  FROM unit_effective_tag_vote
  WHERE unit_id = target_unit_id AND tag_id = target_tag_id
  HAVING count(*) > 0
  ON CONFLICT (unit_id, tag_id) DO UPDATE SET
    score = excluded.score,
    vote_count = excluded.vote_count,
    updated_at = now();
  DELETE FROM unit_tag_vote_stat
  WHERE unit_id = target_unit_id
    AND tag_id = target_tag_id
    AND vote_count = 0;
  RETURN NULL;
END
$$;

CREATE TRIGGER unit_tag_vote_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON unit_effective_tag_vote
FOR EACH ROW EXECUTE FUNCTION maintain_unit_tag_vote_stat();

CREATE FUNCTION refresh_unit_structure_vote_stat(target_structure_id uuid) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    target_structure_id::text,
    71003
  ));
  INSERT INTO unit_structure_vote_stat (structure_id, score, vote_count)
  SELECT
    target_structure_id,
    coalesce(sum(value), 0)::bigint,
    count(*)::bigint
  FROM unit_structure_vote
  WHERE structure_id = target_structure_id
  ON CONFLICT (structure_id) DO UPDATE SET
    score = excluded.score,
    vote_count = excluded.vote_count,
    updated_at = now();
  DELETE FROM unit_structure_vote_stat
  WHERE structure_id = target_structure_id AND vote_count = 0;
END
$$;

CREATE FUNCTION maintain_unit_structure_vote_stat() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM refresh_unit_structure_vote_stat(
    coalesce(NEW.structure_id, OLD.structure_id)
  );
  RETURN NULL;
END
$$;

CREATE TRIGGER unit_structure_vote_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON unit_structure_vote
FOR EACH ROW EXECUTE FUNCTION maintain_unit_structure_vote_stat();

CREATE FUNCTION refresh_unit_structure_application_vote_stat(
  target_unit_id uuid,
  target_structure_id uuid
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    target_unit_id::text || ':' || target_structure_id::text,
    71004
  ));
  INSERT INTO unit_structure_application_vote_stat (
    unit_id,
    structure_id,
    score,
    vote_count
  )
  SELECT
    target_unit_id,
    target_structure_id,
    coalesce(sum(value), 0)::bigint,
    count(*)::bigint
  FROM unit_structure_application_vote
  WHERE unit_id = target_unit_id AND structure_id = target_structure_id
  ON CONFLICT (unit_id, structure_id) DO UPDATE SET
    score = excluded.score,
    vote_count = excluded.vote_count,
    updated_at = now();
  DELETE FROM unit_structure_application_vote_stat
  WHERE unit_id = target_unit_id
    AND structure_id = target_structure_id
    AND vote_count = 0;
END
$$;

CREATE FUNCTION maintain_unit_structure_application_vote_stat() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM refresh_unit_structure_application_vote_stat(
    coalesce(NEW.unit_id, OLD.unit_id),
    coalesce(NEW.structure_id, OLD.structure_id)
  );
  RETURN NULL;
END
$$;

CREATE TRIGGER unit_structure_application_vote_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON unit_structure_application_vote
FOR EACH ROW EXECUTE FUNCTION maintain_unit_structure_application_vote_stat();

-- Search invalidation for structure documents and their member-owned text.
DO $$
DECLARE
  source record;
BEGIN
  FOR source IN SELECT * FROM (VALUES
    ('unit_effective_tag', ARRAY['unit_id']),
    ('unit_structure_member', ARRAY['structure_id', 'member_unit_id']),
    ('unit_structure_vote_stat', ARRAY['structure_id'])
  ) AS registry(table_name, key_columns)
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT ON public.%I REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION search_touch_current_statement(%s)',
      'search_projection_touch_' || source.table_name || '_insert',
      source.table_name,
      (SELECT string_agg(quote_literal(column_name), ', ')
       FROM unnest(source.key_columns) AS columns(column_name))
    );
    EXECUTE format(
      'CREATE TRIGGER %I AFTER UPDATE ON public.%I REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION search_touch_current_statement(%s)',
      'search_projection_touch_' || source.table_name || '_update',
      source.table_name,
      (SELECT string_agg(quote_literal(column_name), ', ')
       FROM unnest(source.key_columns) AS columns(column_name))
    );
    EXECUTE format(
      'CREATE TRIGGER %I AFTER DELETE ON public.%I REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION search_touch_current_statement(%s)',
      'search_projection_touch_' || source.table_name || '_delete',
      source.table_name,
      (SELECT string_agg(quote_literal(column_name), ', ')
       FROM unnest(source.key_columns) AS columns(column_name))
    );
  END LOOP;
END
$$;

CREATE FUNCTION search_touch_structure_member_dependents_statement() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  changed_rows jsonb[];
  member_ids uuid[];
  structure_ids uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT array_agg(to_jsonb(row_value)) INTO changed_rows FROM new_rows AS row_value;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT array_agg(to_jsonb(row_value)) INTO changed_rows FROM old_rows AS row_value;
  ELSE
    SELECT array_agg(row_data) INTO changed_rows FROM (
      SELECT to_jsonb(row_value) AS row_data FROM old_rows AS row_value
      UNION ALL
      SELECT to_jsonb(row_value) AS row_data FROM new_rows AS row_value
    ) AS combined;
  END IF;
  member_ids := search_transition_keys(
    coalesce(changed_rows, ARRAY[]::jsonb[]),
    TG_ARGV
  );
  SELECT array_agg(DISTINCT structure_id) INTO structure_ids
  FROM unit_structure_member
  WHERE member_unit_id = ANY(coalesce(member_ids, ARRAY[]::uuid[]));
  PERFORM touch_search_unit_projection(coalesce(structure_ids, ARRAY[]::uuid[]));
  RETURN NULL;
END
$$;

DO $$
DECLARE
  source record;
BEGIN
  FOR source IN SELECT * FROM (VALUES
    ('unit', ARRAY['id']),
    ('unit_localization', ARRAY['unit_id']),
    ('unit_alias', ARRAY['unit_id'])
  ) AS registry(table_name, key_columns)
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT ON public.%I REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION search_touch_structure_member_dependents_statement(%s)',
      'search_structure_dependents_' || source.table_name || '_insert',
      source.table_name,
      (SELECT string_agg(quote_literal(column_name), ', ')
       FROM unnest(source.key_columns) AS columns(column_name))
    );
    EXECUTE format(
      'CREATE TRIGGER %I AFTER UPDATE ON public.%I REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION search_touch_structure_member_dependents_statement(%s)',
      'search_structure_dependents_' || source.table_name || '_update',
      source.table_name,
      (SELECT string_agg(quote_literal(column_name), ', ')
       FROM unnest(source.key_columns) AS columns(column_name))
    );
    EXECUTE format(
      'CREATE TRIGGER %I AFTER DELETE ON public.%I REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION search_touch_structure_member_dependents_statement(%s)',
      'search_structure_dependents_' || source.table_name || '_delete',
      source.table_name,
      (SELECT string_agg(quote_literal(column_name), ', ')
       FROM unnest(source.key_columns) AS columns(column_name))
    );
  END LOOP;
END
$$;

CREATE FUNCTION search_touch_structure_alias_dependents_statement() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  changed_rows jsonb[];
  alias_ids uuid[];
  structure_ids uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT array_agg(to_jsonb(row_value)) INTO changed_rows FROM new_rows AS row_value;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT array_agg(to_jsonb(row_value)) INTO changed_rows FROM old_rows AS row_value;
  ELSE
    SELECT array_agg(row_data) INTO changed_rows FROM (
      SELECT to_jsonb(row_value) AS row_data FROM old_rows AS row_value
      UNION ALL
      SELECT to_jsonb(row_value) AS row_data FROM new_rows AS row_value
    ) AS combined;
  END IF;
  alias_ids := search_transition_keys(
    coalesce(changed_rows, ARRAY[]::jsonb[]),
    ARRAY['alias_id']
  );
  SELECT array_agg(DISTINCT member.structure_id) INTO structure_ids
  FROM unit_alias alias_row
  JOIN unit_structure_member member ON member.member_unit_id = alias_row.unit_id
  WHERE alias_row.id = ANY(coalesce(alias_ids, ARRAY[]::uuid[]));
  PERFORM touch_search_unit_projection(coalesce(structure_ids, ARRAY[]::uuid[]));
  RETURN NULL;
END
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['unit_alias_vote', 'unit_alias_vote_stat']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT ON public.%I REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION search_touch_structure_alias_dependents_statement()',
      'search_structure_alias_dependents_' || table_name || '_insert',
      table_name
    );
    EXECUTE format(
      'CREATE TRIGGER %I AFTER UPDATE ON public.%I REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION search_touch_structure_alias_dependents_statement()',
      'search_structure_alias_dependents_' || table_name || '_update',
      table_name
    );
    EXECUTE format(
      'CREATE TRIGGER %I AFTER DELETE ON public.%I REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION search_touch_structure_alias_dependents_statement()',
      'search_structure_alias_dependents_' || table_name || '_delete',
      table_name
    );
  END LOOP;
END
$$;

-- Realm-scoped structure definition/application votes intentionally remain a
-- future extension. Their authority must not be conflated with these globals.
