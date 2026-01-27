// index.ts - Public entrypoint for the search package
// This file provides a small, well-documented API around Meilisearch,
// hiding low-level details and wiring with the rest of the application.

export {meili} from './client';
export {checkMeiliHealth} from './client';
export {
  bookIndex,
  unitIndex,
  readlistIndex,
  feedbackIndex,
  userIndex,
} from './meili_index';
export {
  initBookIndex,
  initUnitIndex,
  initReadlistIndex,
  initFeedbackIndex,
  initUserIndex,
} from './meili_index';
export {
  addOrUpdateBooks,
  addOrUpdateUnits,
  addOrUpdateReadlists,
  addOrUpdateFeedbacks,
  addOrUpdateUsers,
  deleteAllBooks,
  deleteAllUnits,
  deleteAllReadlists,
  deleteAllFeedbacks,
  deleteAllUsers,
  deleteBooks,
  deleteUnits,
  deleteReadlists,
  deleteFeedbacks,
  deleteUsers,
} from './documents';
export {getSearchKey, getAdminKey, listKeys, deleteKey} from './keys';
export {
  syncAllBooks,
  syncAllUnits,
  syncAllReadlists,
  syncAllFeedbacks,
  syncAllUsers,
} from './sync';

export * from './type';
