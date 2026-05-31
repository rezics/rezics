CREATE TYPE "CatalogEntryKind" AS ENUM (
    'MAIN',
    'VARIANT',
    'NONE'
);

ALTER TABLE "Unit"
    ADD COLUMN "catalogEntryKind" "CatalogEntryKind",
    ADD COLUMN "targetUnitId" UUID;

ALTER TABLE "Unit"
    ADD CONSTRAINT "Unit_targetUnitId_fkey"
    FOREIGN KEY ("targetUnitId") REFERENCES "Unit"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Unit"
    ADD CONSTRAINT "Unit_catalogEntryKind_targetUnitId_check"
    CHECK (
        (
            "catalogEntryKind" = 'VARIANT'
            AND "targetUnitId" IS NOT NULL
        )
        OR (
            ("catalogEntryKind" IS NULL OR "catalogEntryKind" <> 'VARIANT')
            AND "targetUnitId" IS NULL
        )
    );

ALTER TABLE "Unit"
    ADD CONSTRAINT "Unit_series_catalogEntryKind_check"
    CHECK (
        "type" <> 'SERIES'
        OR "catalogEntryKind" IS NULL
    );

CREATE INDEX "Unit_catalogEntryKind_targetUnitId_idx"
    ON "Unit"("catalogEntryKind", "targetUnitId");
