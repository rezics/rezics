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

-- CreateTable
CREATE TABLE "Jwks" (
    "id" TEXT NOT NULL,
    "jwtServiceId" UUID NOT NULL,
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "alg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Jwks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JwtService_serviceKey_key" ON "JwtService"("serviceKey");

-- CreateIndex
CREATE UNIQUE INDEX "JwtService_issuer_audience_key" ON "JwtService"("issuer", "audience");

-- CreateIndex
CREATE INDEX "JwtService_isLocalIssuer_isActive_idx" ON "JwtService"("isLocalIssuer", "isActive");

-- CreateIndex
CREATE INDEX "Jwks_jwtServiceId_idx" ON "Jwks"("jwtServiceId");

-- Bootstrap local server JWT service metadata
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
  'server-local',
  'https://bootstrap.invalid/server-local',
  'bootstrap-server-audience',
  'https://bootstrap.invalid/api/session/jwks',
  '/api/session/jwks',
  true,
  true,
  CURRENT_TIMESTAMP
);

-- Bootstrap trusted auth JWT service metadata
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
  'auth-upstream',
  'https://bootstrap.invalid/auth-upstream',
  'bootstrap-auth-audience',
  'https://bootstrap.invalid/api/auth/session/jwks',
  '/api/auth/session/jwks',
  false,
  true,
  CURRENT_TIMESTAMP
);

-- AddForeignKey
ALTER TABLE "Jwks" ADD CONSTRAINT "Jwks_jwtServiceId_fkey" FOREIGN KEY ("jwtServiceId") REFERENCES "JwtService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
