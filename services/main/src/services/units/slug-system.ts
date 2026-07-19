export const RootSlugNamespaceUnitId = "019b76da-a800-7000-8000-000000000000";

export const TopLevelSlugNamespaceUnitIds = {
	users: "019b76da-a800-7000-8000-000000000001",
	realms: "019b76da-a800-7000-8000-000000000002",
	tags: "019b76da-a800-7000-8000-000000000003",
	zones: "019b76da-a800-7000-8000-000000000004",
	entities: "019b76da-a800-7000-8000-000000000005",
} as const;

export const TopLevelSlugNamespaceUnitIdSet: ReadonlySet<string> = new Set(
	Object.values(TopLevelSlugNamespaceUnitIds),
);

export const SystemSlugNamespaceUnitIds = [
	RootSlugNamespaceUnitId,
	...Object.values(TopLevelSlugNamespaceUnitIds),
] as const;
