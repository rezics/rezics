import type {
  BookshelfViewConfig,
  ContentLanguage,
  ContentRating,
  LicenseSlug,
  NotificationPreference,
  NotificationPreferenceKey,
  UpdateUserSettings,
  UserSettings,
} from "@rezics/contract";
import {
  FALLBACK_LANGUAGE,
  isCatalogUnitType,
  LICENSE_SLUGS,
  NOTIFICATION_PREFERENCE_KEYS,
  normalizeContentLanguage,
  OPT_IN_RATINGS,
  PROFILE_FIELD_VISIBILITIES,
  USER_SUBSCRIPTION_LIST_SORTS,
  USER_TAG_PRIVACY_FIELD_KEY,
} from "@rezics/contract";
import { asc, eq, inArray } from "drizzle-orm";
import {
  User,
  UserContentRatingPreference,
  UserNotificationPreference,
  UserPreference,
  UserPreferredLanguage,
  UserPrivacyPreference,
  UserRealmTagDisplayPreference,
  UserRealmTagDisplayRealm,
  UserSubscriptionListPreference,
} from "../../db/schema";

type DbLike = Awaited<ReturnType<typeof getServerDb>>;
type TxLike = Parameters<Parameters<DbLike["transaction"]>[0]>[0];
type WritableDb = DbLike | TxLike;
type OptInRating = "R_18" | "R_18G";
type UserSubscriptionListSortValue =
  (typeof USER_SUBSCRIPTION_LIST_SORTS)[number];
type ProfileFieldVisibilityValue = (typeof PROFILE_FIELD_VISIBILITIES)[number];

type SettingsRows = {
  exists: boolean;
  core: typeof UserPreference.$inferSelect | null;
  preferredLanguages: (typeof UserPreferredLanguage.$inferSelect)[];
  contentRatings: (typeof UserContentRatingPreference.$inferSelect)[];
  subscriptionLists: (typeof UserSubscriptionListPreference.$inferSelect)[];
  notifications: (typeof UserNotificationPreference.$inferSelect)[];
  privacy: (typeof UserPrivacyPreference.$inferSelect)[];
  realmTagDisplays: Array<
    typeof UserRealmTagDisplayPreference.$inferSelect & {
      realms: (typeof UserRealmTagDisplayRealm.$inferSelect)[];
    }
  >;
};

async function getServerDb() {
  const { db } = await import("../../db/client");
  return db;
}

export function normalizePreferredLanguages(
  input: readonly (string | null | undefined)[] | null | undefined,
): ContentLanguage[] {
  const normalized = [
    ...new Set(
      (input ?? [])
        .map((language) =>
          typeof language === "string"
            ? normalizeContentLanguage(language)
            : null,
        )
        .filter((language): language is ContentLanguage => !!language),
    ),
  ];
  return normalized.length > 0 ? normalized : [FALLBACK_LANGUAGE];
}

function hasOwn<T extends object, K extends PropertyKey>(
  object: T,
  key: K,
): object is T & Record<K, unknown> {
  return Object.hasOwn(object, key);
}

function isOptInRating(value: string): value is OptInRating {
  return (OPT_IN_RATINGS as readonly string[]).includes(value);
}

function isLicenseSlug(value: string): value is LicenseSlug {
  return (LICENSE_SLUGS as readonly string[]).includes(value);
}

function isUserSubscriptionListSort(
  value: unknown,
): value is UserSubscriptionListSortValue {
  return (
    typeof value === "string" &&
    (USER_SUBSCRIPTION_LIST_SORTS as readonly string[]).includes(value)
  );
}

function isProfileFieldVisibility(
  value: unknown,
): value is ProfileFieldVisibilityValue {
  return (
    typeof value === "string" &&
    (PROFILE_FIELD_VISIBILITIES as readonly string[]).includes(value)
  );
}

