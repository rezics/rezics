import { t } from "elysia";
import { languageSchema } from "./language";

/**
 * Shared bases for list / batch-by-id endpoints. GET and POST use different
 * transports and therefore different `ids` types — the GET querystring carries
 * a CSV string, the POST body carries a native JSON array. Handlers that
 * accept GET split the CSV themselves.
 *
 * Spread `...listGetQueryBase.properties` into a domain's GET list-query
 * schema; spread `...listPostBodyBase.properties` into a domain's POST body
 * schema when that endpoint is added.
 *
 * Transport guidance:
 * - Prefer `GET /{resource}/list?ids=a,b,c` when `ids.length <= 30` and the
 *   rest of the filter fits in a URL (~2 KB).
 * - Prefer `POST /{resource}/list` with a JSON body when `ids.length > 30`,
 *   filters contain nested objects, or the querystring would exceed ~2 KB.
 * - `ids` composes with other filters via intersection — providing both
 *   `ids` and `status` returns items that match both.
 * - `ids` is for hydration / batch-by-id lookup, not for smuggling filter
 *   logic. Keep filter conditions in their typed fields.
 */

const MAX_IDS = 200;

export const listGetQueryBase = t.Object({
  ids: t.Optional(t.String({ description: "CSV of ids, up to 200 entries" })),
});

export const listPostBodyBase = t.Object({
  ids: t.Optional(t.Array(t.String(), { maxItems: MAX_IDS })),
});

export type ListGetQueryBase = (typeof listGetQueryBase)["static"];
export type ListPostBodyBase = (typeof listPostBodyBase)["static"];

export const listLanguageModeSchema = t.Union([
  t.Literal("preferred"),
  t.Literal("all"),
]);

export type ListLanguageMode = (typeof listLanguageModeSchema)["static"];

export const readLanguageBodyBase = t.Object({
  languages: t.Optional(t.Array(languageSchema)),
  appLocale: t.Optional(languageSchema),
  languageMode: t.Optional(listLanguageModeSchema),
});

export type ReadLanguageBodyBase = (typeof readLanguageBodyBase)["static"];

/**
 * Parse the CSV `ids` querystring into a validated `string[]`.
 * Returns `undefined` when the field is absent or empty. Throws when the
 * parsed length exceeds {@link MAX_IDS} so the route surfaces a 400 rather
 * than quietly truncating.
 */
export function parseIdsCsv(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length === 0) return undefined;
  if (parts.length > MAX_IDS) {
    throw new Error(`ids exceeds maximum of ${MAX_IDS} entries`);
  }
  return parts;
}
