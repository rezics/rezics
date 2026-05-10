ALTER TABLE "UserUnitProgress"
ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "UserUnitProgress_userId_isDeleted_lastSeenAt_idx"
ON "UserUnitProgress"("userId", "isDeleted", "lastSeenAt" DESC);
