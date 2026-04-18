-- Rename PostKind enum value QUOTE → EXCERPT.
--
-- The library uses this kind for users highlighting memorable passages
-- from a work (targetUnitId already attributes the work + author).
-- "Excerpt" is the intent-correct name for a user-picked fragment.
--
-- Postgres' ALTER TYPE RENAME VALUE both renames the enum entry and
-- leaves all existing Post.kind rows referencing it, so no explicit
-- UPDATE is needed.
--
-- inverse (manual, for runbook purposes only; not auto-applied):
--   ALTER TYPE "PostKind" RENAME VALUE 'EXCERPT' TO 'QUOTE';
--   UPDATE "Post" SET "kind" = 'QUOTE' WHERE "kind" = 'EXCERPT';

ALTER TYPE "PostKind" RENAME VALUE 'QUOTE' TO 'EXCERPT';
