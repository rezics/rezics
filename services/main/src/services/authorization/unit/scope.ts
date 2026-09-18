export { scopeCovers, scopeKey, unitScope } from "@rezics/access";
import { unitScope, type UnitScope } from "@rezics/access";
import type { AssociationKind } from "@rezics/schema/postgres/shared/contract-values";

export type { UnitScope };

export const associationTargetScope = (kind: AssociationKind) => unitScope("associations", kind);
