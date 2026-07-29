import type { ResourceVisibility } from "../database/schema/contract-values";

/**
 * Converts an optional API visibility change into a non-empty Unit update.
 * @internal
 */
export function toUnitVisibilityUpdate(
	visibility: ResourceVisibility | undefined,
): { readonly visibility: ResourceVisibility } | undefined {
	return visibility === undefined ? undefined : { visibility };
}
