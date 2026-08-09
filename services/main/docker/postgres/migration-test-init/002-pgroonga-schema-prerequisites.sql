\connect rezics_atlas_dev

-- The extension is an environment prerequisite. Search functions are owned by
-- the migration directory and must not be pre-created, otherwise replaying the
-- v1 baseline would encounter duplicate function definitions.
CREATE EXTENSION IF NOT EXISTS pgroonga WITH SCHEMA public;
