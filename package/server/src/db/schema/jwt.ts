import {
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
    publicJwk: jsonb().notNull(),
    privateJwk: jsonb().notNull(),
    alg: text(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    expiresAt: timestamp({ precision: 3 }),
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
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    serviceKey: text().notNull(),
    issuer: text().notNull(),
    audience: text().notNull(),
    jwksUrl: text().notNull(),
    jwksPath: text().notNull(),
    isLocalIssuer: boolean().default(false).notNull(),
    isActive: boolean().default(true).notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
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
