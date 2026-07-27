import type { AssociationKind } from "../../database/schema/contract-values";
import type { UnitPermission } from "../unit/policy";

export type { AssociationKind };
export type EntityAssociationCommand = "direct" | "request" | "invitation";

export function entityAssociationPermission(
	kind: AssociationKind,
	command: Exclude<EntityAssociationCommand, "invitation">,
): UnitPermission {
	return `entity.association.${kind}.${command}`;
}
