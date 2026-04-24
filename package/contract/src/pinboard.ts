import { t } from "elysia";
import { languageSchema } from "./language";

// ============================================================
// PINBOARD KEY WHITELIST
// ============================================================

/**
 * Whitelist of valid pinboard keys. Each key corresponds to a named
 * ordered list stored on `Realm.extra.<key>PostIds`.
 *
 * - `"announcement"` — homepage announcements (default-realm only).
 * - `"pinned"` — realm-level pinned posts shown above the feed.
 *
 * Adding a new key requires extending this literal, updating
 * `realmExtraSchema`, and wiring a UI mount point.
 */
export const PINBOARD_KEYS = ["announcement", "pinned"] as const;

export type PinboardKey = (typeof PINBOARD_KEYS)[number];

export const pinboardKeySchema = t.Union([
  t.Literal("announcement"),
  t.Literal("pinned"),
]);

// ============================================================
// PATH PARAMS
// ============================================================

export const pinboardListPathParamsSchema = t.Object({
  realmUnitId: t.String(),
  pinboardKey: pinboardKeySchema,
});

export type PinboardListPathParams =
  (typeof pinboardListPathParamsSchema)["static"];

export const pinboardEntryPathParamsSchema = t.Object({
  realmUnitId: t.String(),
  pinboardKey: pinboardKeySchema,
  unitId: t.String(),
});

export type PinboardEntryPathParams =
  (typeof pinboardEntryPathParamsSchema)["static"];

// ============================================================
// LIST / DETAIL QUERY PARAMS
// ============================================================

export const pinboardListQuerySchema = t.Object({
  language: t.Optional(languageSchema),
  adminView: t.Optional(t.Boolean()),
});

export type PinboardListQuery = (typeof pinboardListQuerySchema)["static"];

export const pinboardDetailQuerySchema = t.Object({
  language: t.Optional(languageSchema),
});

export type PinboardDetailQuery = (typeof pinboardDetailQuerySchema)["static"];

// ============================================================
// LIST-LEVEL ENTRY DTO
// ============================================================

/**
 * List-level pinboard entry. Carries resolved title/summary for the
 * viewer's language but NOT the post body — the body is fetched via
 * the detail endpoint.
 */
export const pinboardEntryDTOSchema = t.Object({
  unitId: t.String(),
  pinboardKey: pinboardKeySchema,
  realmUnitId: t.String(),
  authorUserId: t.Nullable(t.String()),
  title: t.Optional(t.Nullable(t.String())),
  summary: t.Optional(t.Nullable(t.String())),
  language: t.String(),
  defaultLanguage: t.Nullable(t.String()),
  supportedLanguages: t.Array(t.String()),
  position: t.Number(),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type PinboardEntryDTO = (typeof pinboardEntryDTOSchema)["static"];

// ============================================================
// DETAIL-LEVEL ENTRY DTO
// ============================================================

export const pinboardEntryDetailDTOSchema = t.Object({
  unitId: t.String(),
  pinboardKey: pinboardKeySchema,
  realmUnitId: t.String(),
  authorUserId: t.Nullable(t.String()),
  title: t.Optional(t.Nullable(t.String())),
  subtitle: t.Optional(t.Nullable(t.String())),
  summary: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Nullable(t.String())),
  body: t.Optional(t.Nullable(t.String())),
  language: t.String(),
  defaultLanguage: t.Nullable(t.String()),
  supportedLanguages: t.Array(t.String()),
  resolvedUnitId: t.String(),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type PinboardEntryDetailDTO =
  (typeof pinboardEntryDetailDTOSchema)["static"];

// ============================================================
// TRANSLATION INPUT
// ============================================================

export const pinboardTranslationInputSchema = t.Object({
  language: languageSchema,
  title: t.Optional(t.String({ maxLength: 300 })),
  subtitle: t.Optional(t.String({ maxLength: 300 })),
  summary: t.Optional(t.String({ maxLength: 2000 })),
  description: t.Optional(t.String({ maxLength: 4000 })),
  body: t.Optional(t.String()),
});

export type PinboardTranslationInput =
  (typeof pinboardTranslationInputSchema)["static"];

// ============================================================
// CREATE
// ============================================================

export const createPinboardEntryBodySchema = t.Object({
  defaultLanguage: languageSchema,
  translations: t.Array(pinboardTranslationInputSchema, { minItems: 1 }),
});

export type CreatePinboardEntryBody =
  (typeof createPinboardEntryBodySchema)["static"];

// ============================================================
// UPDATE
// ============================================================

/**
 * Update supports three per-language operations:
 * - `upsert`: add or modify a translation.
 * - `remove`: soft-delete a sibling language (default language is protected).
 *
 * Use arrays keyed by language so a single PATCH can carry mixed ops.
 */
export const updatePinboardEntryBodySchema = t.Object({
  upsert: t.Optional(t.Array(pinboardTranslationInputSchema)),
  remove: t.Optional(t.Array(languageSchema)),
});

export type UpdatePinboardEntryBody =
  (typeof updatePinboardEntryBodySchema)["static"];

// ============================================================
// PIN / UNPIN / REORDER
// ============================================================

export const pinBodySchema = t.Object({
  position: t.Optional(t.Number({ minimum: 0 })),
});

export type PinBody = (typeof pinBodySchema)["static"];

export const reorderBodySchema = t.Object({
  orderedUnitIds: t.Array(t.String()),
});

export type ReorderBody = (typeof reorderBodySchema)["static"];

// ============================================================
// RESPONSES
// ============================================================

export const pinboardListResponseSchema = t.Object({
  entries: t.Array(pinboardEntryDTOSchema),
  staleIds: t.Optional(t.Array(t.String())),
});

export type PinboardListResponse =
  (typeof pinboardListResponseSchema)["static"];

export const pinboardDetailResponseSchema = pinboardEntryDetailDTOSchema;
export type PinboardDetailResponse =
  (typeof pinboardDetailResponseSchema)["static"];

export const pinboardEntryResponseSchema = pinboardEntryDTOSchema;
export type PinboardEntryResponse =
  (typeof pinboardEntryResponseSchema)["static"];

export const pinboardOkResponseSchema = t.Object({
  ok: t.Literal(true),
  unitId: t.Optional(t.String()),
  postIds: t.Optional(t.Array(t.String())),
});

export type PinboardOkResponse = (typeof pinboardOkResponseSchema)["static"];
