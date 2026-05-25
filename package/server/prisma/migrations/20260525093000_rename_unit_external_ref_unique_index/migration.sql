-- Align the generated unique index name with Prisma's 63-byte-safe name.
-- The previous migration used Prisma's logical full name, which PostgreSQL
-- truncated differently when applying the migration.
ALTER INDEX IF EXISTS "UnitExternalRef_sourceSiteEntityUnitId_externalKind_externalId_"
  RENAME TO "UnitExternalRef_sourceSiteEntityUnitId_externalKind_externa_key";