function validateSettings(settings: UpdateUserSettings): void {
  if (settings.realmTagPreferences) {
    for (const [, pref] of Object.entries(settings.realmTagPreferences)) {
      if (pref.realmIds && pref.realmIds.length > 50) {
        throw new Error("realmIds array cannot exceed 50 entries per target");
      }
      if (pref.maxDisplay != null && pref.maxDisplay < 0) {
        throw new Error("maxDisplay cannot be negative");
      }
    }
  }

  const optedIn = settings.content?.optedInRatings;
  if (optedIn) {
    const invalid = optedIn.filter((rating) => !isOptInRating(rating));
    if (invalid.length > 0) {
      throw new Error(
        `content.optedInRatings contains invalid values: ${invalid.join(", ")}. Only R_18 and R_18G are opt-in tiers.`,
      );
    }
  }

  const defaultLicenseSlug = settings.publishing?.defaultLicenseSlug;
  if (defaultLicenseSlug != null && !isLicenseSlug(defaultLicenseSlug)) {
    throw new Error(
      `publishing.defaultLicenseSlug contains invalid value: ${defaultLicenseSlug}.`,
    );
  }
}

async function assertUserExists(db: WritableDb, userId: string): Promise<void> {
  const [user] = await db
    .select({ unitId: User.unitId })
    .from(User)
    .where(eq(User.unitId, userId))
    .limit(1);
  if (!user) throw new Error(`User not found: ${userId}`);
}

async function loadSettingsRows(
  db: WritableDb,
  userId: string,
): Promise<SettingsRows> {
  const [user] = await db
    .select({ unitId: User.unitId })
    .from(User)
    .where(eq(User.unitId, userId))
    .limit(1);

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const [
    coreRows,
    preferredLanguages,
    contentRatings,
    subscriptionLists,
    notifications,
    privacy,
    realmTagDisplays,
  ] = await Promise.all([
    db
      .select()
      .from(UserPreference)
      .where(eq(UserPreference.userId, userId))
      .limit(1),
    db
      .select()
      .from(UserPreferredLanguage)
      .where(eq(UserPreferredLanguage.userId, userId))
      .orderBy(asc(UserPreferredLanguage.position)),
    db
      .select()
      .from(UserContentRatingPreference)
      .where(eq(UserContentRatingPreference.userId, userId)),
    db
      .select()
      .from(UserSubscriptionListPreference)
      .where(eq(UserSubscriptionListPreference.userId, userId)),
    db
      .select()
      .from(UserNotificationPreference)
      .where(eq(UserNotificationPreference.userId, userId)),
    db
      .select()
      .from(UserPrivacyPreference)
      .where(eq(UserPrivacyPreference.userId, userId)),
    db
      .select()
      .from(UserRealmTagDisplayPreference)
      .where(eq(UserRealmTagDisplayPreference.userId, userId)),
  ]);

  const realmTagDisplayIds = realmTagDisplays.map((row) => row.id);
  const realmRows =
    realmTagDisplayIds.length > 0
      ? await db
          .select()
          .from(UserRealmTagDisplayRealm)
          .where(
            inArray(UserRealmTagDisplayRealm.preferenceId, realmTagDisplayIds),
          )
          .orderBy(asc(UserRealmTagDisplayRealm.position))
      : [];

  return {
    exists: true,
    core: coreRows[0] ?? null,
    preferredLanguages,
    contentRatings,
    subscriptionLists,
    notifications,
    privacy,
    realmTagDisplays: realmTagDisplays.map((display) => ({
      ...display,
      realms: realmRows.filter((row) => row.preferenceId === display.id),
    })),
  };
}

