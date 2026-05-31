import type {
  ContentSearchOptions,
  ContentSearchResult,
} from "@rezics/contract";
import { resolveSlugRefs } from "../../shared/slug-ref";
import { searchClient } from "../search-client";

function displayRank(item: any): number {
  if (item.displayPolicy === "PRIMARY") return 0;
  if (item.displayPolicy === "SECONDARY") return 1;
  return 2;
}

function anyValueFilter(field: string, values: readonly string[]): string {
  const filters = values.map((value) => `${field} = "${value}"`);
  return filters.length === 1 ? filters[0]! : `(${filters.join(" OR ")})`;
}

function groupReleaseHits(items: any[]): any[] {
  const groups = new Map<string, any[]>();
  for (const item of items) {
    const groupId = item.searchGroupId ?? item.id;
    groups.set(groupId, [...(groups.get(groupId) ?? []), item]);
  }

  return [...groups.values()].map((group) => {
    const sorted = [...group].sort((left, right) => {
      const rank = displayRank(left) - displayRank(right);
      if (rank !== 0) return rank;
      return String(left.position ?? "").localeCompare(
        String(right.position ?? ""),
      );
    });
    const [visible, ...alternatives] = sorted;
    return {
      ...visible,
      collapsedAlternativeUnitIds: alternatives.map((item) => item.id),
      collapsedAlternatives: alternatives,
    };
  });
}

const EDITION_CATALOG_TYPES = new Set(["BOOK", "GAME", "MEDIA"]);

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
 */
export async function searchContent(
  opts: ContentSearchOptions,
): Promise<ContentSearchResult> {
  const q = opts.keyword ?? "";
  const filter: string[] = [];

  // Type filter
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
  if (opts.textLength) {
    if (typeof opts.textLength.min === "number") {
      filter.push(`textLength >= ${opts.textLength.min}`);
    }
    if (typeof opts.textLength.max === "number") {
      filter.push(`textLength <= ${opts.textLength.max}`);
    }
  }

  // Global tag filter — tags (SlugRef[]) takes precedence over tagIds
  if (opts.tags?.length) {
    const resolvedTagIds = await resolveSlugRefs(opts.tags);
    for (const tagId of resolvedTagIds) {
      filter.push(`allTagIds = "${tagId}"`);
    }
  } else if (opts.allTagIds?.length) {
    for (const tagId of opts.allTagIds) {
      filter.push(`allTagIds = "${tagId}"`);
    }
  } else if (opts.tagIds?.length) {
    for (const tagId of opts.tagIds) {
      filter.push(`allTagIds = "${tagId}"`);
    }
  }

  if (opts.workUnitId) {
    filter.push(`workUnitId = "${opts.workUnitId}"`);
  }
  if (opts.searchGroupId) {
    filter.push(`searchGroupId = "${opts.searchGroupId}"`);
  }
  if (opts.workRoles?.length) {
    if (opts.workRoles.length === 1) {
      filter.push(`workRoles = "${opts.workRoles[0]}"`);
    } else {
      filter.push(
        `workRoles IN [${opts.workRoles.map((role) => `"${role}"`).join(", ")}]`,
      );
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
  if (opts.realmId) {
    filter.push(`realmIds = "${opts.realmId}"`);
  }

  // Realm-scoped tag filter (build compound keys)
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

  if (opts.translationGroupIds?.length) {
    filter.push(anyValueFilter("translationGroupId", opts.translationGroupIds));
  }

  // Language filter
  if (opts.languages?.length) {
    for (const lang of opts.languages) {
      filter.push(`languages = "${lang}"`);
    }
  }

  // Rating filter — set-based (ratings: ContentRating[]). When the caller
  // passes an empty array or omits the field, no rating constraint is applied
  // here; upstream callers are expected to have already intersected the
  // request with the session's allowed rating set.
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
  if (opts.isLicensed === true) {
    filter.push("isLicensed = true");
  } else if (opts.isLicensed === false) {
    filter.push("isLicensed = false");
  }

  // Visibility: always public for content search
  filter.push('visibility = "PUBLIC"');

  // Sort
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
  const items = grouped
    ? groupReleaseHits(resp.hits as any[]).slice(0, limit)
    : (resp.hits as any[]);

  return {
    items,
    total: grouped ? items.length : (resp.estimatedTotalHits ?? items.length),
    processingTimeMs: resp.processingTimeMs,
    query: resp.query ?? q,
  };
}
