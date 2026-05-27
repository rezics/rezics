-- Define public Series Units and direct release lookup projection.

ALTER TYPE "UnitType" ADD VALUE IF NOT EXISTS 'SERIES';
ALTER TYPE "UnitWorkRole" ADD VALUE IF NOT EXISTS 'SERIES';

CREATE TABLE "Series" (
  "unitId" UUID NOT NULL,
  "kindKey" VARCHAR(64) NOT NULL,
  "extra" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Series_pkey" PRIMARY KEY ("unitId")
);

CREATE TABLE "SeriesContentIndex" (
  "seriesUnitId" UUID NOT NULL,
  "releaseUnitId" UUID NOT NULL,
  "contentNodeId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SeriesContentIndex_pkey" PRIMARY KEY ("seriesUnitId", "releaseUnitId", "contentNodeId")
);

CREATE INDEX "Series_kindKey_idx" ON "Series"("kindKey");
CREATE INDEX "Series_updatedAt_idx" ON "Series"("updatedAt" DESC);
CREATE UNIQUE INDEX "SeriesContentIndex_contentNodeId_key" ON "SeriesContentIndex"("contentNodeId");
CREATE INDEX "SeriesContentIndex_seriesUnitId_releaseUnitId_idx" ON "SeriesContentIndex"("seriesUnitId", "releaseUnitId");
CREATE INDEX "SeriesContentIndex_releaseUnitId_seriesUnitId_idx" ON "SeriesContentIndex"("releaseUnitId", "seriesUnitId");

ALTER TABLE "Series"
  ADD CONSTRAINT "Series_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeriesContentIndex"
  ADD CONSTRAINT "SeriesContentIndex_seriesUnitId_fkey"
  FOREIGN KEY ("seriesUnitId") REFERENCES "Series"("unitId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeriesContentIndex"
  ADD CONSTRAINT "SeriesContentIndex_releaseUnitId_fkey"
  FOREIGN KEY ("releaseUnitId") REFERENCES "Unit"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeriesContentIndex"
  ADD CONSTRAINT "SeriesContentIndex_contentNodeId_fkey"
  FOREIGN KEY ("contentNodeId") REFERENCES "ContentStructureNode"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
