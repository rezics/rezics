CREATE TABLE "AdminWorkMergeOperation" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "sourceWorkUnitId" uuid NOT NULL,
  "targetWorkUnitId" uuid NOT NULL,
  "status" varchar(32) NOT NULL DEFAULT 'QUEUED',
  "actorUserId" uuid NOT NULL,
  "reason" text,
  "copyTagsRequested" boolean NOT NULL DEFAULT false,
  "copyAliasesRequested" boolean NOT NULL DEFAULT false,
  "itemProgress" jsonb NOT NULL DEFAULT '{}',
  "movedMemberships" jsonb NOT NULL DEFAULT '[]',
  "movedLegacyReleaseUnitIds" uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  "createdTagKeys" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "createdAliasIds" uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  "repairUnitIds" uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  "repairCommandCount" integer NOT NULL DEFAULT 0,
  "errorMessage" text,
  "revertedAt" timestamp(3),
  "revertedByUserId" uuid,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,

  CONSTRAINT "AdminWorkMergeOperation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminWorkMergeOperation_sourceWorkUnitId_status_createdAt_idx"
  ON "AdminWorkMergeOperation"("sourceWorkUnitId", "status", "createdAt");

CREATE INDEX "AdminWorkMergeOperation_targetWorkUnitId_status_createdAt_idx"
  ON "AdminWorkMergeOperation"("targetWorkUnitId", "status", "createdAt");

CREATE INDEX "AdminWorkMergeOperation_actorUserId_createdAt_idx"
  ON "AdminWorkMergeOperation"("actorUserId", "createdAt");

ALTER TABLE "AdminWorkMergeOperation"
  ADD CONSTRAINT "AdminWorkMergeOperation_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("unitId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdminWorkMergeOperation"
  ADD CONSTRAINT "AdminWorkMergeOperation_revertedByUserId_fkey"
  FOREIGN KEY ("revertedByUserId") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;
