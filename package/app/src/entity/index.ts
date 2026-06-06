export { EntityAvatar } from "./components/EntityAvatar";
export { EntityHero } from "./components/EntityHero";
export {
  EntityIdentityRow,
  getEntityIdentityTitle,
} from "./components/EntityIdentityRow";
export { EntityKindBadge } from "./components/EntityKindBadge";
export { EntityVerifiedIcon } from "./components/EntityVerifiedIcon";
export { useEntityWorks } from "./hooks/useEntityWorks";
export {
  addCreditAttribution,
  addSubjectAttribution,
  buildEntityAttributionBatchOps,
  type CreditAttributionQueueEntry,
  createEntityAttributionEditQueue,
  type EntityAttributionEditQueue,
  type EntityAttributionQueueSaveStatus,
  type EntityAttributionQueueSnapshot,
  isEntityAttributionQueueDirty,
  markEntityAttributionQueueError,
  markEntityAttributionQueueSaved,
  markEntityAttributionQueueSaving,
  removeCreditAttribution,
  removeSubjectAttribution,
  reorderCreditAttributions,
  reorderSubjectAttributions,
  replaceCreditAttributions,
  replaceSubjectAttributions,
  type SubjectAttributionQueueEntry,
} from "./models/entityAttributionEditQueue";
export {
  getEntityLanguages,
  getEntityPrimaryTitle,
  getEntityTranslation,
} from "./models/types";
export { EntityDetailPage } from "./pages/EntityDetailPage";
export { EntityEditPage } from "./pages/EntityEditPage";
export { MyEntitiesPage } from "./pages/MyEntitiesPage";
export { NewEntityPage } from "./pages/NewEntityPage";
export { AboutTab, hasAboutData } from "./sections/AboutTab";
export { hasOverviewData, OverviewTab } from "./sections/OverviewTab";
export { WorksTab } from "./sections/WorksTab";
