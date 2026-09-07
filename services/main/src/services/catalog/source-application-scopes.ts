/** One immutable interpretation may have current and previous source snapshots in the same application. */
export type CatalogSourceApplicationScope = {
	mappingKey: string;
	correspondenceRevision: number;
	snapshotIds: string[];
	desiredSnapshotId: string | null;
};

/** @internal Compensation revisits recorded interpretations; it never guesses an old mapper from current metadata. */
export function catalogSourceApplicationScopes(
	applied: {
		mappingKey: string;
		previousObservedSnapshotId: string | null;
		previousCorrespondenceRevision: number | null;
	},
	current: { mappingKey: string; correspondenceRevision: number; snapshotId: string },
	action: "apply" | "withdraw",
): CatalogSourceApplicationScope[] {
	if (applied.mappingKey !== current.mappingKey)
		throw new TypeError("Source application crosses correspondence identity");
	const scopes: CatalogSourceApplicationScope[] = [
		{
			mappingKey: current.mappingKey,
			correspondenceRevision: current.correspondenceRevision,
			snapshotIds: [current.snapshotId],
			desiredSnapshotId: action === "apply" ? current.snapshotId : null,
		},
	];
	if (applied.previousCorrespondenceRevision !== null) {
		if (!applied.previousObservedSnapshotId)
			throw new TypeError("An applied source interpretation requires its archived snapshot");
		const previous = scopes.find(
			(scope) => scope.correspondenceRevision === applied.previousCorrespondenceRevision,
		);
		if (previous) {
			if (!previous.snapshotIds.includes(applied.previousObservedSnapshotId))
				previous.snapshotIds.push(applied.previousObservedSnapshotId);
			if (action === "withdraw") previous.desiredSnapshotId = applied.previousObservedSnapshotId;
		} else
			scopes.push({
				mappingKey: applied.mappingKey,
				correspondenceRevision: applied.previousCorrespondenceRevision,
				snapshotIds: [applied.previousObservedSnapshotId],
				desiredSnapshotId: action === "withdraw" ? applied.previousObservedSnapshotId : null,
			});
	}
	return scopes;
}
