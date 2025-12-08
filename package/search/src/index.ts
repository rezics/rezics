// index.ts - Public entrypoint for the search package
// This file provides a small, well-documented API around Meilisearch,
// hiding low-level details and wiring with the rest of the application.

export {meili} from './client';
export {
  initBookIndex,
  initUnitIndex,
  initReadlistIndex,
  initFeedbackIndex,
} from './meili_index';
export {
  addOrUpdateBooks,
  addOrUpdateUnits,
  addOrUpdateReadlists,
  addOrUpdateFeedbacks,
  deleteAllBooks,
  deleteAllUnits,
  deleteAllReadlists,
  deleteAllFeedbacks,
  deleteBooks,
  deleteUnits,
  deleteReadlists,
  deleteFeedbacks,
} from './documents';
export {getSearchKey, getAdminKey, listKeys, deleteKey} from './keys';
export {
  syncAllBooks,
  syncAllUnits,
  syncAllReadlists,
  syncAllFeedbacks,
} from './sync';

export * from './type';
