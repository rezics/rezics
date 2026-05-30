-- Introduce UnitWork as the canonical work-domain membership relation while
-- keeping Unit.workUnitId synchronized during the migration period.

CREATE TYPE "UnitWorkRole" AS ENUM (
    'RELEASE',
    'POST',
    'REVIEW',
    'SHELF',
    'WIKI',
    'GUIDE',
    'DERIVED'
);

CREATE TYPE "UnitWorkDisplayPolicy" AS ENUM (
    'PRIMARY',
    'SECONDARY',
    'HIDDEN_BY_DEFAULT'
);

CREATE TABLE "UnitWork" (
    "unitId" UUID NOT NULL,
    "workUnitId" UUID NOT NULL,
    "role" "UnitWorkRole" NOT NULL,
    "language" VARCHAR(16),
    "position" VARCHAR(64),
    "displayPolicy" "UnitWorkDisplayPolicy" NOT NULL DEFAULT 'PRIMARY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitWork_pkey" PRIMARY KEY ("unitId", "workUnitId", "role")
);

CREATE INDEX "UnitWork_workUnitId_role_position_unitId_idx"
    ON "UnitWork"("workUnitId", "role", "position", "unitId");

CREATE INDEX "UnitWork_workUnitId_role_createdAt_unitId_idx"
    ON "UnitWork"("workUnitId", "role", "createdAt", "unitId");

CREATE INDEX "UnitWork_unitId_role_workUnitId_idx"
    ON "UnitWork"("unitId", "role", "workUnitId");

CREATE UNIQUE INDEX "UnitWork_release_unit_unique"
    ON "UnitWork"("unitId")
    WHERE "role" = 'RELEASE';

ALTER TABLE "UnitWork"
    ADD CONSTRAINT "UnitWork_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UnitWork"
    ADD CONSTRAINT "UnitWork_workUnitId_fkey"
    FOREIGN KEY ("workUnitId") REFERENCES "Unit"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "UnitWork" (
    "unitId",
    "workUnitId",
    "role",
    "language",
    "displayPolicy",
    "createdAt",
    "updatedAt"
)
SELECT
    release."id",
    release."workUnitId",
    'RELEASE'::"UnitWorkRole",
    release."defaultLanguage",
    'PRIMARY'::"UnitWorkDisplayPolicy",
    release."createdAt",
    CURRENT_TIMESTAMP
FROM "Unit" release
JOIN "Unit" work ON work."id" = release."workUnitId"
WHERE release."workUnitId" IS NOT NULL
  AND work."workUnitId" IS NULL
ON CONFLICT ("unitId", "workUnitId", "role") DO NOTHING;

CREATE OR REPLACE VIEW "UnitWorkReleaseDrift" AS
SELECT
    release."id" AS "unitId",
    release."workUnitId" AS "legacyWorkUnitId",
    membership."workUnitId" AS "unitWorkWorkUnitId",
    CASE
        WHEN release."workUnitId" IS NULL AND membership."workUnitId" IS NOT NULL
            THEN 'missing_legacy_workUnitId'
        WHEN release."workUnitId" IS NOT NULL AND membership."workUnitId" IS NULL
            THEN 'missing_unit_work_release'
        WHEN release."workUnitId" IS DISTINCT FROM membership."workUnitId"
            THEN 'work_domain_mismatch'
        ELSE 'ok'
    END AS "status"
FROM "Unit" release
FULL JOIN "UnitWork" membership
    ON membership."unitId" = release."id"
   AND membership."role" = 'RELEASE'
WHERE (
    release."workUnitId" IS NOT NULL
    OR membership."workUnitId" IS NOT NULL
)
AND (
    release."workUnitId" IS DISTINCT FROM membership."workUnitId"
    OR release."id" IS NULL
);
