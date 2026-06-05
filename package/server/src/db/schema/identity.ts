import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  createdAt,
  jsonData,
  nullableTimestamp,
  timestampMs,
  updatedAt,
  uuidv7PrimaryKey,
} from "./columns";
export const User = pgTable(
  "User",
  {
    unitId: uuid().primaryKey(),
    authUserId: uuid(),
    email: varchar({ length: 320 }),
    name: text(),
    avatar: text(),
    bio: text(),
    description: jsonData(),
    joinDate: nullableTimestamp(),
    permission: jsonData(),
    followersCount: integer().default(0).notNull(),
    followingsCount: integer().default(0).notNull(),
    settings: jsonData(),
    extra: jsonData(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
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
    id: uuidv7PrimaryKey(),
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text().notNull(),
    tokenHash: text().notNull(),
    scopes: jsonData().default({}).notNull(),
    createdAt: createdAt(),
    expiresAt: nullableTimestamp(),
    lastUsedAt: nullableTimestamp(),
    lastIP: text(),
    userAgent: text(),
    revoked: boolean().default(false).notNull(),
    revokedAt: nullableTimestamp(),
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
