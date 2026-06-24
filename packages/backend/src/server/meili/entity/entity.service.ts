import type {
  EntitySearchDocument,
  EntitySearchOptions,
  EntitySearchResult,
} from "@rezics/contract";
import type { SearchResponse } from "@rezics/search";
import { searchClient } from "../search-client";

function escapeValue(value: string): string {
  return value.trim().replace(/"/g, '\\"');
}

export async function searchEntities(
  opts: EntitySearchOptions = {},
): Promise<EntitySearchResult> {
  const q = opts.q ?? "";
  const filter: string[] = [];

  if (opts.kind) {
    filter.push(`kind = "${escapeValue(opts.kind)}"`);
  }
  if (opts.verified !== undefined) {
    filter.push(`verified = ${opts.verified}`);
  }
  if (opts.ownerUnitId) {
    filter.push(`ownerUnitId = "${escapeValue(opts.ownerUnitId)}"`);
  }
  if (opts.eligibleCreditRole) {
    filter.push(
      `eligibleCreditRoles = "${escapeValue(opts.eligibleCreditRole)}"`,
    );
  }
  if (opts.eligibleSubjectRole) {
    filter.push(
      `eligibleSubjectRoles = "${escapeValue(opts.eligibleSubjectRole)}"`,
    );
  }

  const page = Math.max(Number(opts.page ?? 1), 1);
  const limit = Math.max(1, Math.min(Number(opts.limit ?? 20), 100));
  const offset = (page - 1) * limit;

  const resp = (await searchClient.entityIndex.search<EntitySearchDocument>(q, {
    offset,
    limit,
    filter: filter.length > 0 ? filter : undefined,
    sort: ["updatedAt:desc"],
  })) as SearchResponse<EntitySearchDocument>;

  return {
    entities: resp.hits,
    total: resp.estimatedTotalHits ?? resp.hits.length,
    processingTimeMs: resp.processingTimeMs,
    query: resp.query ?? q,
  };
}
