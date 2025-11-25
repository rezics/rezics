// index.ts - Public entrypoint for the search package
// This file provides a small, well-documented API around Meilisearch,
// hiding low-level details and wiring with the rest of the application.

export {meili} from './client';
export {initBookIndex, initUnitIndex} from './meili_index';
export {
  addOrUpdateBooks,
  addOrUpdateUnits,
  deleteAllBooks,
  deleteAllUnits,
  deleteBooks,
  deleteUnits,
} from './documents';
export {getSearchKey, getAdminKey, listKeys, deleteKey} from './keys';
export {syncAllBooks, syncAllUnits} from './sync';

export * from './type';
