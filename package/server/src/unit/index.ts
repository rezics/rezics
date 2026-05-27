/**
 * Units Service - Main exports
 */

export type {
  AuthorityUnit,
  CollaborativeSurfacePolicy,
  UnitFieldEditDecision,
} from "./authority";
export {
  assertCanEditUnitFields,
  canEditUnitFields,
  hasAuthorityOver,
  UnitAuthorityError,
} from "./authority";
export { unitAuthorityApi } from "./authority.api";
export {
  UnitAuthorityService,
  unitAuthorityService,
} from "./authority.service";
export {
  allocateUnitHistorySequence,
  buildEditorialRevisionPayload,
  buildStructureEventPayload,
  canonicalSerialize,
  hashCanonicalPayload,
  writeHistoryOutbox,
} from "./history-outbox";
export { historyOutboxAdminApi } from "./history-outbox.admin.api";
export { mapTranslationToDTO, mapUnitToDTO } from "./mapper";
export { TranslationService, translationService } from "./translation.service";
export { translationSourceApi } from "./translation-source.api";
export type { UnitWithRelations } from "./types";
export { unitInclude } from "./types";
export { unitApi } from "./unit.api";
export { UnitService, unitService } from "./unit.service";
export { unitWorkMembershipApi } from "./unit-work-membership.api";
export { workMembershipClaimApi } from "./work-membership-claim.api";
