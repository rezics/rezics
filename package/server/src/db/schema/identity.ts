import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
export const User = pgTable(
  "User",
  {
    unitId: uuid().primaryKey(),
    authUserId: uuid(),
    email: varchar({ length: 320 }),
    name: text(),
    avatar: text(),
    bio: text(),
    description: jsonb(),
    joinDate: timestamp({ precision: 3 }),
    permission: jsonb(),
    followersCount: integer().default(0).notNull(),
    followingsCount: integer().default(0).notNull(),
    settings: jsonb(),
    extra: jsonb(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    uniqueIndex("User_authUserId_key").using(
      "btree",
      table.authUserId.asc().nullsLast(),
    ),
    index("User_email_idx").using("btree", table.email.asc().nullsLast()),
  ],
);

export const ApiToken = pgTable(
  "ApiToken",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text().notNull(),
    tokenHash: text().notNull(),
    scopes: jsonb().default({}).notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    expiresAt: timestamp({ precision: 3 }),
    lastUsedAt: timestamp({ precision: 3 }),
    lastIP: text(),
    userAgent: text(),
    revoked: boolean().default(false).notNull(),
    revokedAt: timestamp({ precision: 3 }),
  },
  (table) => [
    index("ApiToken_expiresAt_idx").using(
      "btree",
      table.expiresAt.asc().nullsLast(),
    ),
    index("ApiToken_tokenHash_idx").using(
      "btree",
      table.tokenHash.asc().nullsLast(),
    ),
    uniqueIndex("ApiToken_tokenHash_key").using(
      "btree",
      table.tokenHash.asc().nullsLast(),
    ),
    index("ApiToken_userId_idx").using("btree", table.userId.asc().nullsLast()),
  ],
);
