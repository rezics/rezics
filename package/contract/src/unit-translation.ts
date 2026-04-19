import { t } from "elysia";

// ============================================================
// UNIT TRANSLATION EXTRA SCHEMA
// ============================================================
// Typed shape of UnitTranslation.extra. Carries language-correlated
// presentation-layer metadata. Server mappers / API client / frontend
// readers SHOULD access these fields via this schema rather than reading
// `extra` as an untyped JSON blob.
//
// Forward-compatible: unrecognized keys in `extra` are tolerated by the
// caller — only fields codified here are surfaced as flat DTO fields.

export const unitTranslationExtraSchema = t.Object({
  coverUrl: t.Optional(t.String({ format: "uri" })),
});

export type UnitTranslationExtra =
  (typeof unitTranslationExtraSchema)["static"];

/**
 * Read a typed `coverUrl` from a possibly-untyped `extra` JSON value.
 * Returns `undefined` when the value is missing or the wrong shape.
 */
export function readCoverUrlFromExtra(
  extra: unknown,
): string | undefined {
  if (!extra || typeof extra !== "object") return undefined;
  const value = (extra as Record<string, unknown>).coverUrl;
  return typeof value === "string" ? value : undefined;
}

/**
 * Merge a `coverUrl` into an existing `extra` JSON value, returning a new
 * object. Setting `undefined` removes the key.
 */
export function withCoverUrl(
  extra: unknown,
  coverUrl: string | undefined,
): Record<string, unknown> {
  const base =
    extra && typeof extra === "object"
      ? { ...(extra as Record<string, unknown>) }
      : {};
  if (coverUrl === undefined) {
    delete base.coverUrl;
  } else {
    base.coverUrl = coverUrl;
  }
  return base;
}
