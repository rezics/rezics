-- atlas:txmode none

-- Build replacements before removing the old indexes so reads and uniqueness
-- enforcement remain available throughout the online cutover.
CREATE INDEX CONCURRENTLY IF NOT EXISTS unit_alias_unit_position_active_idx
    ON public.unit_alias (unit_id, pinned, "position", id)
    WHERE withdrawn_at IS NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unit_alias_unit_pinned_position_active_unique
    ON public.unit_alias (unit_id, "position")
    WHERE pinned AND withdrawn_at IS NULL;

DROP INDEX CONCURRENTLY IF EXISTS public.unit_alias_unit_position_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.unit_alias_unit_pinned_position_unique;

ALTER INDEX IF EXISTS public.unit_alias_unit_position_active_idx
    RENAME TO unit_alias_unit_position_idx;
ALTER INDEX IF EXISTS public.unit_alias_unit_pinned_position_active_unique
    RENAME TO unit_alias_unit_pinned_position_unique;

CREATE INDEX CONCURRENTLY IF NOT EXISTS unit_external_link_unit_position_active_idx
    ON public.unit_external_link (unit_id, pinned, "position", id)
    WHERE withdrawn_at IS NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unit_external_link_unit_pinned_position_active_unique
    ON public.unit_external_link (unit_id, "position")
    WHERE pinned AND withdrawn_at IS NULL;

DROP INDEX CONCURRENTLY IF EXISTS public.unit_external_link_unit_position_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.unit_external_link_unit_pinned_position_unique;

ALTER INDEX IF EXISTS public.unit_external_link_unit_position_active_idx
    RENAME TO unit_external_link_unit_position_idx;
ALTER INDEX IF EXISTS public.unit_external_link_unit_pinned_position_active_unique
    RENAME TO unit_external_link_unit_pinned_position_unique;
