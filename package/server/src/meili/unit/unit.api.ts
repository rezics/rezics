import type {UnitListQuery} from '@package/contract';
import {searchClient} from '../search-client';
import type {UnitSearchDocument, UnitSearchResult} from '@package/contract';
import type {SearchResponse} from '@package/search';
import {defaultSort} from '../util';
/**
 * Low-level search API that accepts a fully-constructed Meilisearch query string.
 *
 * Prefer using {@link searchUnits} in new code, which accepts a typed
 * {@link UnitListQuery} object and builds the query for you.
 */
export async function searchUnitsRaw(
  q: string,
  options?: {
    offset?: number;
    limit?: number;
    filter?: string | string[];
    sort?: string[];
  },
): Promise<SearchResponse<UnitSearchDocument>> {
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? 20;

  // eslint-disable-next-line no-console
  console.log('searchUnitsRaw', q, options);
  return searchClient.unitIndex.search<UnitSearchDocument>(q, {
    offset,
    limit,
    filter: options?.filter,
    sort: options?.sort,
  });
}

function parseCsv(value?: string | null): string[] {
  return (value ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function escapeValues(values: string[]): string {
  return values.map(v => `"${v.replace(/"/g, '\\"')}"`).join(', ');
}

/**
 * Higher-level search API for units.
 *
 * - Input is {@link UnitListQuery} from `@package/contract`.
 * - It maps contract fields like `q`, `types`, `statuses`, `tags`, `userIds`,
 *   `domainIds`, `targetUnitIds`, etc. into Meilisearch filter expressions
 *   and sort options.
 *
 * This is the main function you should consume from other packages.
 */
export async function searchUnits(
  opts: UnitListQuery,
): Promise<UnitSearchResult> {
  const q = opts.q ?? '';

  const filter: string[] = [];

  // Type filters (type / types / excludeTypes)
  const typeList = [...parseCsv(opts.types), ...(opts.type ? [opts.type] : [])];
  if (typeList.length > 0) {
    filter.push(`type IN [${escapeValues(typeList)}]`);
  }

  const excludeTypeList = parseCsv(opts.excludeTypes);
  if (excludeTypeList.length > 0) {
    filter.push(`NOT type IN [${escapeValues(excludeTypeList)}]`);
  }

  // Status filters (status / statuses)
  const statusList = [
    ...parseCsv(opts.statuses),
    ...(opts.status ? [opts.status] : []),
  ];
  if (statusList.length > 0) {
    filter.push(`status IN [${escapeValues(statusList)}]`);
  }

  // User filters (userId / userIds)
  const userList = [
    ...parseCsv(opts.userIds),
    ...(opts.userId ? [opts.userId] : []),
  ];
  if (userList.length > 0) {
    filter.push(`userId IN [${escapeValues(userList)}]`);
  }

  // Domain filters (domainIds)
  const domainList = parseCsv(opts.domainIds);
  if (domainList.length > 0) {
    filter.push(`domainIds IN [${escapeValues(domainList)}]`);
  }

  // Target filters (targetUnitId / targetUnitIds / hasTarget)
  const targetList = parseCsv(opts.targetUnitIds);
  const singleTarget = opts.targetUnitId?.trim();
  const combinedTargets = [...targetList, singleTarget].filter(
    Boolean,
  ) as string[];
  if (combinedTargets.length === 1) {
    filter.push(`targetUnitId = "${combinedTargets[0]!.replace(/"/g, '\\"')}"`);
  } else if (combinedTargets.length > 1) {
    filter.push(`targetUnitId IN [${escapeValues(combinedTargets)}]`);
  }
  if (opts.hasTarget === 'true') {
    filter.push('hasTarget = true');
  } else if (opts.hasTarget === 'false') {
    filter.push('hasTarget = false');
  }

  // Tags (tag / tags)
  const tagList = [...parseCsv(opts.tags), ...(opts.tag ? [opts.tag] : [])];
  if (tagList.length > 0) {
    filter.push(`tags IN [${escapeValues(tagList)}]`);
  }

  // Date ranges
  if (opts.createdAtFrom) {
    filter.push(`createdAt >= "${opts.createdAtFrom}"`);
  }
  if (opts.createdAtTo) {
    filter.push(`createdAt <= "${opts.createdAtTo}"`);
  }
  if (opts.publishedAtFrom) {
    filter.push(`publishedAt >= "${opts.publishedAtFrom}"`);
  }
  if (opts.publishedAtTo) {
    filter.push(`publishedAt <= "${opts.publishedAtTo}"`);
  }

  // Sort
  const sort: string[] = [];
  const sortField = opts.sort?.field ?? 'createdAt';
  const sortOrder = opts.sort?.order?.toLowerCase() === 'asc' ? 'asc' : 'desc';
  sort.push(`${sortField}:${sortOrder}`);

  const limit = opts.limit ?? 20;
  const offset = opts.start ?? 0;

  const resp = await searchUnitsRaw(q, {
    offset,
    limit,
    filter: filter.length > 0 ? filter : undefined,
    sort: sort.length > 0 ? sort : defaultSort,
  });

  function clipContent(resp: any) {
    return resp.hits.map((hit: UnitSearchDocument) => {
      return {
        ...hit,
        content:
          (hit.content?.length ?? 0) > 500
            ? hit.content?.slice(0, 500) + '...'
            : hit.content,
      };
    });
  }

  const unitsResult = clipContent(resp);

  return {
    units: unitsResult,
    total: resp.totalHits ?? resp.estimatedTotalHits ?? resp.hits.length,
    processingTimeMs: resp.processingTimeMs,
    query: resp.query ?? q,
  };
}
