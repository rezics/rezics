/** A source snapshot is adopted only when its exact correspondence epoch was applied. */
export type CatalogSourceHydration = "reference_only" | "snapshot_adopted" | "awaiting_adoption";

/** @internal Derived from persisted source snapshot/evidence FKs; a prepared reference never implies its own endpoint was hydrated. */
export function catalogSourceHydration(input: {
	observedSnapshotId: string | null;
	appliedCorrespondenceRevision: number | null;
	correspondenceRevision: number;
	evidenceSourceRecordId: string | null;
	evidenceSnapshotId: string | null;
	evidencePath: string | null;
}): CatalogSourceHydration {
	if (input.observedSnapshotId && input.appliedCorrespondenceRevision === input.correspondenceRevision) return "snapshot_adopted";
	if (input.observedSnapshotId === null && input.evidenceSourceRecordId && input.evidenceSnapshotId && input.evidencePath) return "reference_only";
	return "awaiting_adoption";
}
