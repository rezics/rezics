CREATE TABLE "Account" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" uuid NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp(3),
	"refreshTokenExpiresAt" timestamp(3),
	"scope" text,
	"password" text,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Jwks" (
	"id" text PRIMARY KEY,
	"jwtServiceId" uuid NOT NULL,
	"publicJwk" jsonb NOT NULL,
	"privateJwk" jsonb NOT NULL,
	"alg" text,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"expiresAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "JwtService" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"serviceKey" text NOT NULL UNIQUE,
	"issuer" text NOT NULL,
	"audience" text NOT NULL,
	"jwksUrl" text NOT NULL,
	"jwksPath" text NOT NULL,
	"isLocalIssuer" boolean DEFAULT false NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "OAuthAccessToken" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"token" text NOT NULL UNIQUE,
	"clientId" text NOT NULL,
	"sessionId" text,
	"userId" text,
	"referenceId" text,
	"refreshId" text,
	"expiresAt" timestamp(3) NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"scopes" text[]
);
--> statement-breakpoint
CREATE TABLE "OAuthClient" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"clientId" text NOT NULL UNIQUE,
	"clientSecret" text,
	"disabled" boolean DEFAULT false NOT NULL,
	"skipConsent" boolean,
	"enableEndSession" boolean,
	"scopes" text[],
	"userId" uuid,
	"referenceId" text,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"name" text,
	"uri" text,
	"icon" text,
	"contacts" text[],
	"tos" text,
	"policy" text,
	"softwareId" text,
	"softwareVersion" text,
	"softwareStatement" text,
	"redirectUris" text[],
	"postLogoutRedirectUris" text[],
	"tokenEndpointAuthMethod" text,
	"grantTypes" text[],
	"responseTypes" text[],
	"public" boolean,
	"type" text,
	"requirePKCE" boolean,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "OAuthConsent" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"clientId" text NOT NULL,
	"userId" text,
	"referenceId" text,
	"scopes" text[],
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "OAuthRefreshToken" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"token" text NOT NULL UNIQUE,
	"clientId" text NOT NULL,
	"sessionId" text,
	"userId" text NOT NULL,
	"referenceId" text,
	"expiresAt" timestamp(3) NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"revoked" timestamp(3),
	"authTime" timestamp(3),
	"scopes" text[]
);
--> statement-breakpoint
CREATE TABLE "Session" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"userId" uuid NOT NULL,
	"token" text NOT NULL UNIQUE,
	"expiresAt" timestamp(3) NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"impersonatedBy" uuid,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"name" text NOT NULL,
	"image" text,
	"email" text NOT NULL UNIQUE,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"banReason" text,
	"banExpires" timestamp(3),
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Verification" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account" ("providerId","accountId");--> statement-breakpoint
CREATE INDEX "Account_userId_idx" ON "Account" ("userId");--> statement-breakpoint
CREATE INDEX "Jwks_jwtServiceId_idx" ON "Jwks" ("jwtServiceId");--> statement-breakpoint
CREATE INDEX "Jwks_createdAt_idx" ON "Jwks" ("createdAt");--> statement-breakpoint
CREATE INDEX "Jwks_expiresAt_idx" ON "Jwks" ("expiresAt");--> statement-breakpoint
CREATE UNIQUE INDEX "JwtService_issuer_audience_key" ON "JwtService" ("issuer","audience");--> statement-breakpoint
CREATE INDEX "JwtService_isLocalIssuer_isActive_idx" ON "JwtService" ("isLocalIssuer","isActive");--> statement-breakpoint
CREATE INDEX "OAuthAccessToken_clientId_idx" ON "OAuthAccessToken" ("clientId");--> statement-breakpoint
CREATE INDEX "OAuthAccessToken_sessionId_idx" ON "OAuthAccessToken" ("sessionId");--> statement-breakpoint
CREATE INDEX "OAuthAccessToken_userId_idx" ON "OAuthAccessToken" ("userId");--> statement-breakpoint
CREATE INDEX "OAuthAccessToken_refreshId_idx" ON "OAuthAccessToken" ("refreshId");--> statement-breakpoint
CREATE INDEX "OAuthClient_userId_idx" ON "OAuthClient" ("userId");--> statement-breakpoint
CREATE INDEX "OAuthClient_referenceId_idx" ON "OAuthClient" ("referenceId");--> statement-breakpoint
CREATE INDEX "OAuthConsent_clientId_idx" ON "OAuthConsent" ("clientId");--> statement-breakpoint
CREATE INDEX "OAuthConsent_userId_idx" ON "OAuthConsent" ("userId");--> statement-breakpoint
CREATE INDEX "OAuthConsent_referenceId_idx" ON "OAuthConsent" ("referenceId");--> statement-breakpoint
CREATE INDEX "OAuthRefreshToken_clientId_idx" ON "OAuthRefreshToken" ("clientId");--> statement-breakpoint
CREATE INDEX "OAuthRefreshToken_userId_idx" ON "OAuthRefreshToken" ("userId");--> statement-breakpoint
CREATE INDEX "OAuthRefreshToken_sessionId_idx" ON "OAuthRefreshToken" ("sessionId");--> statement-breakpoint
CREATE INDEX "Session_userId_idx" ON "Session" ("userId");--> statement-breakpoint
CREATE INDEX "User_email_idx" ON "User" ("email");--> statement-breakpoint
CREATE INDEX "Verification_identifier_idx" ON "Verification" ("identifier");--> statement-breakpoint
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_User_id_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Jwks" ADD CONSTRAINT "Jwks_jwtServiceId_JwtService_id_fkey" FOREIGN KEY ("jwtServiceId") REFERENCES "JwtService"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_User_id_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;