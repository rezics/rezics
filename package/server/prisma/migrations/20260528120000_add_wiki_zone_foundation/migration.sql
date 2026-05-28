ALTER TYPE "UnitType" ADD VALUE IF NOT EXISTS 'LABEL';

ALTER TABLE "Zone"
    ADD COLUMN "wiki" JSONB;

CREATE TABLE "WorkRealmContext" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "workUnitId" UUID NOT NULL,
    "realmUnitId" UUID NOT NULL,
    "role" VARCHAR(32) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "locale" VARCHAR(16),
    "releaseUnitId" UUID,
    "createdByUserId" UUID,
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkRealmContext_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkRealmContext"
    ADD CONSTRAINT "WorkRealmContext_workUnitId_fkey"
    FOREIGN KEY ("workUnitId") REFERENCES "Unit"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkRealmContext"
    ADD CONSTRAINT "WorkRealmContext_realmUnitId_fkey"
    FOREIGN KEY ("realmUnitId") REFERENCES "Unit"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkRealmContext"
    ADD CONSTRAINT "WorkRealmContext_releaseUnitId_fkey"
    FOREIGN KEY ("releaseUnitId") REFERENCES "Unit"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkRealmContext"
    ADD CONSTRAINT "WorkRealmContext_role_check"
    CHECK ("role" IN ('official', 'community', 'language', 'archive'));

CREATE UNIQUE INDEX "WorkRealmContext_work_realm_role_locale_release_key"
    ON "WorkRealmContext" (
        "workUnitId",
        "realmUnitId",
        "role",
        COALESCE("locale", ''),
        COALESCE("releaseUnitId"::text, '')
    );

CREATE INDEX "WorkRealmContext_workUnitId_role_priority_id_idx"
    ON "WorkRealmContext"("workUnitId", "role", "priority", "id");

CREATE INDEX "WorkRealmContext_realmUnitId_role_priority_id_idx"
    ON "WorkRealmContext"("realmUnitId", "role", "priority", "id");

CREATE INDEX "WorkRealmContext_releaseUnitId_role_idx"
    ON "WorkRealmContext"("releaseUnitId", "role");
