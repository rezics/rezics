-- Add wiki post kind for collaborative wiki-style post content.
ALTER TYPE "PostKind" ADD VALUE IF NOT EXISTS 'WIKI';

-- Delegated per-Unit authority.
CREATE TABLE "UnitCollaborator" (
  "unitId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "roleKey" VARCHAR(32) NOT NULL,
  "addedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UnitCollaborator_pkey" PRIMARY KEY ("unitId", "userId"),
  CONSTRAINT "UnitCollaborator_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UnitCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UnitCollaborator_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("unitId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "UnitCollaborator_userId_roleKey_idx" ON "UnitCollaborator"("userId", "roleKey");
CREATE INDEX "UnitCollaborator_unitId_roleKey_idx" ON "UnitCollaborator"("unitId", "roleKey");

-- Sparse field and whole-object locks. fieldKey = '*' means whole-object lock.
CREATE TABLE "UnitFieldLock" (
  "unitId" UUID NOT NULL,
  "fieldKey" VARCHAR(96) NOT NULL,
  "lockedById" UUID NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UnitFieldLock_pkey" PRIMARY KEY ("unitId", "fieldKey"),
  CONSTRAINT "UnitFieldLock_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UnitFieldLock_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("unitId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "UnitFieldLock_lockedById_createdAt_idx" ON "UnitFieldLock"("lockedById", "createdAt");

-- Per-Unit sequence allocator for history rows written in main transactions.
CREATE TABLE "UnitHistoryClock" (
  "unitId" UUID NOT NULL,
  "nextSequence" BIGINT NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UnitHistoryClock_pkey" PRIMARY KEY ("unitId"),
  CONSTRAINT "UnitHistoryClock_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Transactional outbox consumed by the independent history service.
CREATE TABLE "HistoryOutbox" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "unitId" UUID NOT NULL,
  "sequence" BIGINT NOT NULL,
  "actorUserId" UUID NOT NULL,
  "category" VARCHAR(64) NOT NULL,
  "payload" JSONB NOT NULL,
  "payloadHash" VARCHAR(64),
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "processedById" UUID,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HistoryOutbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HistoryOutbox_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HistoryOutbox_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("unitId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "HistoryOutbox_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "HistoryOutbox_unitId_sequence_key" ON "HistoryOutbox"("unitId", "sequence");
CREATE INDEX "HistoryOutbox_status_nextAttemptAt_createdAt_idx" ON "HistoryOutbox"("status", "nextAttemptAt", "createdAt");
CREATE INDEX "HistoryOutbox_unitId_createdAt_idx" ON "HistoryOutbox"("unitId", "createdAt");
CREATE INDEX "HistoryOutbox_actorUserId_createdAt_idx" ON "HistoryOutbox"("actorUserId", "createdAt");
CREATE INDEX "HistoryOutbox_processedById_idx" ON "HistoryOutbox"("processedById");
