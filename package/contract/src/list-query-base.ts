import { t } from "elysia";

/**
 * Shared base for every `*ListQuerySchema` in the codebase.
 *
 * Spread `...listQueryBase.properties` into a domain list-query schema to pick
 * up the standard `ids` field for batch-by-id hydration.
 *
 * Transport guidance (see `openspec/specs/api-route-convention/spec.md`):
 * - Prefer `GET /{resource}/list?ids=a,b,c` when `ids.length <= 30` and the
 *   rest of the filter fits comfortably in a URL (~2 KB). The server splits
 *   the CSV string into a string[] before validation.
 * - Prefer `POST /{resource}/list` with a JSON body when `ids.length > 30`,
 *   when filters contain nested objects (cursor, sort), or when the
 *   querystring would exceed ~2 KB.
 * - `ids` composes with other filters via intersection — providing both
 *   `ids` and `status` returns items that match both.
 * - `ids` is for hydration / batch-by-id lookup, not a vehicle for smuggling
 *   filter logic. Keep filter conditions in their typed fields.
 */
export const listQueryBase = t.Object({
  ids: t.Optional(t.Array(t.String(), { maxItems: 200 })),
});

export type ListQueryBase = (typeof listQueryBase)["static"];
