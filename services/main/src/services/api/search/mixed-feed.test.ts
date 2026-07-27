import { describe, expect, it } from "vitest";

import { mixSearchGroupHits } from "./mixed-feed";

describe("mixed Search Feed ordering", () => {
	it("interleaves category ranks while preserving each category order", () => {
		expect(
			mixSearchGroupHits([
				{ hits: [{ id: "unit-1" }, { id: "unit-2" }, { id: "unit-3" }] },
				{ hits: [{ id: "post-1" }, { id: "post-2" }] },
				{ hits: [{ id: "profile-1" }] },
			]).map(({ id }) => id),
		).toEqual(["unit-1", "post-1", "profile-1", "unit-2", "post-2", "unit-3"]);
	});

	it("keeps only the first occurrence of a Unit exposed through multiple groups", () => {
		expect(
			mixSearchGroupHits([
				{ hits: [{ id: "shared" }, { id: "unit-2" }] },
				{ hits: [{ id: "post-1" }, { id: "shared" }] },
			]).map(({ id }) => id),
		).toEqual(["shared", "post-1", "unit-2"]);
	});
});
