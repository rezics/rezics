-- AlterEnum: Add ENTITY to UnitType
ALTER TYPE "UnitType" ADD VALUE 'ENTITY';

-- CreateTable: Entity extension
CREATE TABLE "Entity" (
    "unitId" UUID NOT NULL,
    "kind" VARCHAR(32),
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("unitId")
);

-- CreateTable: Attribution (unified credits)
CREATE TABLE "Attribution" (
    "unitId" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "role" VARCHAR(64) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Attribution_pkey" PRIMARY KEY ("unitId","entityId","role")
);

-- CreateIndex
CREATE INDEX "Attribution_entityId_role_idx" ON "Attribution"("entityId", "role");
CREATE INDEX "Attribution_unitId_role_sortOrder_idx" ON "Attribution"("unitId", "role", "sortOrder");

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attribution" ADD CONSTRAINT "Attribution_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attribution" ADD CONSTRAINT "Attribution_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- DATA MIGRATION: Convert Person/Organization → Unit + Entity
-- and PersonCredit/OrgCredit → Attribution
-- ============================================================

-- Migrate Person rows → Unit (type=ENTITY) + Entity (kind='person')
INSERT INTO "Unit" ("id", "type", "status", "visibility", "createdAt", "updatedAt")
SELECT "id", 'ENTITY'::"UnitType", 'PUBLISHED'::"UnitStatus", 'PUBLIC'::"UnitVisibility", "createdAt", "updatedAt"
FROM "Person";

INSERT INTO "Entity" ("unitId", "kind", "verified")
SELECT "id", 'person', false
FROM "Person";

-- Create a UnitTranslation for each Person (using name as title, English by default)
INSERT INTO "UnitTranslation" ("unitId", "language", "title", "createdAt", "updatedAt")
SELECT "id", 'en', "name", "createdAt", "updatedAt"
FROM "Person";

-- Migrate Organization rows → Unit (type=ENTITY) + Entity (kind='organization')
INSERT INTO "Unit" ("id", "type", "status", "visibility", "createdAt", "updatedAt")
SELECT "id", 'ENTITY'::"UnitType", 'PUBLISHED'::"UnitStatus", 'PUBLIC'::"UnitVisibility", "createdAt", "updatedAt"
FROM "Organization";

INSERT INTO "Entity" ("unitId", "kind", "verified")
SELECT "id", 'organization', false
FROM "Organization";

-- Create a UnitTranslation for each Organization
INSERT INTO "UnitTranslation" ("unitId", "language", "title", "createdAt", "updatedAt")
SELECT "id", 'en', "name", "createdAt", "updatedAt"
FROM "Organization";

-- Migrate PersonCredit → Attribution (roleKey → role, personId → entityId)
INSERT INTO "Attribution" ("unitId", "entityId", "role", "sortOrder")
SELECT "unitId", "personId", "roleKey", "sortOrder"
FROM "PersonCredit";

-- Migrate OrgCredit → Attribution (roleKey → role, organizationId → entityId)
-- Use ON CONFLICT to handle potential duplicates (same unit+entity+role from both tables)
INSERT INTO "Attribution" ("unitId", "entityId", "role", "sortOrder")
SELECT "unitId", "organizationId", "roleKey", "sortOrder"
FROM "OrgCredit"
ON CONFLICT DO NOTHING;

-- ============================================================
-- DROP OLD TABLES (after data migration)
-- ============================================================

-- Drop foreign keys first
ALTER TABLE "PersonCredit" DROP CONSTRAINT IF EXISTS "PersonCredit_unitId_fkey";
ALTER TABLE "PersonCredit" DROP CONSTRAINT IF EXISTS "PersonCredit_personId_fkey";
ALTER TABLE "OrgCredit" DROP CONSTRAINT IF EXISTS "OrgCredit_unitId_fkey";
ALTER TABLE "OrgCredit" DROP CONSTRAINT IF EXISTS "OrgCredit_organizationId_fkey";

-- Drop credit tables
DROP TABLE "PersonCredit";
DROP TABLE "OrgCredit";

-- Drop entity tables
DROP TABLE "Person";
DROP TABLE "Organization";
