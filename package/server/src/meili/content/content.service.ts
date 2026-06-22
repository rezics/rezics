import {
  CATALOG_UNIT_TYPES,
  type ContentSearchOptions,
  type ContentSearchResult,
} from "@rezics/contract";
import { resolveSlugRefs } from "../../shared/slug-ref";
import { resolveContentHitDisplay } from "../search/read-language";
import { searchClient } from "../search-client";

function displayRank(item: any): number {
  if (item.catalogEntryKind === "MAIN") return 0;
  if (item.catalogEntryKind === "NONE" || item.catalogEntryKind == null) {
    return 1;
  }
  return 2;
}

function anyValueFilter(field: string, values: readonly string[]): string {
  const filters = values.map((value) => `${field} = "${value}"`);
  return filters.length === 1 ? filters[0]! : `(${filters.join(" OR ")})`;
}

function groupReleaseHits(items: any[]): any[] {
  const groups = new Map<string, any[]>();
  for (const item of items) {
    const groupId =
      item.catalogEntryKind === "VARIANT" && item.targetUnitId
        ? item.targetUnitId
        : item.id;
    groups.set(groupId, [...(groups.get(groupId) ?? []), item]);
  }

  return [...groups.values()].map((group) => {
    const sorted = [...group].sort((left, right) => {
      const rank = displayRank(left) - displayRank(right);
      if (rank !== 0) return rank;
      return String(left.id ?? "").localeCompare(String(right.id ?? ""));
    });
    const [visible, ...alternatives] = sorted;
    return {
      ...visible,
      collapsedAlternativeUnitIds: alternatives.map((item) => item.id),
      collapsedAlternatives: alternatives,
    };
  });
}

const EDITION_CATALOG_TYPES = new Set<string>(CATALOG_UNIT_TYPES);

function shouldDefaultToMainCatalogEntry(opts: ContentSearchOptions): boolean {
  if (opts.catalogEntryKind || opts.targetUnitId) return false;
  if (!opts.type) return false;
  const types = Array.isArray(opts.type) ? opts.type : [opts.type];
  return (
    types.length > 0 && types.every((type) => EDITION_CATALOG_TYPES.has(type))
  );
}

/**
 * Search the unified content index with typed options.
 * 使用类型化选项检索统一内容索引。
 */
