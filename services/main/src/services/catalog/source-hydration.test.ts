import { describe, expect, test } from "vitest";
import { catalogSourceHydration } from "./source-hydration";
const reference = { observedSnapshotId: null, appliedCorrespondenceRevision: 1, correspondenceRevision: 1,
	evidenceSourceRecordId: "source", evidenceSnapshotId: "snapshot", evidencePath: "/media/0/tracks/0/recording/id" };
describe("native source hydration receipt", () => {
	test("a sealed inline reference does not prove its own endpoint was adopted", () => {
		expect(catalogSourceHydration(reference)).toBe("reference_only");
	});
	test("an exact adopted snapshot proves the applied correspondence only", () => {
		expect(catalogSourceHydration({ ...reference, observedSnapshotId: "own-snapshot", evidenceSourceRecordId: null, evidenceSnapshotId: null, evidencePath: null })).toBe("snapshot_adopted");
		expect(catalogSourceHydration({ ...reference, observedSnapshotId: "own-snapshot", correspondenceRevision: 2 })).toBe("awaiting_adoption");
	});
});
