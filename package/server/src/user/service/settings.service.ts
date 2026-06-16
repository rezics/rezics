import type { ContentLanguage, UserSettings } from "@rezics/contract";
import {
  FALLBACK_LANGUAGE,
  LICENSE_SLUGS,
  normalizeContentLanguage,
  OPT_IN_RATINGS,
} from "@rezics/contract";
import { eq } from "drizzle-orm";
import { User } from "../../db/schema";

export interface UserSettingsRepository {
  getSettings(userId: string): Promise<unknown>;
  updateSettings(userId: string, settings: UserSettings): Promise<void>;
}

async function getServerDb() {
  const { db } = await import("../../db/client");
  return db;
}

function createDrizzleUserSettingsRepository(): UserSettingsRepository {
  return {
    async getSettings(userId) {
      const db = await getServerDb();
      const [user] = await db
        .select({ settings: User.settings })
        .from(User)
        .where(eq(User.unitId, userId))
        .limit(1);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }
      return user.settings;
    },

    async updateSettings(userId, settings) {
      const db = await getServerDb();
      await db
        .update(User)
        .set({ settings, updatedAt: new Date() })
        .where(eq(User.unitId, userId));
    },
  };
}

const defaultRepository = createDrizzleUserSettingsRepository();

function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
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

function normalizeSettings(settings: UserSettings): UserSettings {
  return {
    ...settings,
    preferredLanguages: normalizePreferredLanguages(
      settings.preferredLanguages,
    ),
  };
}

function validateSettings(settings: UserSettings): void {
  if (settings.realmTagPreferences) {
    for (const [, pref] of Object.entries(settings.realmTagPreferences)) {
      if (pref.realmIds && pref.realmIds.length > 50) {
        throw new Error(
          "realmIds array cannot exceed 50 entries per unit type",
        );
      }
    }
  }
  const optedIn = settings.content?.optedInRatings;
  if (optedIn) {
    const invalid = optedIn.filter((r) => !OPT_IN_RATINGS.includes(r as any));
    if (invalid.length > 0) {
      throw new Error(
        `content.optedInRatings contains invalid values: ${invalid.join(", ")}. Only R_18 and R_18G are opt-in tiers.`,
      );
    }
  }
  const defaultLicenseSlug = settings.publishing?.defaultLicenseSlug;
  if (
    defaultLicenseSlug != null &&
    !(LICENSE_SLUGS as readonly string[]).includes(defaultLicenseSlug)
  ) {
    throw new Error(
      `publishing.defaultLicenseSlug contains invalid value: ${defaultLicenseSlug}.`,
    );
  }
}

export async function getSettings(
  userId: string,
  repository: UserSettingsRepository = defaultRepository,
): Promise<UserSettings> {
  const settings = await repository.getSettings(userId);
  return normalizeSettings((settings as UserSettings | null) ?? {});
}

export async function updateSettings(
  userId: string,
  partial: Partial<UserSettings>,
  repository: UserSettingsRepository = defaultRepository,
): Promise<UserSettings> {
  const current = await getSettings(userId, repository);
  const merged = normalizeSettings(deepMerge(current, partial));
  validateSettings(merged);

  await repository.updateSettings(userId, merged);

  return merged;
}
