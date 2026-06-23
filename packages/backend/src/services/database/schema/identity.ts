import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  createdAt,
  jsonData,
  nullableTimestamp,
  updatedAt,
  uuidv7PrimaryKey,
} from "./columns.ts";

/**
 * Main-owned user profile extension; unitId equals the matching USER Unit id.
 * Main 库拥有的用户资料扩展；unitId 等于对应 USER Unit 的 id。
 */
export const User = pgTable(
  "User",
  {
    /**
     * Canonical user identifier. Equals Unit.id for the matching USER Unit.
     * 规范的用户标识符。等于对应 USER Unit 的 Unit.id。
     */
    unitId: uuid().primaryKey(),
    authUserId: uuid(),
    /**
     * Main-owned Rezics product email.
     * Main 库拥有的 Rezics 产品邮箱。
     */
    email: varchar({ length: 320 }),
    /**
     * Canonical fallback profile fields for USER units.
     * USER Unit 的规范兜底资料字段。
     */
    name: text(),
    avatar: text(),
    summary: text(),
    /**
     * Rich ContentDoc JSON.
     * 富文本 ContentDoc JSON。
     */
    description: jsonData(),
    joinDate: nullableTimestamp(),
    permission: jsonData<{ role?: string } | null>(),
    followersCount: integer().default(0).notNull(),
    followingsCount: integer().default(0).notNull(),
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
    scopes: jsonData<Record<string, unknown>>().default({}).notNull(),
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
