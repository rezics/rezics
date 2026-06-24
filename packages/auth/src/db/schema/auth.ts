import { sql } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";

const timestamp = () => p.timestamp({ precision: 3 });
const createdAt = () => timestamp().notNull().defaultNow();
const updatedAt = () => timestamp().notNull().defaultNow();

export const users = p.pgTable(
  "User",
  {
    id: p.uuid("id").primaryKey().default(sql`uuidv7()`),
    name: p.text("name").notNull(),
    image: p.text("image"),
    email: p.text("email").notNull().unique(),
    emailVerified: p.boolean("emailVerified").notNull().default(false),
    role: p.text("role").notNull().default("user"),
    banned: p.boolean("banned").notNull().default(false),
    banReason: p.text("banReason"),
    banExpires: timestamp(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [p.index("User_email_idx").on(table.email)],
);

export const sessions = p.pgTable(
  "Session",
  {
    id: p.uuid("id").primaryKey().default(sql`uuidv7()`),
    userId: p
      .uuid("userId")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    token: p.text("token").notNull().unique(),
    expiresAt: timestamp().notNull(),
    ipAddress: p.text("ipAddress"),
    userAgent: p.text("userAgent"),
    impersonatedBy: p.uuid("impersonatedBy"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [p.index("Session_userId_idx").on(table.userId)],
);

export const accounts = p.pgTable(
  "Account",
  {
    id: p.uuid("id").primaryKey().default(sql`uuidv7()`),
    accountId: p.text("accountId").notNull(),
    providerId: p.text("providerId").notNull(),
    userId: p
      .uuid("userId")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    accessToken: p.text("accessToken"),
    refreshToken: p.text("refreshToken"),
    idToken: p.text("idToken"),
    accessTokenExpiresAt: timestamp(),
    refreshTokenExpiresAt: timestamp(),
    scope: p.text("scope"),
    password: p.text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    p
      .uniqueIndex("Account_providerId_accountId_key")
      .on(table.providerId, table.accountId),
    p.index("Account_userId_idx").on(table.userId),
  ],
);

export const verifications = p.pgTable(
  "Verification",
  {
    id: p.uuid("id").primaryKey().default(sql`uuidv7()`),
    identifier: p.text("identifier").notNull(),
    value: p.text("value").notNull(),
    expiresAt: timestamp().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [p.index("Verification_identifier_idx").on(table.identifier)],
);

export const jwtServices = p.pgTable(
  "JwtService",
  {
    id: p.uuid("id").primaryKey().default(sql`uuidv7()`),
    serviceKey: p.text("serviceKey").notNull().unique(),
    issuer: p.text("issuer").notNull(),
    audience: p.text("audience").notNull(),
    jwksUrl: p.text("jwksUrl").notNull(),
    jwksPath: p.text("jwksPath").notNull(),
    isLocalIssuer: p.boolean("isLocalIssuer").notNull().default(false),
    isActive: p.boolean("isActive").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    p
      .uniqueIndex("JwtService_issuer_audience_key")
      .on(table.issuer, table.audience),
    p
      .index("JwtService_isLocalIssuer_isActive_idx")
      .on(table.isLocalIssuer, table.isActive),
  ],
);

export const jwks = p.pgTable(
  "Jwks",
  {
    id: p.text("id").primaryKey(),
    jwtServiceId: p
      .uuid("jwtServiceId")
      .notNull()
      .references(() => jwtServices.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Exempt JSON: JOSE/JWK owns the key object shape.
    publicJwk: p.jsonb("publicJwk").notNull(),
    // Exempt JSON: JOSE/JWK owns the key object shape.
    privateJwk: p.jsonb("privateJwk").notNull(),
    alg: p.text("alg"),
    createdAt: createdAt(),
    expiresAt: timestamp(),
  },
  (table) => [
    p.index("Jwks_jwtServiceId_idx").on(table.jwtServiceId),
    p.index("Jwks_createdAt_idx").on(table.createdAt),
    p.index("Jwks_expiresAt_idx").on(table.expiresAt),
  ],
);

export const oauthClients = p.pgTable(
  "OAuthClient",
  {
    id: p.uuid("id").primaryKey().default(sql`uuidv7()`),
    clientId: p.text("clientId").notNull().unique(),
    clientSecret: p.text("clientSecret"),
    disabled: p.boolean("disabled").notNull().default(false),
    skipConsent: p.boolean("skipConsent"),
    enableEndSession: p.boolean("enableEndSession"),
    scopes: p.text("scopes").array(),
    userId: p.uuid("userId"),
    referenceId: p.text("referenceId"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    name: p.text("name"),
    uri: p.text("uri"),
    icon: p.text("icon"),
    contacts: p.text("contacts").array(),
    tos: p.text("tos"),
    policy: p.text("policy"),
    softwareId: p.text("softwareId"),
    softwareVersion: p.text("softwareVersion"),
    softwareStatement: p.text("softwareStatement"),
    redirectUris: p.text("redirectUris").array(),
    postLogoutRedirectUris: p.text("postLogoutRedirectUris").array(),
    tokenEndpointAuthMethod: p.text("tokenEndpointAuthMethod"),
    grantTypes: p.text("grantTypes").array(),
    responseTypes: p.text("responseTypes").array(),
    public: p.boolean("public"),
    type: p.text("type"),
    requirePKCE: p.boolean("requirePKCE"),
    // Exempt JSON: OAuth provider/client metadata owns this generic shape.
    metadata: p.jsonb("metadata"),
  },
  (table) => [
    p.index("OAuthClient_userId_idx").on(table.userId),
    p.index("OAuthClient_referenceId_idx").on(table.referenceId),
  ],
);

export const oauthRefreshTokens = p.pgTable(
  "OAuthRefreshToken",
  {
    id: p.uuid("id").primaryKey().default(sql`uuidv7()`),
    token: p.text("token").notNull().unique(),
    clientId: p.text("clientId").notNull(),
    sessionId: p.text("sessionId"),
    userId: p.text("userId").notNull(),
    referenceId: p.text("referenceId"),
    expiresAt: timestamp().notNull(),
    createdAt: createdAt(),
    revoked: timestamp(),
    authTime: timestamp(),
    scopes: p.text("scopes").array(),
  },
  (table) => [
    p.index("OAuthRefreshToken_clientId_idx").on(table.clientId),
    p.index("OAuthRefreshToken_userId_idx").on(table.userId),
    p.index("OAuthRefreshToken_sessionId_idx").on(table.sessionId),
  ],
);

export const oauthAccessTokens = p.pgTable(
  "OAuthAccessToken",
  {
    id: p.uuid("id").primaryKey().default(sql`uuidv7()`),
    token: p.text("token").notNull().unique(),
    clientId: p.text("clientId").notNull(),
    sessionId: p.text("sessionId"),
    userId: p.text("userId"),
    referenceId: p.text("referenceId"),
    refreshId: p.text("refreshId"),
    expiresAt: timestamp().notNull(),
    createdAt: createdAt(),
    scopes: p.text("scopes").array(),
  },
  (table) => [
    p.index("OAuthAccessToken_clientId_idx").on(table.clientId),
    p.index("OAuthAccessToken_sessionId_idx").on(table.sessionId),
    p.index("OAuthAccessToken_userId_idx").on(table.userId),
    p.index("OAuthAccessToken_refreshId_idx").on(table.refreshId),
  ],
);

export const oauthConsents = p.pgTable(
  "OAuthConsent",
  {
    id: p.uuid("id").primaryKey().default(sql`uuidv7()`),
    clientId: p.text("clientId").notNull(),
    userId: p.text("userId"),
    referenceId: p.text("referenceId"),
    scopes: p.text("scopes").array(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    p.index("OAuthConsent_clientId_idx").on(table.clientId),
    p.index("OAuthConsent_userId_idx").on(table.userId),
    p.index("OAuthConsent_referenceId_idx").on(table.referenceId),
  ],
);

export const betterAuthSchema = {
  user: users,
  session: sessions,
  account: accounts,
  verification: verifications,
  jwks,
  jwtService: jwtServices,
  oauthClient: oauthClients,
  oauthRefreshToken: oauthRefreshTokens,
  oauthAccessToken: oauthAccessTokens,
  oauthConsent: oauthConsents,
};

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;
export type AccountRow = typeof accounts.$inferSelect;
export type NewAccountRow = typeof accounts.$inferInsert;
export type VerificationRow = typeof verifications.$inferSelect;
export type NewVerificationRow = typeof verifications.$inferInsert;
export type JwtServiceRow = typeof jwtServices.$inferSelect;
export type NewJwtServiceRow = typeof jwtServices.$inferInsert;
export type JwksRow = typeof jwks.$inferSelect;
export type NewJwksRow = typeof jwks.$inferInsert;
export type OAuthClientRow = typeof oauthClients.$inferSelect;
export type NewOAuthClientRow = typeof oauthClients.$inferInsert;
export type OAuthRefreshTokenRow = typeof oauthRefreshTokens.$inferSelect;
export type NewOAuthRefreshTokenRow = typeof oauthRefreshTokens.$inferInsert;
export type OAuthAccessTokenRow = typeof oauthAccessTokens.$inferSelect;
export type NewOAuthAccessTokenRow = typeof oauthAccessTokens.$inferInsert;
export type OAuthConsentRow = typeof oauthConsents.$inferSelect;
export type NewOAuthConsentRow = typeof oauthConsents.$inferInsert;
