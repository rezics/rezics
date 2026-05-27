CREATE TABLE "GameSystemRequirement" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "gameUnitId" UUID NOT NULL,
    "platformEntityId" UUID,
    "tier" VARCHAR(32) NOT NULL,
    "language" VARCHAR(16),
    "sourceRefId" UUID,
    "hardware" JSONB NOT NULL,
    "rawText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSystemRequirement_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GameSystemRequirement"
    ADD CONSTRAINT "GameSystemRequirement_gameUnitId_fkey"
    FOREIGN KEY ("gameUnitId") REFERENCES "Game"("unitId")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GameSystemRequirement"
    ADD CONSTRAINT "GameSystemRequirement_platformEntityId_fkey"
    FOREIGN KEY ("platformEntityId") REFERENCES "Unit"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GameSystemRequirement"
    ADD CONSTRAINT "GameSystemRequirement_sourceRefId_fkey"
    FOREIGN KEY ("sourceRefId") REFERENCES "UnitExternalRef"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "GameSystemRequirement_gameUnitId_idx"
    ON "GameSystemRequirement"("gameUnitId");

CREATE INDEX "GameSystemRequirement_platformEntityId_idx"
    ON "GameSystemRequirement"("platformEntityId");

CREATE INDEX "GameSystemRequirement_tier_idx"
    ON "GameSystemRequirement"("tier");

CREATE INDEX "GameSystemRequirement_sourceRefId_idx"
    ON "GameSystemRequirement"("sourceRefId");

CREATE INDEX "GameSystemRequirement_gameUnitId_platformEntityId_tier_sourceRefId_idx"
    ON "GameSystemRequirement"("gameUnitId", "platformEntityId", "tier", "sourceRefId");
