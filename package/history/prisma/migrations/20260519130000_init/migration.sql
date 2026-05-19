CREATE TABLE "RevisionContent" (
  "hash" VARCHAR(64) NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RevisionContent_pkey" PRIMARY KEY ("hash")
);

CREATE TABLE "UnitRevision" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "unitId" UUID NOT NULL,
  "sequence" BIGINT NOT NULL,
  "contentHash" VARCHAR(64) NOT NULL,
  "actorUserId" UUID NOT NULL,
  "changedFieldKeys" TEXT[] NOT NULL,
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UnitRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UnitRevision_contentHash_fkey" FOREIGN KEY ("contentHash") REFERENCES "RevisionContent"("hash") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UnitRevision_unitId_sequence_key" ON "UnitRevision"("unitId", "sequence");
CREATE INDEX "UnitRevision_unitId_createdAt_idx" ON "UnitRevision"("unitId", "createdAt" DESC);
CREATE INDEX "UnitRevision_actorUserId_createdAt_idx" ON "UnitRevision"("actorUserId", "createdAt");
CREATE INDEX "UnitRevision_contentHash_idx" ON "UnitRevision"("contentHash");

CREATE TABLE "StructureEvent" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "unitId" UUID NOT NULL,
  "sequence" BIGINT NOT NULL,
  "eventType" VARCHAR(96) NOT NULL,
  "actorUserId" UUID NOT NULL,
  "changedFieldKeys" TEXT[] NOT NULL,
  "payload" JSONB NOT NULL,
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StructureEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StructureEvent_unitId_sequence_eventType_key" ON "StructureEvent"("unitId", "sequence", "eventType");
CREATE INDEX "StructureEvent_unitId_createdAt_idx" ON "StructureEvent"("unitId", "createdAt" DESC);
CREATE INDEX "StructureEvent_eventType_createdAt_idx" ON "StructureEvent"("eventType", "createdAt");

CREATE TABLE "IngestionCursor" (
  "source" VARCHAR(64) NOT NULL,
  "outboxId" UUID,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IngestionCursor_pkey" PRIMARY KEY ("source")
);

CREATE TABLE "OutboxProcessingFailure" (
  "outboxId" UUID NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "retryAfter" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutboxProcessingFailure_pkey" PRIMARY KEY ("outboxId")
);
