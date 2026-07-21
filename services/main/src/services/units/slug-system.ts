import { TopLevelSlugNamespaceUnitIds, type TopLevelSlugNamespace } from "@rezics/slug";

export { TopLevelSlugNamespaceUnitIds, type TopLevelSlugNamespace };

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
export const TopLevelSlugNamespaceUnitIdBySlug: ReadonlyMap<string, string> = new Map(
	Object.entries(TopLevelSlugNamespaceUnitIds),
);

export const TopLevelSlugNamespaceSlugByUnitId: ReadonlyMap<string, string> = new Map(
	Object.entries(TopLevelSlugNamespaceUnitIds).map(([slug, unitId]) => [unitId, slug]),
);

export const TopLevelSlugNamespaceUnitIdSet: ReadonlySet<string> = new Set(
	Object.values(TopLevelSlugNamespaceUnitIds),
);

export const SystemSlugNamespaceUnitIds = Object.values(TopLevelSlugNamespaceUnitIds);