function materializeSettings(rows: SettingsRows): UserSettings {
  const settings: UserSettings = {
    preferredLanguages: normalizePreferredLanguages(
      rows.preferredLanguages.map((row) => row.language),
    ),
  };

  if (rows.contentRatings.length > 0) {
    const optedInRatings = rows.contentRatings
      .map((row) => row.rating)
      .filter(isOptInRating);
    if (optedInRatings.length > 0) {
      settings.content = { optedInRatings };
    }
  }

  const defaultLicenseSlug = rows.core?.defaultLicenseSlug;
  if (defaultLicenseSlug != null && isLicenseSlug(defaultLicenseSlug)) {
    settings.publishing = {
      defaultLicenseSlug,
    };
  }

  if (rows.core && rows.core.realmManageModeDefault !== null) {
    settings.moderation = {
      realmManageModeDefault: rows.core.realmManageModeDefault,
    };
  }

  if (rows.core?.bookshelfConfig) {
    settings.library = {
      bookshelf: rows.core.bookshelfConfig as BookshelfViewConfig,
    };
  }

  if (rows.subscriptionLists.length > 0) {
    settings.subscriptionLists = {};
    for (const row of rows.subscriptionLists) {
      if (!isUserSubscriptionListSort(row.defaultSort)) continue;
      settings.subscriptionLists[row.list as "zones" | "realms"] = {
        defaultSort: row.defaultSort,
      };
    }
  }

  if (rows.notifications.length > 0) {
    const notifications: NotificationPreference = {};
    for (const row of rows.notifications) {
      if (row.channel === "feed") {
        notifications[row.kind as NotificationPreferenceKey] = row.enabled;
      }
    }
    settings.notifications = notifications;
  }

  if (rows.privacy.length > 0) {
    const userTags = rows.privacy.find(
      (row) => row.field === USER_TAG_PRIVACY_FIELD_KEY,
    );
    if (userTags && isProfileFieldVisibility(userTags.visibility)) {
      settings.privacy = {
        [USER_TAG_PRIVACY_FIELD_KEY]: userTags.visibility,
      };
    }
  }

  if (rows.realmTagDisplays.length > 0) {
    settings.realmTagPreferences = {};
    for (const row of rows.realmTagDisplays) {
      if (!isCatalogUnitType(row.targetKey)) continue;
      settings.realmTagPreferences[row.targetKey] = {
        realmIds: row.realms.map((realm) => realm.realmId),
        maxDisplay: row.maxVisibleTags ?? undefined,
      };
    }
  }

  return settings;
}

async function upsertCore(
  db: WritableDb,
  userId: string,
  set: Partial<typeof UserPreference.$inferInsert>,
) {
  if (Object.keys(set).length === 0) return;
  const now = new Date();
  await db
    .insert(UserPreference)
    .values({ userId, ...set, updatedAt: now })
    .onConflictDoUpdate({
      target: UserPreference.userId,
      set: { ...set, updatedAt: now },
    });
}

async function replacePreferredLanguages(
  db: WritableDb,
  userId: string,
  preferredLanguages: readonly (string | null | undefined)[],
) {
  const normalized = normalizePreferredLanguages(preferredLanguages);
  const now = new Date();
  await db
    .delete(UserPreferredLanguage)
    .where(eq(UserPreferredLanguage.userId, userId));
  await db.insert(UserPreferredLanguage).values(
    normalized.map((language, position) => ({
      userId,
      language,
      position,
      updatedAt: now,
    })),
  );
}

async function replaceContentRatings(
  db: WritableDb,
  userId: string,
  ratings: readonly string[],
) {
  const uniqueRatings = [...new Set(ratings.filter(isOptInRating))];
  await db
    .delete(UserContentRatingPreference)
    .where(eq(UserContentRatingPreference.userId, userId));
  if (uniqueRatings.length === 0) return;
  await db.insert(UserContentRatingPreference).values(
    uniqueRatings.map((rating) => ({
      userId,
      rating,
    })),
  );
}

async function replaceRealmTagDisplays(
  db: WritableDb,
  userId: string,
  preferences: NonNullable<UpdateUserSettings["realmTagPreferences"]>,
) {
  // Realm tag display preferences are independent from subscriptions. Detail
  // pages may use subscriptions as discovery context, but settings can keep any
  // visible realm until the realm Unit itself is deleted.
  await db
    .delete(UserRealmTagDisplayPreference)
    .where(eq(UserRealmTagDisplayPreference.userId, userId));

  for (const [targetKey, preference] of Object.entries(preferences)) {
    const [created] = await db
      .insert(UserRealmTagDisplayPreference)
      .values({
        userId,
        targetKey,
        maxVisibleTags: preference.maxDisplay ?? null,
      })
      .returning({ id: UserRealmTagDisplayPreference.id });
    if (!created || !preference.realmIds?.length) continue;
    await db.insert(UserRealmTagDisplayRealm).values(
      [...new Set(preference.realmIds)].map((realmId, position) => ({
        preferenceId: created.id,
        realmId,
        position,
      })),
    );
  }
}

export async function getSettings(userId: string): Promise<UserSettings> {
  const db = await getServerDb();
  return materializeSettings(await loadSettingsRows(db, userId));
}

