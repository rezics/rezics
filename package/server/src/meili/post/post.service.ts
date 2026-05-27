import type { PostSearchOptions, PostSearchResult } from "@rezics/contract";
import { searchClient } from "../search-client";

const COMMENT_RANKING_SORTS = new Set([
  "commentHotScore",
  "commentTopScore",
  "commentQualityScore",
]);

function hasSiblingCommentScope(opts: PostSearchOptions) {
  return Boolean(opts.parentPostUnitId || typeof opts.depth === "number");
}

export async function searchPosts(
  opts: PostSearchOptions,
): Promise<PostSearchResult> {
  const q = opts.keyword ?? "";
  const filter: string[] = [];

  if (opts.kind) {
    filter.push(`kind = "${opts.kind}"`);
  }
  if (opts.targetUnitId) {
    filter.push(`targetUnitId = "${opts.targetUnitId}"`);
  }
  if (opts.rootTargetUnitId) {
    filter.push(`rootTargetUnitId = "${opts.rootTargetUnitId}"`);
  }
  if (opts.rootTargetUnitType) {
    filter.push(`rootTargetUnitType = "${opts.rootTargetUnitType}"`);
  }
  if (opts.realmUnitId) {
    filter.push(`realmIds = "${opts.realmUnitId}"`);
  }
  if (opts.workUnitId) {
    filter.push(`workUnitIds = "${opts.workUnitId}"`);
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
  if (opts.authorUserId) {
    filter.push(`authorUserId = "${opts.authorUserId}"`);
  }
  if (opts.rootPostUnitId) {
    filter.push(`rootPostUnitId = "${opts.rootPostUnitId}"`);
  }
  if (opts.parentPostUnitId) {
    filter.push(`parentPostUnitId = "${opts.parentPostUnitId}"`);
  }
  if (typeof opts.depth === "number") {
    filter.push(`depth = ${opts.depth}`);
  }
  if (typeof opts.isLocked === "boolean") {
    filter.push(`isLocked = ${opts.isLocked}`);
  }

  const sort: string[] = [];
  if (opts.sort?.field && opts.sort.field !== "relevance") {
    if (
      COMMENT_RANKING_SORTS.has(opts.sort.field) &&
      !hasSiblingCommentScope(opts)
    ) {
      throw new Error("Comment ranking sorts require a sibling scope filter");
    }
    const order = opts.sort.order ?? "desc";
    sort.push(`${opts.sort.field}:${order}`);
  } else if (!q) {
    sort.push("createdAt:desc");
  }

  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  const resp = await searchClient.postIndex.search(q, {
    offset,
    limit,
    filter: filter.length > 0 ? filter : undefined,
    sort: sort.length > 0 ? sort : undefined,
  });

  return {
    items: resp.hits as any[],
    total: resp.estimatedTotalHits ?? resp.hits.length,
    processingTimeMs: resp.processingTimeMs,
    query: resp.query ?? q,
  };
}
