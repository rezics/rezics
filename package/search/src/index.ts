// index.ts - Public entrypoint for the search package
// This file provides a small, well-documented API around Meilisearch,
// hiding low-level details and wiring with the rest of the application.

import {meili} from './client';
import {initBookIndex, initUnitIndex} from './meili_index';
import {
  addOrUpdateBooks,
  addOrUpdateUnits,
  deleteAllBooks,
  deleteAllUnits,
  deleteBooks,
  deleteUnits,
} from './documents';
import {getSearchKey, getAdminKey, listKeys, deleteKey} from './keys';
import {syncAllBooks, syncAllUnits, syncAllUnitsOld} from './sync';

export * from './type';

/**
 * Initialize the `books` index in Meilisearch with the correct settings
 * (searchable, filterable and sortable attributes).
 *
 * Safe to call multiple times; Meilisearch will update the settings as needed.
 */
export {initBookIndex};

/**
 * Initialize the `units` index in Meilisearch with the correct settings.
 *
 * Safe to call multiple times; Meilisearch will update the settings as needed.
 */
export {initUnitIndex};

/**
 * Perform a full synchronization of all books from the primary database
 * into the Meilisearch `books` index.
 *
 * This is usually run as an admin/maintenance operation, not per request.
 */
export {syncAllBooks};

/**
 * Perform a full synchronization of all units from the primary database
 * into the Meilisearch `units` index.
 *
 * This is usually run as an admin/maintenance operation, not per request.
 */
export {syncAllUnits};

/**
 * Perform a full synchronization of all units from the primary database
 * into the Meilisearch `units` index.
 *
 * This is usually run as an admin/maintenance operation, not per request.
 */
export {syncAllUnitsOld};

/**
 * Upsert an array of book documents into Meilisearch.
 *
 * Prefer {@link syncAllBooks} for bulk sync from the DB; use this for
 * fine-grained updates when a single book changes.
 */
export {addOrUpdateBooks, deleteBooks, deleteAllBooks};

/**
 * Upsert an array of unit documents into Meilisearch.
 *
 * Prefer {@link syncAllUnits} for bulk sync from the DB; use this for
 * fine-grained updates when a single unit changes.
 */
export {addOrUpdateUnits, deleteUnits, deleteAllUnits};

/**
 * Meilisearch API client instance used internally by this package.
 *
 * You generally do not need to use this directly; it is exported for
 * advanced use cases.
 */
export {meili};

/**
 * Create a Meilisearch key that is restricted to `search` actions on the
 * `books` index. This key is suitable to be used by frontend clients.
 *
 * IMPORTANT: You should only expose the resulting key to trusted clients
 * and never leak the master key from environment variables.
 */
export {getSearchKey};

/**
 * Create a short-lived Meilisearch admin key that has full permissions.
 *
 * This should only be used in secure, server-side contexts (e.g. CLI tools
 * or admin panels) and never returned directly to untrusted clients.
 */
export {getAdminKey};

/**
 * List all existing Meilisearch keys.
 */
export {listKeys};

/**
 * Delete a Meilisearch key by its UID.
 */
export {deleteKey};