export async function updateSettings(
  userId: string,
  partial: UpdateUserSettings,
): Promise<UserSettings> {
  validateSettings(partial);
  const db = await getServerDb();

  await db.transaction(async (tx) => {
    await assertUserExists(tx, userId);

    const corePatch: Partial<typeof UserPreference.$inferInsert> = {};
    if (
      partial.publishing &&
      hasOwn(partial.publishing, "defaultLicenseSlug")
    ) {
      corePatch.defaultLicenseSlug =
        partial.publishing.defaultLicenseSlug ?? null;
    }
    if (
      partial.moderation &&
      hasOwn(partial.moderation, "realmManageModeDefault")
    ) {
      corePatch.realmManageModeDefault =
        partial.moderation.realmManageModeDefault ?? null;
    }
    if (partial.library && hasOwn(partial.library, "bookshelf")) {
      corePatch.bookshelfConfig = partial.library.bookshelf ?? null;
    }
    await upsertCore(tx, userId, corePatch);

    if (partial.preferredLanguages !== undefined) {
      await replacePreferredLanguages(tx, userId, partial.preferredLanguages);
    }

    if (partial.content?.optedInRatings !== undefined) {
      await replaceContentRatings(tx, userId, partial.content.optedInRatings);
    }

    if (partial.subscriptionLists) {
      for (const list of ["zones", "realms"] as const) {
        const value = partial.subscriptionLists[list]?.defaultSort;
        if (value === undefined) continue;
        if (!isUserSubscriptionListSort(value)) {
          throw new Error(
            `subscriptionLists.${list}.defaultSort contains invalid value: ${String(value)}.`,
          );
        }
        const now = new Date();
        await tx
          .insert(UserSubscriptionListPreference)
          .values({ userId, list, defaultSort: value, updatedAt: now })
          .onConflictDoUpdate({
            target: [
              UserSubscriptionListPreference.userId,
              UserSubscriptionListPreference.list,
            ],
            set: { defaultSort: value, updatedAt: now },
          });
      }
    }

    if (partial.notifications) {
      for (const key of NOTIFICATION_PREFERENCE_KEYS) {
        if (!hasOwn(partial.notifications, key)) continue;
        const enabled = partial.notifications[key];
        if (enabled === undefined) continue;
        const now = new Date();
        await tx
          .insert(UserNotificationPreference)
          .values({
            userId,
            kind: key,
            channel: "feed",
            enabled,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              UserNotificationPreference.userId,
              UserNotificationPreference.kind,
              UserNotificationPreference.channel,
            ],
            set: { enabled, updatedAt: now },
          });
      }
    }

    const userTagVisibility = partial.privacy?.[USER_TAG_PRIVACY_FIELD_KEY];
    if (userTagVisibility !== undefined) {
      if (!isProfileFieldVisibility(userTagVisibility)) {
        throw new Error(
          `privacy.${USER_TAG_PRIVACY_FIELD_KEY} contains invalid value: ${String(userTagVisibility)}.`,
        );
      }
      const now = new Date();
      await tx
        .insert(UserPrivacyPreference)
        .values({
          userId,
          field: USER_TAG_PRIVACY_FIELD_KEY,
          visibility: userTagVisibility,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [UserPrivacyPreference.userId, UserPrivacyPreference.field],
          set: { visibility: userTagVisibility, updatedAt: now },
        });
    }

    if (partial.realmTagPreferences !== undefined) {
      await replaceRealmTagDisplays(tx, userId, partial.realmTagPreferences);
    }
  });

  return getSettings(userId);
}

export async function getAllowedRatingsForUser(
  userId: string,
): Promise<ContentRating[]> {
  const db = await getServerDb();
  const rows = await db
    .select({ rating: UserContentRatingPreference.rating })
    .from(UserContentRatingPreference)
    .where(eq(UserContentRatingPreference.userId, userId));
  return rows.map((row) => row.rating as ContentRating);
}

export async function getNotificationPreferencesForUsers(
  userIds: readonly string[],
): Promise<Map<string, NotificationPreference | undefined>> {
  const db = await getServerDb();
  const map = new Map<string, NotificationPreference | undefined>();
  for (const userId of userIds) map.set(userId, undefined);
  if (userIds.length === 0) return map;

  const rows = await db
    .select({
      userId: UserNotificationPreference.userId,
      kind: UserNotificationPreference.kind,
      enabled: UserNotificationPreference.enabled,
    })
    .from(UserNotificationPreference)
    .where(inArray(UserNotificationPreference.userId, [...userIds]));

  for (const row of rows) {
    const current = map.get(row.userId) ?? {};
    current[row.kind as NotificationPreferenceKey] = row.enabled;
    map.set(row.userId, current);
  }
  return map;
}
