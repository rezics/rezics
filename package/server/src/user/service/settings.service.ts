import type { UserSettings } from "@rezics/contract";
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
}

export async function getSettings(userId: string): Promise<UserSettings> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { unitId: userId },
    select: { settings: true },
  });
  return (user.settings as UserSettings) ?? {};
}

export async function updateSettings(
  userId: string,
  partial: Partial<UserSettings>,
): Promise<UserSettings> {
  const current = await getSettings(userId);
  const merged = deepMerge(current, partial);
  validateSettings(merged);

  await prisma.user.update({
    where: { unitId: userId },
    data: { settings: merged },
  });

  return merged;
}
