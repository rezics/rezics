import type {
  BookQueryOptions,
  UnitListQuery,
  ReadlistListQuery,
} from '@package/contract';
import type {BookSearchResult} from './book';
import type {UnitSearchResult} from './unit';
import type {ReadlistSearchResult} from './readlist';
import {searchBooks} from './book/book.api';
import {searchUnits} from './unit/unit.api';
import {searchReadlists} from './readlist/readlist.api';
import {
  syncAllBooks,
  initBookIndex,
  getSearchKey,
  getAdminKey,
  listKeys,
  deleteKey,
  initUnitIndex,
  syncAllUnits,
  initReadlistIndex,
  syncAllReadlists,
} from '@package/search/src/index';

/**
 * MeiliService
 *
 * Thin service layer around the shared `@package/search` helpers.
 * This is used by the Elysia HTTP controllers and can also be reused
 * internally from other services if needed.
 */
export class MeiliService {
  /**
   * Search books using the contract-based BookQueryOptions.
   */
  async searchBooks(options: BookQueryOptions): Promise<BookSearchResult> {
    return searchBooks(options);
  }

  /**
   * Search units using the contract-based UnitListQuery.
   */
  async searchUnits(options: UnitListQuery): Promise<UnitSearchResult> {
    return searchUnits(options);
  }

  /**
   * Search readlists using the contract-based ReadlistListQuery.
   */
  async searchReadlists(
    options: ReadlistListQuery,
  ): Promise<ReadlistSearchResult> {
    return searchReadlists(options);
  }

  /**
   * Initialize Meilisearch `books` index settings.
   */
  async initBooksIndex(): Promise<void> {
    await initBookIndex();
  }

  /**
   * Initialize Meilisearch `units` index settings.
   */
  async initUnitsIndex(): Promise<void> {
    await initUnitIndex();
  }

  /**
   * Initialize Meilisearch `readlists` index settings.
   */
  async initReadlistsIndex(): Promise<void> {
    await initReadlistIndex();
  }

  /**
   * Trigger a full re-sync of all books into Meilisearch.
   */
  async syncAllBooks(): Promise<unknown> {
    return syncAllBooks();
  }

  /**
   * Trigger a full re-sync of all units into Meilisearch.
   */
  async syncAllUnits(): Promise<unknown> {
    return syncAllUnits();
  }

  /**
   * Trigger a full re-sync of all readlists into Meilisearch.
   */
  async syncAllReadlists(): Promise<unknown> {
    return syncAllReadlists();
  }

  /**
   * Create a frontend-safe search key.
   */
  async createSearchKey(): Promise<string> {
    return getSearchKey();
  }

  /**
   * Create an admin key (server-side only).
   */
  async createAdminKey() {
    return getAdminKey();
  }

  /**
   * List existing Meilisearch keys.
   */
  async listKeys() {
    return listKeys();
  }

  /**
   * Delete a Meilisearch key by UID.
   */
  async deleteKey(keyUid: string) {
    return deleteKey(keyUid);
  }
}

export const meiliService = new MeiliService();
