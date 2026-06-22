import type { JwtPrivateJwk, JwtPublicJwk } from "@rezics/jwt";
import {
  boolean,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  createdAt,
  jsonData,
  nullableTimestamp,
  updatedAt,
  uuidv7PrimaryKey,
} from "./columns";
export const Jwks = pgTable(
  "Jwks",
  {
    id: text().primaryKey(),
    jwtServiceId: uuid()
      .notNull()
      .references(() => JwtService.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Exempt JSON: JOSE/JWK owns the key object shape.
    publicJwk: jsonData<JwtPublicJwk>().notNull(),
    // Exempt JSON: JOSE/JWK owns the key object shape.
    privateJwk: jsonData<JwtPrivateJwk>().notNull(),
    alg: text(),
    createdAt: createdAt(),
    expiresAt: nullableTimestamp(),
  },
  (table) => [
    index("Jwks_jwtServiceId_idx").using(
      "btree",
      table.jwtServiceId.asc().nullsLast(),
    ),
  ],
);

export const JwtService = pgTable(
  "JwtService",
  {
    id: uuidv7PrimaryKey(),
    serviceKey: text().notNull(),
    issuer: text().notNull(),
    audience: text().notNull(),
    jwksUrl: text().notNull(),
    jwksPath: text().notNull(),
    isLocalIssuer: boolean().default(false).notNull(),
    isActive: boolean().default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("JwtService_isLocalIssuer_isActive_idx").using(
      "btree",
      table.isLocalIssuer.asc().nullsLast(),
      table.isActive.asc().nullsLast(),
    ),
    uniqueIndex("JwtService_issuer_audience_key").using(
      "btree",
      table.issuer.asc().nullsLast(),
      table.audience.asc().nullsLast(),
    ),
    uniqueIndex("JwtService_serviceKey_key").using(
      "btree",
      table.serviceKey.asc().nullsLast(),
    ),
  ],
);