export async function searchContent(
  opts: ContentSearchOptions,
): Promise<ContentSearchResult> {
  const q = opts.keyword ?? "";
  const filter: string[] = [];

  // Type filter
  // 类型过滤
  if (opts.type) {
    const types = Array.isArray(opts.type) ? opts.type : [opts.type];
    if (types.length === 1) {
      filter.push(`type = "${types[0]}"`);
    } else if (types.length > 1) {
      filter.push(`type IN [${types.map((t) => `"${t}"`).join(", ")}]`);
    }
  }

  if (opts.userId) {
    filter.push(`userId = "${opts.userId}"`);
  }

  // Post kind filter (only meaningful when type includes POST)
  // 帖子种类过滤（仅当 type 包含 POST 时有意义）
  if (opts.postKind?.length) {
    if (opts.postKind.length === 1) {
      filter.push(`postKind = "${opts.postKind[0]}"`);
    } else {
      filter.push(
        `postKind IN [${opts.postKind.map((k) => `"${k}"`).join(", ")}]`,
      );
    }
  }

  // Text length range (books with textLength field on the content index)
  // 文本长度区间（内容索引上带 textLength 字段的书籍）
  if (opts.textLength) {
    if (typeof opts.textLength.min === "number") {
      filter.push(`textLength >= ${opts.textLength.min}`);
    }
    if (typeof opts.textLength.max === "number") {
      filter.push(`textLength <= ${opts.textLength.max}`);
    }
  }

  // Global tag filter — tags (SlugRef[]) takes precedence over tagIds.
  // Work-inherited tag projection is intentionally not part of content search.
  // 全局标签过滤——tags (SlugRef[]) 优先于 tagIds。
  // 作品继承的标签投影有意不纳入内容检索。
  if (opts.tags?.length) {
    const resolvedTagIds = await resolveSlugRefs(opts.tags);
    for (const tagId of resolvedTagIds) {
      filter.push(`tagIds = "${tagId}"`);
    }
  } else if (opts.tagIds?.length) {
    for (const tagId of opts.tagIds) {
      filter.push(`tagIds = "${tagId}"`);
    }
  }

  if (opts.catalogEntryKind) {
    filter.push(`catalogEntryKind = "${opts.catalogEntryKind}"`);
  } else if (shouldDefaultToMainCatalogEntry(opts)) {
    filter.push('catalogEntryKind = "MAIN"');
  }
  if (opts.targetUnitId) {
    filter.push(`targetUnitId = "${opts.targetUnitId}"`);
  }

  if (opts.platformEntityIds?.length) {
    for (const platformEntityId of opts.platformEntityIds) {
      filter.push(`platformEntityIds = "${platformEntityId}"`);
    }
  }
  if (opts.subjectEntityIds?.length) {
    filter.push(anyValueFilter("subjectEntityIds", opts.subjectEntityIds));
  }
  if (opts.subjectKinds?.length) {
    filter.push(anyValueFilter("subjectKinds", opts.subjectKinds));
  }
  if (opts.subjectRoles?.length) {
    filter.push(anyValueFilter("subjectRoles", opts.subjectRoles));
  }

  // Realm filter
  // realm 过滤
  if (opts.realmId) {
    filter.push(`realmIds = "${opts.realmId}"`);
  }

  // Realm-scoped tag filter (build compound keys)
  // realm 范围内的标签过滤（构造复合键）
  if (opts.realmId && opts.realmTagIds?.length) {
    const realmTagFilters = opts.realmTagIds.map(
      (tagId) => `realmTagKeys = "${opts.realmId}:${tagId}"`,
    );
    if (realmTagFilters.length === 1) {
      filter.push(realmTagFilters[0]!);
    } else {
      filter.push(`(${realmTagFilters.join(" OR ")})`);
    }
  }

  // Rating filter — set-based (ratings: ContentRating[]). When the caller
  // passes an empty array or omits the field, no rating constraint is applied
  // here; upstream callers are expected to have already intersected the
  // request with the session's allowed rating set.
  // 分级过滤——基于集合（ratings: ContentRating[]）。当调用方传入空数组或省略
  // 该字段时，此处不施加分级约束；上游调用方应已将请求与会话允许的分级集合
  // 取交集。
  if (opts.ratings?.length) {
    const ratingList = opts.ratings.map((r) => `"${r}"`).join(", ");
    filter.push(`rating IN [${ratingList}]`);
  }

  if (opts.aiDisclosureModes?.length) {
    const disclosureList = opts.aiDisclosureModes
      .map((mode) => `"${mode}"`)
      .join(", ");
    filter.push(`aiDisclosureMode IN [${disclosureList}]`);
  }

  // Licensed filter
  // 授权状态过滤
  if (opts.isLicensed === true) {
    filter.push("isLicensed = true");
  } else if (opts.isLicensed === false) {
    filter.push("isLicensed = false");
  }

  // Visibility: always public for content search
  // 可见性：内容检索始终限定为公开
  filter.push('visibility = "PUBLIC"');

  // Sort
  // 排序
  const sort: string[] = [];
  if (opts.sort?.field && opts.sort.field !== "relevance") {
    const order = opts.sort.order ?? "desc";
    sort.push(`${opts.sort.field}:${order}`);
  }

  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  const grouped = opts.releasePresentation === "grouped";

  const resp = await searchClient.contentIndex.search(q, {
    offset,
    limit: grouped ? limit * 3 : limit,
    filter: filter.length > 0 ? filter : undefined,
    sort: sort.length > 0 ? sort : undefined,
  });
  const hits = (resp.hits as any[]).map((hit) =>
    resolveContentHitDisplay(hit, opts),
  );
  const items = grouped ? groupReleaseHits(hits).slice(0, limit) : hits;

  return {
    items,
    total: grouped ? items.length : (resp.estimatedTotalHits ?? items.length),
    processingTimeMs: resp.processingTimeMs,
    query: resp.query ?? q,
  };
}
