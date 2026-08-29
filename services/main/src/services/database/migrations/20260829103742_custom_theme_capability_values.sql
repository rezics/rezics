-- atlas:txmode none

SET search_path TO public;

-- PostgreSQL requires newly added enum values to commit before constraints or
-- functions in the following migration can reference them.
ALTER TYPE "platform_capability" ADD VALUE 'platform.custom_theme.external_live.access' AFTER 'platform.development_preview.access';
ALTER TYPE "platform_capability" ADD VALUE 'platform.custom_theme.external_live.access.manage' AFTER 'platform.custom_theme.external_live.access';
ALTER TYPE "platform_capability" ADD VALUE 'platform.custom_theme.review' AFTER 'platform.custom_theme.external_live.access.manage';
ALTER TYPE "platform_capability" ADD VALUE 'platform.custom_theme.kill' AFTER 'platform.custom_theme.review';
ALTER TYPE "unit_permission" ADD VALUE 'zone.pages.manage' AFTER 'unit.realm-publication.manage';
ALTER TYPE "unit_permission" ADD VALUE 'zone.theme.manage' AFTER 'zone.pages.manage';
