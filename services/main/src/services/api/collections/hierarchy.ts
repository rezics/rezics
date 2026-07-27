export type CollectionParentValidationFailure =
	"self-parent" | "missing-parent" | "would-cycle" | "existing-cycle";

export function validateCollectionParent(
	input: {
		readonly targetId: string;
		readonly parentTargetId: string | null | undefined;
	},
	memberships: readonly {
		readonly unitId: string;
		readonly parentUnitId: string | null;
	}[],
): CollectionParentValidationFailure | null {
	if (!input.parentTargetId) return null;
	if (input.targetId === input.parentTargetId) return "self-parent";
	const parentById = new Map(
		memberships.map(({ unitId, parentUnitId }) => [unitId, parentUnitId] as const),
	);
	if (!parentById.has(input.parentTargetId)) return "missing-parent";
	const visited = new Set<string>();
	let ancestorId: string | null | undefined = input.parentTargetId;
	while (ancestorId) {
		if (ancestorId === input.targetId) return "would-cycle";
		if (visited.has(ancestorId)) return "existing-cycle";
		visited.add(ancestorId);
		ancestorId = parentById.get(ancestorId);
	}
	return null;
}
