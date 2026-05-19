/**
 * Units Service - Main exports
 */

export {
  assertCanEditUnitFields,
  canEditUnitFields,
  hasAuthorityOver,
  UnitAuthorityError,
} from "./authority";
export type {
  AuthorityUnit,
  CollaborativeSurfacePolicy,
  UnitFieldEditDecision,
} from "./authority";
export { unitAuthorityApi } from "./authority.api";
export {
  UnitAuthorityService,
  unitAuthorityService,
} from "./authority.service";
export { mapTranslationToDTO, mapUnitToDTO } from "./mapper";
export { translationSourceApi } from "./translation-source.api";
export { TranslationService, translationService } from "./translation.service";
export type { UnitWithRelations } from "./types";
export { unitInclude } from "./types";
export { unitApi } from "./unit.api";
export { UnitService, unitService } from "./unit.service";
export { workLinkClaimApi } from "./work-link-claim.api";
export { workLinkApi } from "./work-link.api";
