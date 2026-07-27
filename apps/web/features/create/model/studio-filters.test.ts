import { describe, expect, it } from "vitest";

import {
	AnyStudioFilter,
	StudioPermissions,
	StudioSorts,
	StudioStatuses,
	StudioViews,
	StudioVisibilities,
	StudioWorkStates,
} from "./studio-filters";

describe("Studio filters", () => {
	it("derives every filter value from the generated API contract", () => {
		expect(StudioViews).toEqual(["all", "created", "contributed", "assigned", "delegated"]);
		expect(StudioPermissions).toEqual([
			"unit.update",
			"unit.publish",
			"unit.access.manage",
			"unit.protection.manage",
		]);
		expect(StudioWorkStates).toEqual(["actionable", "blocked"]);
		expect(StudioStatuses).toEqual(["draft", "published", "archived"]);
		expect(StudioVisibilities).toEqual(["public", "unlisted", "private"]);
		expect(StudioSorts).toEqual(["recent", "updated", "created", "relevant"]);
		expect(AnyStudioFilter).toBe("any");
	});
});
