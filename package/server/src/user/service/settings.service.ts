import type { Language, UserSettings } from "@rezics/contract";
import {
  FALLBACK_LANGUAGE,
  LICENSE_SLUGS,
  normalizeLanguage,
  OPT_IN_RATINGS,
} from "@rezics/contract";
import { prisma } from "#/prisma/client";

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
): Language[] {
  const normalized = [
    ...new Set(
      (input ?? [])
        .map((language) =>
          typeof language === "string" ? normalizeLanguage(language) : null,
        )
        .filter((language): language is Language => !!language),
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

export async function getSettings(userId: string): Promise<UserSettings> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { unitId: userId },
    select: { settings: true },
  });
  return normalizeSettings((user.settings as UserSettings | null) ?? {});
}

export async function updateSettings(
  userId: string,
  partial: Partial<UserSettings>,
): Promise<UserSettings> {
  const current = await getSettings(userId);
  const merged = normalizeSettings(deepMerge(current, partial));
  validateSettings(merged);

  await prisma.user.update({
    where: { unitId: userId },
    data: { settings: merged },
  });

  return merged;
}
