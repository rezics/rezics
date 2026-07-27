-- Create index "dock_revision_actor_created_at_idx" to table: "dock_revision"
CREATE INDEX "dock_revision_actor_created_at_idx" ON "dock_revision" ("actor_profile_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
-- Create "studio_resource_visit" table
CREATE TABLE "studio_resource_visit" (
  "profile_id" uuid NOT NULL,
  "resource_unit_id" uuid NOT NULL,
  "last_visited_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("profile_id", "resource_unit_id"),
  CONSTRAINT "studio_resource_visit_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "studio_resource_visit_resource_unit_id_unit_id_fkey" FOREIGN KEY ("resource_unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "studio_resource_visit_profile_recent_idx" to table: "studio_resource_visit"
CREATE INDEX "studio_resource_visit_profile_recent_idx" ON "studio_resource_visit" ("profile_id", "last_visited_at" DESC NULLS LAST, "resource_unit_id" DESC NULLS LAST);
-- Create "studio_work_relation" table
CREATE TABLE "studio_work_relation" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "profile_id" uuid NOT NULL,
  "resource_unit_id" uuid NOT NULL,
  "authorization_unit_id" uuid NOT NULL,
  "authorization_scope" text[] NULL,
  "authorization_scope_key" text NOT NULL,
  "relation" text NOT NULL,
  "source" text NOT NULL,
  "first_at" timestamptz(3) NOT NULL,
  "last_at" timestamptz(3) NOT NULL,
  "activity_count" integer NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "studio_work_relation_authorization_unit_id_unit_id_fkey" FOREIGN KEY ("authorization_unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "studio_work_relation_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "studio_work_relation_resource_unit_id_unit_id_fkey" FOREIGN KEY ("resource_unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "studio_work_relation_activity_count_check" CHECK (activity_count > 0),
  CONSTRAINT "studio_work_relation_relation_check" CHECK (relation = ANY (ARRAY['created'::text, 'contributed'::text])),
  CONSTRAINT "studio_work_relation_relation_source_check" CHECK (((relation = 'created'::text) AND (source = 'unit_status'::text)) OR ((relation = 'contributed'::text) AND (source = ANY (ARRAY['unit_revision'::text, 'content_structure_revision'::text, 'dock_revision'::text])))),
  CONSTRAINT "studio_work_relation_scope_key_check" CHECK (((authorization_scope IS NULL) AND (authorization_scope_key = '*'::text)) OR ((authorization_scope IS NOT NULL) AND (authorization_scope_key = array_to_string(authorization_scope, '/'::text)))),
  CONSTRAINT "studio_work_relation_source_check" CHECK (source = ANY (ARRAY['unit_status'::text, 'unit_revision'::text, 'content_structure_revision'::text, 'dock_revision'::text])),
  CONSTRAINT "studio_work_relation_time_check" CHECK (first_at <= last_at)
);
-- Create index "studio_work_relation_identity_key" to table: "studio_work_relation"
CREATE UNIQUE INDEX "studio_work_relation_identity_key" ON "studio_work_relation" ("profile_id", "resource_unit_id", "authorization_unit_id", "authorization_scope_key", "relation", "source");
-- Create index "studio_work_relation_profile_relation_last_idx" to table: "studio_work_relation"
CREATE INDEX "studio_work_relation_profile_relation_last_idx" ON "studio_work_relation" ("profile_id", "relation", "last_at" DESC NULLS LAST, "resource_unit_id" DESC NULLS LAST);
-- Create index "studio_work_relation_profile_resource_idx" to table: "studio_work_relation"
CREATE INDEX "studio_work_relation_profile_resource_idx" ON "studio_work_relation" ("profile_id", "resource_unit_id");
-- Backfill creation evidence from the immutable Unit lifecycle ledger.
INSERT INTO "studio_work_relation" (
  "profile_id",
  "resource_unit_id",
  "authorization_unit_id",
  "authorization_scope",
  "authorization_scope_key",
  "relation",
  "source",
  "first_at",
  "last_at",
  "activity_count"
)
SELECT
  event.changed_by_profile_id,
  event.unit_id,
  event.unit_id,
  NULL,
  '*',
  'created',
  'unit_status',
  min(event.created_at),
  max(event.created_at),
  count(*)::integer
FROM "unit_status_event" event
WHERE event.from_status IS NULL
  AND event.actor_kind = 'profile'
  AND event.changed_by_profile_id IS NOT NULL
GROUP BY event.changed_by_profile_id, event.unit_id;
-- Backfill Unit revision contributions, excluding the initial creation snapshot.
INSERT INTO "studio_work_relation" (
  "profile_id",
  "resource_unit_id",
  "authorization_unit_id",
  "authorization_scope",
  "authorization_scope_key",
  "relation",
  "source",
  "first_at",
  "last_at",
  "activity_count"
)
SELECT
  revision.actor_profile_id,
  COALESCE(book_owner.owner_unit_id, revision.unit_id),
  revision.unit_id,
  NULL,
  '*',
  'contributed',
  'unit_revision',
  min(revision.created_at),
  max(revision.created_at),
  count(*)::integer
FROM "unit_revision" revision
LEFT JOIN LATERAL (
  SELECT DISTINCT structure.owner_unit_id
  FROM "content_structure_node" node
  JOIN "content_structure" structure
    ON structure.id = node.structure_id
    AND structure.owner_unit_id = node.owner_unit_id
  WHERE node.content_unit_id = revision.unit_id
    AND node.created_at <= revision.created_at
    AND (node.deleted_at IS NULL OR node.deleted_at > revision.created_at)
    AND structure.kind = 'book.contents'
    AND structure.created_at <= revision.created_at
    AND (structure.deleted_at IS NULL OR structure.deleted_at > revision.created_at)
) book_owner ON true
WHERE revision.actor_profile_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "unit_status_event" initial_event
    WHERE initial_event.unit_id = revision.unit_id
      AND initial_event.from_status IS NULL
      AND initial_event.revision_id = revision.id
  )
GROUP BY
  revision.actor_profile_id,
  COALESCE(book_owner.owner_unit_id, revision.unit_id),
  revision.unit_id;
-- Backfill Content Structure contributions with their exact owner scope.
INSERT INTO "studio_work_relation" (
  "profile_id",
  "resource_unit_id",
  "authorization_unit_id",
  "authorization_scope",
  "authorization_scope_key",
  "relation",
  "source",
  "first_at",
  "last_at",
  "activity_count"
)
SELECT
  revision.actor_profile_id,
  structure.owner_unit_id,
  structure.owner_unit_id,
  ARRAY['content-structure']::text[],
  'content-structure',
  'contributed',
  'content_structure_revision',
  min(revision.created_at),
  max(revision.created_at),
  count(*)::integer
FROM "content_structure_revision" revision
JOIN "content_structure" structure ON structure.id = revision.structure_id
WHERE revision.actor_profile_id IS NOT NULL
GROUP BY revision.actor_profile_id, structure.owner_unit_id;
-- Backfill Dock contributions with their exact Dock scope.
INSERT INTO "studio_work_relation" (
  "profile_id",
  "resource_unit_id",
  "authorization_unit_id",
  "authorization_scope",
  "authorization_scope_key",
  "relation",
  "source",
  "first_at",
  "last_at",
  "activity_count"
)
SELECT
  revision.actor_profile_id,
  dock.unit_id,
  dock.unit_id,
  ARRAY['dock', dock.kind::text]::text[],
  'dock/' || dock.kind::text,
  'contributed',
  'dock_revision',
  min(revision.created_at),
  max(revision.created_at),
  count(*)::integer
FROM "dock_revision" revision
JOIN "unit_dock" dock ON dock.id = revision.dock_id
WHERE revision.actor_profile_id IS NOT NULL
GROUP BY revision.actor_profile_id, dock.unit_id, dock.kind;
