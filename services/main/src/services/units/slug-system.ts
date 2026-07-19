export const TopLevelSlugNamespaceUnitIds = {
	users: "019b76da-a800-7000-8000-000000000001",
	realms: "019b76da-a800-7000-8000-000000000002",
	tags: "019b76da-a800-7000-8000-000000000003",
	zones: "019b76da-a800-7000-8000-000000000004",
	entities: "019b76da-a800-7000-8000-000000000005",
} as const;

export type TopLevelSlugNamespace = keyof typeof TopLevelSlugNamespaceUnitIds;

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
