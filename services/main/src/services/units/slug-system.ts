import { TopLevelSlugNamespaceIds, type TopLevelSlugNamespace } from "@rezics/slug";

export { TopLevelSlugNamespaceIds, type TopLevelSlugNamespace };

/**
 * Immutable process-local routing data for permanent platform namespaces.
 *
 * @remarks
 * These entries are declared by the bootstrap manifest and are authoritative
 * for the resolver's first segment. Dynamic top-level namespaces still use the
 * database fallback.
 *
 * @todo
 * Revisit cache invalidation if permanent namespace mutation is ever allowed.
 */
export const TopLevelSlugNamespaceIdBySlug: ReadonlyMap<string, string> = new Map(
	Object.entries(TopLevelSlugNamespaceIds),
);

export const TopLevelSlugNamespaceSlugById: ReadonlyMap<string, string> = new Map(
	Object.entries(TopLevelSlugNamespaceIds).map(([slug, unitId]) => [unitId, slug]),
);

export const TopLevelSlugNamespaceIdSet: ReadonlySet<string> = new Set(
	Object.values(TopLevelSlugNamespaceIds),
);

export const SystemSlugNamespaceIds = Object.values(TopLevelSlugNamespaceIds);
