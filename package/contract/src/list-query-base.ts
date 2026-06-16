import { t } from "elysia";
import { appLanguageSchema, contentLanguageSchema } from "./language";

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
 *
 * list / 按 id 批量查询端点的共享基底。GET 与 POST 使用不同的传输方式，因此
 * `ids` 类型也不同 —— GET 查询串携带 CSV 字符串，POST 请求体携带原生 JSON 数组。
 * 接受 GET 的处理器自行拆分 CSV。
 *
 * 将 `...listGetQueryBase.properties` 展开进某个域的 GET list-query schema；当
 * 新增 POST 端点时，将 `...listPostBodyBase.properties` 展开进该域的 POST 请求体
 * schema。
 *
 * 传输方式指引：
 * - 当 `ids.length <= 30` 且其余过滤条件能放进 URL（约 2 KB）时，优先使用
 *   `GET /{resource}/list?ids=a,b,c`。
 * - 当 `ids.length > 30`、过滤条件含嵌套对象，或查询串会超过约 2 KB 时，优先使用
 *   带 JSON 请求体的 `POST /{resource}/list`。
 * - `ids` 通过取交集与其他过滤条件组合 —— 同时提供 `ids` 与 `status` 返回两者
 *   都匹配的项。
 * - `ids` 用于水合 / 按 id 批量查询，而非夹带过滤逻辑。请将过滤条件保留在各自的
 *   类型化字段中。
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
  languages: t.Optional(t.Array(contentLanguageSchema)),
  appLocale: t.Optional(appLanguageSchema),
  languageMode: t.Optional(listLanguageModeSchema),
});

export type ReadLanguageBodyBase = (typeof readLanguageBodyBase)["static"];

export const readLanguageGetQueryBase = t.Object({
  // `languages` is a fallback/preference candidate list. Keep the local app
  // language in `appLocale` so resolver priority stays contract-owned.
  // `languages` 是回退 / 偏好候选列表。将本地应用语言保留在 `appLocale` 中，
  // 以便解析优先级仍由 contract 掌控。
  languages: t.Optional(t.String()),
  appLocale: t.Optional(appLanguageSchema),
  languageMode: t.Optional(listLanguageModeSchema),
});

export type ReadLanguageGetQueryBase =
  (typeof readLanguageGetQueryBase)["static"];

/**
 * Parse the CSV `ids` querystring into a validated `string[]`.
 * Returns `undefined` when the field is absent or empty. Throws when the
 * parsed length exceeds {@link MAX_IDS} so the route surfaces a 400 rather
 * than quietly truncating.
 *
 * 将 CSV 形式的 `ids` 查询串解析为已校验的 `string[]`。
 * 当字段缺失或为空时返回 `undefined`。当解析出的长度超过 {@link MAX_IDS} 时抛出
 * 异常，使路由返回 400 而非静默截断。
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
