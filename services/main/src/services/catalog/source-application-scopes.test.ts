import { expect, test } from "vitest";
import { catalogSourceApplicationScopes } from "./source-application-scopes";

test("same-epoch updates keep both source snapshots and restore the original on withdrawal", () => {
	const before = {
		mappingKey: "mapping",
		previousObservedSnapshotId: "before",
		previousCorrespondenceRevision: 2,
	};
	const after = { mappingKey: "mapping", correspondenceRevision: 2, snapshotId: "after" };
	expect(catalogSourceApplicationScopes(before, after, "apply")).toEqual([
		{
			mappingKey: "mapping",
			correspondenceRevision: 2,
			snapshotIds: ["after", "before"],
			desiredSnapshotId: "after",
		},
	]);
	expect(catalogSourceApplicationScopes(before, after, "withdraw")[0]?.desiredSnapshotId).toBe(
		"before",
	);
});
test("identical archived bytes in a new epoch are distinct native interpretations", () => {
	const before = {
		mappingKey: "mapping",
		previousObservedSnapshotId: "same",
		previousCorrespondenceRevision: 2,
	};
	const after = { mappingKey: "mapping", correspondenceRevision: 4, snapshotId: "same" };
	expect(
		catalogSourceApplicationScopes(before, after, "apply").map((scope) => [
			scope.correspondenceRevision,
			scope.desiredSnapshotId,
		]),
	).toEqual([
		[4, "same"],
		[2, null],
	]);
	expect(
		catalogSourceApplicationScopes(before, after, "withdraw").map((scope) => [
			scope.correspondenceRevision,
			scope.desiredSnapshotId,
		]),
	).toEqual([
		[4, null],
		[2, "same"],
	]);
});
test("an observed but never-applied snapshot is not invented as a previous interpretation", () => {
	expect(
		catalogSourceApplicationScopes(
			{
				mappingKey: "mapping",
				previousObservedSnapshotId: "observed",
				previousCorrespondenceRevision: null,
			},
			{ mappingKey: "mapping", correspondenceRevision: 3, snapshotId: "new" },
			"withdraw",
		),
	).toEqual([
		{
			mappingKey: "mapping",
			correspondenceRevision: 3,
			snapshotIds: ["new"],
			desiredSnapshotId: null,
		},
	]);
});
