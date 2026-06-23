import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, jsonData, updatedAt, uuidv7PrimaryKey } from "./columns.ts";
import { User } from "./identity.ts";
import { Unit } from "./unit.ts";

// Inlined from @rezics/contract
// 从 @rezics/contract 内联
const USER_SUBSCRIPTION_LIST_SORTS = [
  "manualAsc",
  "manualDesc",
  "addedDesc",
  "addedAsc",
] as const;

const PROFILE_FIELD_VISIBILITIES = [
  "private",
  "followers",
  "public",
] as const;

const NOTIFICATION_PREFERENCE_KEYS = [
  "reply",
  "follow",
  "dm",
  "moderation",
  "realm",
  "system",
] as const;

function pgEnumValues<T extends string>(
  values: readonly [T, ...T[]],
): [T, ...T[]] {
  const [first, ...rest] = values;
  return [first, ...rest];
}

export const UserSubscriptionListPreferenceKind = pgEnum(
  "UserSubscriptionListPreferenceKind",
  ["zones", "realms"],
);

export const UserSubscriptionListSortPreference = pgEnum(
  "UserSubscriptionListSortPreference",
  pgEnumValues(USER_SUBSCRIPTION_LIST_SORTS),
);

export const UserNotificationPreferenceKind = pgEnum(
  "UserNotificationPreferenceKind",
  pgEnumValues(NOTIFICATION_PREFERENCE_KEYS),
);

export const UserNotificationPreferenceChannel = pgEnum(
  "UserNotificationPreferenceChannel",
  ["feed", "email", "push"],
);

export const UserPrivacyPreferenceField = pgEnum("UserPrivacyPreferenceField", [
  "userTags",
]);

export const UserProfileFieldVisibility = pgEnum(
  "UserProfileFieldVisibility",
  pgEnumValues(PROFILE_FIELD_VISIBILITIES),
);

/**
 * One-to-one, typed user preference root.
 * 一对一的、类型化的用户偏好根。
 */
export const UserPreference = pgTable("UserPreference", {
  userId: uuid()
    .primaryKey()
    .references(() => User.unitId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  defaultLicenseSlug: text(),
  realmManageModeDefault: boolean(),
  bookshelfConfig: jsonData(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const UserContentRatingPreference = pgTable(
  "UserContentRatingPreference",
  {
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    rating: varchar({ length: 32 }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.rating],
      name: "UserContentRatingPreference_userId_rating_pk",
    }),
  ],
);

export const UserPreferredLanguage = pgTable(
  "UserPreferredLanguage",
  {
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    language: varchar({ length: 16 }).notNull(),
    position: integer().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.language],
      name: "UserPreferredLanguage_userId_language_pk",
    }),
    index("UserPreferredLanguage_userId_position_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.position.asc().nullsLast(),
    ),
  ],
);

export const UserSubscriptionListPreference = pgTable(
  "UserSubscriptionListPreference",
  {
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    list: UserSubscriptionListPreferenceKind().notNull(),
    defaultSort: UserSubscriptionListSortPreference().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.list],
      name: "UserSubscriptionListPreference_userId_list_pk",
    }),
  ],
);

export const UserNotificationPreference = pgTable(
  "UserNotificationPreference",
  {
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    kind: UserNotificationPreferenceKind().notNull(),
    channel: UserNotificationPreferenceChannel().default("feed").notNull(),
    enabled: boolean().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.kind, table.channel],
      name: "UserNotificationPreference_user_kind_channel_pk",
    }),
    index("UserNotificationPreference_kind_enabled_idx").using(
      "btree",
      table.kind.asc().nullsLast(),
      table.enabled.asc().nullsLast(),
    ),
  ],
);

export const UserPrivacyPreference = pgTable(
  "UserPrivacyPreference",
  {
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    field: UserPrivacyPreferenceField().notNull(),
    visibility: UserProfileFieldVisibility().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.field],
      name: "UserPrivacyPreference_userId_field_pk",
    }),
  ],
);

export const UserRealmTagDisplayPreference = pgTable(
  "UserRealmTagDisplayPreference",
  {
    id: uuidv7PrimaryKey(),
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    targetKey: varchar({ length: 64 }).notNull(),
    maxVisibleTags: integer(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("UserRealmTagDisplayPreference_user_target_key").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.targetKey.asc().nullsLast(),
    ),
  ],
);

export const UserRealmTagDisplayRealm = pgTable(
  "UserRealmTagDisplayRealm",
  {
    preferenceId: uuid()
      .notNull()
      .references(() => UserRealmTagDisplayPreference.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    realmId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    position: integer().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.preferenceId, table.realmId],
      name: "UserRealmTagDisplayRealm_preferenceId_realmId_pk",
    }),
    index("UserRealmTagDisplayRealm_preference_position_idx").using(
      "btree",
      table.preferenceId.asc().nullsLast(),
      table.position.asc().nullsLast(),
    ),
  ],
);

/**
 * User-to-user block. Directional: blockerId blocked blockedId.
 * 用户间屏蔽。有方向性：blockerId 屏蔽了 blockedId。
 */
export const UserBlock = pgTable(
  "UserBlock",
  {
    id: uuidv7PrimaryKey(),
    blockerId: uuid().notNull(),
    blockedId: uuid().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("UserBlock_blockedId_idx").using(
      "btree",
      table.blockedId.asc().nullsLast(),
    ),
    uniqueIndex("UserBlock_blockerId_blockedId_key").using(
      "btree",
      table.blockerId.asc().nullsLast(),
      table.blockedId.asc().nullsLast(),
    ),
    index("UserBlock_blockerId_idx").using(
      "btree",
      table.blockerId.asc().nullsLast(),
    ),
  ],
);
