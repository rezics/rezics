// MOCK: Legacy mappers retained as stubs for consumers not yet migrated
// to server-side DB queries. These were used by review, readlist, and
// user-units pages that queried the old `units` Meili index.

/**
 * @deprecated Units index removed. Migrate to server-side review API.
 */
// MOCK: review mapping stub
export function mapUnitToReviewDTO(unit: any): any {
  return {
    unitId: unit.unitId ?? unit.id,
    bookId: unit.targetUnitId,
    title: unit.title,
    content: unit.content ?? "",
    rating: unit.metadata?.rating,
    created_at: unit.createdAt,
    user: unit.user,
    metadata: unit.metadata,
  };
}

/**
 * @deprecated Units index removed. Migrate to server-side review API.
 */
// MOCK: review list mapping stub
export function mapUnitListToReviewListResponse(unitResp: any): any {
  const reviews =
    (unitResp.units as any[] | undefined)?.map(mapUnitToReviewDTO) ?? [];
  return { reviews, total: unitResp.total };
}

/**
 * @deprecated Readlists replaced by shelves. Migrate to server-side shelf API.
 */
// MOCK: readlist mapping stub
export function mapUnitToReadlistDTO(unit: any): any {
  const metadata = unit.metadata ?? {};
  const items: any[] = Array.isArray(metadata.items) ? metadata.items : [];
  return {
    id: unit.id,
    title: unit.title ?? "",
    content: unit.content ?? "",
    coverUrl: metadata.coverUrl,
    creator: unit.user,
    books: items
      .filter((i: any) => i.bookUnitId)
      .map((i: any) => ({ unitId: i.bookUnitId })),
    reviews: items
      .filter((i: any) => i.reviewUnitId)
      .map((i: any) => ({ unitId: i.reviewUnitId })),
    order: items
      .map((i: any) => i.bookUnitId || i.reviewUnitId)
      .filter(Boolean),
  };
}

/**
 * @deprecated Readlists replaced by shelves. Migrate to server-side shelf API.
 */
// MOCK: readlist search result mapping stub
export function mapReadlistSearchResultToReadlistListResponse(
  searchResult: any,
): any {
  const readlists =
    (searchResult.readlists as any[] | undefined)?.map(mapUnitToReadlistDTO) ??
    [];
  return { readlists, total: searchResult.total };
}

/**
 * @deprecated Units index removed. Migrate to server-side API.
 */
// MOCK: unit list to readlist mapping stub
export function mapUnitListToReadlistListResponse(unitResp: any): any {
  const readlists =
    (unitResp.units as any[] | undefined)?.map(mapUnitToReadlistDTO) ?? [];
  return { readlists, total: unitResp.total };
}
