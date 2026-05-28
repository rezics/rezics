import { AppError } from "@/utils/errors";

const FORBIDDEN_GAME_REQUIREMENT_EXTRA_KEYS = new Set([
  "rawtext",
  "requirements",
  "systemrequirement",
  "systemrequirements",
  "systemrequirementsrawtext",
  "systemrequirementrawtext",
  "systemrequirementstext",
  "systemrequirementtext",
  "rawsystemrequirements",
]);

function normalizeKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function findForbiddenGameRequirementExtraPath(
  value: unknown,
  path = "extra",
): string | null {
  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const [index, nested] of value.entries()) {
      const match = findForbiddenGameRequirementExtraPath(
        nested,
        `${path}.${index}`,
      );
      if (match) return match;
    }
    return null;
  }

  for (const [key, nested] of Object.entries(value)) {
    const nextPath = `${path}.${key}`;
    if (FORBIDDEN_GAME_REQUIREMENT_EXTRA_KEYS.has(normalizeKey(key))) {
      return nextPath;
    }
    const match = findForbiddenGameRequirementExtraPath(nested, nextPath);
    if (match) return match;
  }

  return null;
}

export function assertUnitTranslationExtraAllowed(extra: unknown): void {
  const offendingPath = findForbiddenGameRequirementExtraPath(extra);
  if (!offendingPath) return;

  throw new AppError(
    400,
    "Game system requirement raw text must be stored in GameSystemRequirement rows",
    {
      code: "unit_translation_extra_game_requirement_forbidden",
      details: { offendingPath },
    },
  );
}
