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
} from "./columns";

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
     * Main-owned Rezics product email. It may be initialized from a verified
     * auth login email during materialization, but is not synchronized with
     * auth.User.email after that point.
     * Main 库拥有的 Rezics 产品邮箱。可在物化期间用已验证的 auth 登录邮箱初始化，
     * 但此后不再与 auth.User.email 同步。
     */
    email: varchar({ length: 320 }),
    /**
     * Canonical fallback profile fields for USER units.
     *
     * These language-neutral defaults serve account/profile flows, actor
     * snapshots, and search sync. If USER translations are enabled later,
     * UnitTranslation.title/summary/description may override them at read time
     * for localized presentation, while these columns remain the fallback
     * source.
     *
     * USER Unit 的规范兜底资料字段。
     *
     * 这些语言中立默认值服务账户/资料流程、行为者快照与搜索同步。若日后启用
     * USER 翻译，读取路径可用 UnitTranslation.title/summary/description
     * 覆盖本地化展示，而这些列继续作为兜底来源。
     */
    name: text(),
    avatar: text(),
    summary: text(),
    /**
     * Rich ContentDoc JSON. Search projections such as descriptionText are
     * Meilisearch-only and must not be added as PostgreSQL columns.
     * 富文本 ContentDoc JSON。诸如 descriptionText 之类的搜索投影仅存在于
     * Meilisearch，不得作为 PostgreSQL 列添加。
     */
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
