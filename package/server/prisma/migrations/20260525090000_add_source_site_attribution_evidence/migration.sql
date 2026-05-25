-- CreateTable
CREATE TABLE "SourceSite" (
    "entityUnitId" UUID NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "crawlSupport" VARCHAR(32) NOT NULL,
    "crawlEnabled" BOOLEAN NOT NULL DEFAULT false,
    "crawlerAdapterKey" VARCHAR(64),
    "refRules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceSite_pkey" PRIMARY KEY ("entityUnitId")
);

-- CreateTable
CREATE TABLE "UnitExternalRef" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "unitId" UUID NOT NULL,
    "sourceSiteEntityUnitId" UUID NOT NULL,
    "externalKind" VARCHAR(64) NOT NULL,
    "externalId" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "originalUrl" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitExternalRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditAttributionEvidence" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "unitId" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "role" VARCHAR(64) NOT NULL,
    "sourceRefId" UUID NOT NULL,
    "claimPath" TEXT,
    "observedUrl" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditAttributionEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceSite_key_key" ON "SourceSite"("key");

-- CreateIndex
CREATE INDEX "SourceSite_crawlSupport_crawlEnabled_idx" ON "SourceSite"("crawlSupport", "crawlEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "UnitExternalRef_sourceSiteEntityUnitId_externalKind_externalId_key" ON "UnitExternalRef"("sourceSiteEntityUnitId", "externalKind", "externalId");

-- CreateIndex
CREATE INDEX "UnitExternalRef_unitId_sourceSiteEntityUnitId_externalKind_idx" ON "UnitExternalRef"("unitId", "sourceSiteEntityUnitId", "externalKind");

-- CreateIndex
CREATE INDEX "UnitExternalRef_sourceSiteEntityUnitId_externalKind_idx" ON "UnitExternalRef"("sourceSiteEntityUnitId", "externalKind");

-- CreateIndex
CREATE INDEX "CreditAttributionEvidence_unitId_entityId_role_idx" ON "CreditAttributionEvidence"("unitId", "entityId", "role");

-- CreateIndex
CREATE INDEX "CreditAttributionEvidence_sourceRefId_idx" ON "CreditAttributionEvidence"("sourceRefId");

-- AddForeignKey
ALTER TABLE "SourceSite" ADD CONSTRAINT "SourceSite_entityUnitId_fkey" FOREIGN KEY ("entityUnitId") REFERENCES "Entity"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitExternalRef" ADD CONSTRAINT "UnitExternalRef_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitExternalRef" ADD CONSTRAINT "UnitExternalRef_sourceSiteEntityUnitId_fkey" FOREIGN KEY ("sourceSiteEntityUnitId") REFERENCES "SourceSite"("entityUnitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditAttributionEvidence" ADD CONSTRAINT "CreditAttributionEvidence_unitId_entityId_role_fkey" FOREIGN KEY ("unitId", "entityId", "role") REFERENCES "CreditAttribution"("unitId", "entityId", "role") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditAttributionEvidence" ADD CONSTRAINT "CreditAttributionEvidence_sourceRefId_fkey" FOREIGN KEY ("sourceRefId") REFERENCES "UnitExternalRef"("id") ON DELETE CASCADE ON UPDATE CASCADE;
