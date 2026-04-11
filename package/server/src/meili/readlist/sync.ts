// TODO(search-redesign): replaced by unified content index
// Readlists are now shelves, indexed via unit sync.

/**
 * @deprecated Readlist sync is a no-op. Readlists are now shelves indexed via syncUnitToMeili.
 */
export async function syncReadlistToMeili(unitId: string): Promise<void> {
  console.warn(
    `[DEPRECATED] syncReadlistToMeili(${unitId}) is a no-op. Readlists are now shelves.`,
  );
}

/**
 * @deprecated Readlist sync is a no-op. Readlists are now shelves indexed via deleteUnitFromMeili.
 */
export async function deleteReadlistFromMeili(unitId: string): Promise<void> {
  console.warn(
    `[DEPRECATED] deleteReadlistFromMeili(${unitId}) is a no-op. Readlists are now shelves.`,
  );
}
