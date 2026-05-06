-- Dev-stage migration: legacy string lastPosition values are intentionally not preserved.
ALTER TABLE "UserUnitProgress"
  ALTER COLUMN "lastPosition" TYPE JSONB USING NULL;
