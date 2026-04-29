import { t } from "elysia";

// ============================================================
// REALM EXTRA — typed shape of `Realm.extra`
// ============================================================

/**
 * Typed shape of `Realm.extra`. Two well-known keys carry curated ordered Unit
 * ID lists for realm-level surfaces:
 *
 * - `pinboard` — an ordered list of Unit IDs pinned within the realm. Surfaced
 *   on the realm page above the feed; entries are usually POST Releases of
 *   Work entries authored by the realm's contributors.
 * - `announcement` — an ordered list of Unit IDs reserved for special pages
 *   like the homepage announcement bar. **Not for general forum
 *   notifications** — use the realm's normal posting flow for those.
 *
 * Additional unspecified keys may coexist on `Realm.extra` (the trust
 * strategy applies — clients may store arbitrary JSON-serializable values
 * under any other key without contract enforcement).
 */
export const realmExtraSchema = t.Object(
  {
    /**
     * Ordered list of Unit IDs pinned within the realm. Surfaced on the realm
     * page above the feed; entries are usually POST Releases of Work entries
     * authored by the realm's contributors.
     */
    pinboard: t.Optional(t.Array(t.String())),

    /**
     * Ordered list of Unit IDs reserved for special pages like the homepage
     * announcement bar. Not for general forum notifications; reserved for
     * special pages like the homepage announcement bar.
     */
    announcement: t.Optional(t.Array(t.String())),
  },
  { additionalProperties: true },
);

export type RealmExtra = (typeof realmExtraSchema)["static"];

/**
 * Whitelist of well-known Realm.extra list keys recognised by the typed
 * primitives. Other keys are accepted at runtime but are not type-checked
 * via `RealmExtra`.
 */
export const REALM_EXTRA_LIST_KEYS = ["pinboard", "announcement"] as const;

export type RealmExtraListKey = (typeof REALM_EXTRA_LIST_KEYS)[number];

export const realmExtraListKeySchema = t.Union([
  t.Literal("pinboard"),
  t.Literal("announcement"),
]);

// ============================================================
// PATH PARAMS
// ============================================================

export const realmExtraListPathParamsSchema = t.Object({
  realmId: t.String(),
  key: t.String(),
});

export type RealmExtraListPathParams =
  (typeof realmExtraListPathParamsSchema)["static"];

export const realmExtraEntryPathParamsSchema = t.Object({
  realmId: t.String(),
  key: t.String(),
  unitId: t.String(),
});

export type RealmExtraEntryPathParams =
  (typeof realmExtraEntryPathParamsSchema)["static"];

// ============================================================
// REQUEST BODIES
// ============================================================

export const realmExtraAppendBodySchema = t.Object({
  unitId: t.String(),
});

export type RealmExtraAppendBody =
  (typeof realmExtraAppendBodySchema)["static"];

export const realmExtraReorderBodySchema = t.Object({
  unitIds: t.Array(t.String()),
});

export type RealmExtraReorderBody =
  (typeof realmExtraReorderBodySchema)["static"];

// ============================================================
// READ RESPONSES
// ============================================================

/**
 * Public read shape: stale IDs are filtered out before the array is returned.
 * `unitIds` reflects only currently-visible Units.
 */
export const realmExtraReadResponseSchema = t.Object({
  realmId: t.String(),
  key: t.String(),
  unitIds: t.Array(t.String()),
});

export type RealmExtraReadResponse =
  (typeof realmExtraReadResponseSchema)["static"];

/**
 * Admin read shape: returns the full stored array plus a parallel `staleIds`
 * list flagging entries the caller's view would otherwise drop. Surfaces
 * deleted/missing units so moderators can clean up entries.
 */
export const realmExtraAdminReadResponseSchema = t.Object({
  realmId: t.String(),
  key: t.String(),
  unitIds: t.Array(t.String()),
  staleIds: t.Array(t.String()),
});

export type RealmExtraAdminReadResponse =
  (typeof realmExtraAdminReadResponseSchema)["static"];

export const realmExtraOkResponseSchema = t.Object({
  ok: t.Literal(true),
  unitIds: t.Optional(t.Array(t.String())),
});

export type RealmExtraOkResponse =
  (typeof realmExtraOkResponseSchema)["static"];
