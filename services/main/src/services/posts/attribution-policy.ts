import type { UnitOwnershipMode } from "@rezics/schema/postgres/shared/contract-values";

/**
 * Profile-owned Posts have an explicit publishing identity; community-owned
 * Posts are represented by shared ownership and revision provenance instead.
 */
export function shouldCreateProfilePublisherAttributionForPost(
	ownershipMode: UnitOwnershipMode,
): boolean {
	return ownershipMode === "profile_owned";
}
