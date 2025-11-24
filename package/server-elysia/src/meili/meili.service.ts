import type {BookQueryOptions} from '@package/contract';
import type {BookSearchDocument, BookSearchResult} from './book/interface';
import {searchBooks} from './book/book.api';
import {
  syncAllBooks,
  initBookIndex,
  getSearchKey,
  getAdminKey,
  listKeys,
  deleteKey,
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
   * Initialize Meilisearch `books` index settings.
   */
  async initBooksIndex(): Promise<void> {
    await initBookIndex();
  }

  /**
   * Trigger a full re-sync of all books into Meilisearch.
   */
  async syncAllBooks(): Promise<unknown> {
    return syncAllBooks();
  }

  /**
   * Convenience wrapper to expose the BookSearchDocument type
   * from the service layer, if needed by callers.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // This is here purely for type re-exporting via `typeof`.
  get _BookSearchDocumentType(): BookSearchDocument | undefined {
    return undefined;
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
