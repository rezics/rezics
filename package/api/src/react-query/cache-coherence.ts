import type { UnitTranslationDTO } from "@rezics/contract";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

// ============================================================
// MUTATION → QUERY NAMESPACE COHERENCE MAP
// ============================================================
//
// A single source of truth declaring which query-key namespaces each
// mutation domain must invalidate so detail, profile, progress, search,
// realm-feed, and the per-book node-completion list stay consistent after
// a write. Mutations route their `onSuccess` invalidation through
// `invalidateForCacheDomain` instead of hand-listing keys, so adding a new
// cross-cutting surface only requires editing this map.
//
// 单一事实来源，声明每个 mutation 域必须失效哪些 query-key 命名空间，
// 以便写入后 detail、profile、progress、search、realm-feed 以及按书的
// node-completion 列表保持一致。Mutations 通过 `invalidateForCacheDomain`
// 路由其 `onSuccess` 失效，而非手工列举各 key，因此新增一个横切面只需
// 编辑此 map。

/**
 * Root query-key prefix per logical surface. Invalidation is by prefix.
 * 每个逻辑面的 query-key 根前缀。失效按前缀进行。
 */
export const CACHE_NAMESPACE_ROOTS = {
  detail: ["books"],
  profile: ["users"],
  search: ["search"],
  realmFeed: ["realms"],
  realmMembership: ["realms"],
  bookNodeCompletionList: ["progress", "nodeCompletion"],
  progress: ["progress"],
  shelves: ["shelves"],
  collection: ["collection"],
  reactions: ["reactions"],
  subscription: ["subscription"],
  notifications: ["notifications"],
  dm: ["dm"],
  drafts: ["drafts"],
} as const satisfies Record<string, readonly (string | number)[]>;

export type CacheNamespace = keyof typeof CACHE_NAMESPACE_ROOTS;

/**
 * A mutation surface that triggers cross-cutting cache invalidation.
 * 触发横切缓存失效的 mutation 面。
 */
export type CacheMutationDomain =
  | "collect"
  | "follow"
  | "reaction"
  | "progress"
  | "node-completion"
  | "draft"
  | "dm"
  | "realm-membership"
  | "report";

/**
 * Each mutation domain maps to the set of query-key namespaces it must
 * invalidate. `progress` invalidates the same surfaces as `node-completion`
 * minus the per-book node-completion list (a `UserUnitProgress` write does
 * not change per-node rows).
 * 每个 mutation 域映射到它必须失效的一组 query-key 命名空间。`progress`
 * 失效的面与 `node-completion` 相同，但不含按书的 node-completion 列表
 *（`UserUnitProgress` 写入不会改变按节点的行）。
 */
export const CACHE_COHERENCE_MAP = {
  collect: ["detail", "profile", "search", "shelves", "collection"],
  follow: ["detail", "profile", "subscription"],
  reaction: ["detail", "profile", "realmFeed", "search"],
  progress: ["detail", "profile", "progress"],
  "node-completion": [
    "detail",
    "profile",
    "progress",
    "bookNodeCompletionList",
  ],
  draft: ["drafts"],
  dm: ["dm"],
  "realm-membership": ["profile", "realmFeed", "realmMembership"],
  report: ["notifications"],
} as const satisfies Record<CacheMutationDomain, readonly CacheNamespace[]>;

/**
 * Invalidate every query namespace declared for `domain`. Call from a
 * mutation's `onSuccess`. Over-invalidation by prefix is intentional: it
 * keeps the declared surfaces fresh without per-key bookkeeping.
 * 失效 `domain` 声明的每个 query 命名空间。从 mutation 的 `onSuccess`
 * 调用。按前缀的过度失效是有意为之：它在无需逐 key 记账的情况下保持
 * 已声明的面新鲜。
 */
export function invalidateForCacheDomain(
  queryClient: QueryClient,
  domain: CacheMutationDomain,
): Promise<void> {
  const namespaces = CACHE_COHERENCE_MAP[domain];
  return Promise.all(
    namespaces.map((ns) =>
      queryClient.invalidateQueries({ queryKey: CACHE_NAMESPACE_ROOTS[ns] }),
    ),
  ).then(() => undefined);
}

export type TranslationPatch = Pick<UnitTranslationDTO, "language"> &
  Partial<UnitTranslationDTO>;

export interface DetailWithTranslations {
  translations?: UnitTranslationDTO[];
}

export function upsertCachedTranslation<T extends DetailWithTranslations>(
  detail: T | undefined,
  translation: TranslationPatch,
): T | undefined {
  if (!detail) return detail;

  const translations = detail.translations ?? [];
  const index = translations.findIndex(
    (item) => item.language === translation.language,
  );

  if (index === -1) {
    return {
      ...detail,
      translations: [...translations, translation as UnitTranslationDTO],
    };
  }

  const nextTranslations = [...translations];
  nextTranslations[index] = {
    ...nextTranslations[index],
    ...translation,
  };

  return {
    ...detail,
    translations: nextTranslations,
  };
}

export function removeCachedTranslation<T extends DetailWithTranslations>(
  detail: T | undefined,
  language: string,
): T | undefined {
  if (!detail?.translations) return detail;

  const translations = detail.translations.filter(
    (item) => item.language !== language,
  );

  if (translations.length === detail.translations.length) return detail;

  return {
    ...detail,
    translations,
  };
}

export function preserveCachedTranslations<T extends DetailWithTranslations>(
  incoming: T,
  cached: T | undefined,
): T {
  if (!cached?.translations) return incoming;

  return {
    ...incoming,
    translations: cached.translations,
  };
}

export async function cancelAndPatchExactDetailQueries<TData>({
  queryClient,
  detailKeys,
  patch,
}: {
  queryClient: QueryClient;
  detailKeys: readonly QueryKey[];
  patch: (current: TData | undefined) => TData | undefined;
}) {
  for (const queryKey of detailKeys) {
    await queryClient.cancelQueries({ queryKey, exact: true });
    queryClient.setQueryData<TData>(queryKey, patch);
  }
}

export async function patchTranslationDetailQueries({
  queryClient,
  detailKeys,
  translation,
}: {
  queryClient: QueryClient;
  detailKeys: readonly QueryKey[];
  translation: TranslationPatch;
}) {
  await cancelAndPatchExactDetailQueries<DetailWithTranslations>({
    queryClient,
    detailKeys,
    patch: (current) => upsertCachedTranslation(current, translation),
  });
}

export async function removeTranslationFromDetailQueries({
  queryClient,
  detailKeys,
  language,
}: {
  queryClient: QueryClient;
  detailKeys: readonly QueryKey[];
  language: string;
}) {
  await cancelAndPatchExactDetailQueries<DetailWithTranslations>({
    queryClient,
    detailKeys,
    patch: (current) => removeCachedTranslation(current, language),
  });
}
