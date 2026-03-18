-- CreateTable
CREATE TABLE "JwtService" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "serviceKey" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "jwksUrl" TEXT NOT NULL,
    "jwksPath" TEXT NOT NULL,
    "isLocalIssuer" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JwtService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JwtService_serviceKey_key" ON "JwtService"("serviceKey");

-- CreateIndex
CREATE UNIQUE INDEX "JwtService_issuer_audience_key" ON "JwtService"("issuer", "audience");

-- CreateIndex
CREATE INDEX "JwtService_isLocalIssuer_isActive_idx" ON "JwtService"("isLocalIssuer", "isActive");

ALTER TABLE "Jwks" ADD COLUMN "jwtServiceId" UUID;

-- Insert bootstrap local auth service row
INSERT INTO "JwtService" (
  "serviceKey",
  "issuer",
  "audience",
  "jwksUrl",
  "jwksPath",
  "isLocalIssuer",
  "isActive",
  "updatedAt"
)
VALUES (
  'auth-local',
  '__bootstrap_pending__',
  '__bootstrap_pending__',
  '/api/auth/session/jwks',
  '/api/auth/session/jwks',
  true,
  true,
  CURRENT_TIMESTAMP
);

-- Backfill existing keys to auth-local service record
UPDATE "Jwks"
SET "jwtServiceId" = (SELECT "id" FROM "JwtService" WHERE "serviceKey" = 'auth-local')
WHERE "jwtServiceId" IS NULL;

-- Make relation required
ALTER TABLE "Jwks" ALTER COLUMN "jwtServiceId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Jwks_jwtServiceId_idx" ON "Jwks"("jwtServiceId");

-- AddForeignKey
ALTER TABLE "Jwks" ADD CONSTRAINT "Jwks_jwtServiceId_fkey" FOREIGN KEY ("jwtServiceId") REFERENCES "JwtService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
