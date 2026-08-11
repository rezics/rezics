import { describe, expect, it } from "vitest";

import {
	AnyStudioFilter,
	ContributionKinds,
	StudioModes,
	StudioStatuses,
	StudioVisibilities,
	WorkspaceSources,
} from "./studio-filters";

describe("Studio filters", () => {
	it("derives every filter value from the generated API contract", () => {
		expect(StudioModes).toEqual(["workspace", "contributions"]);
		expect(WorkspaceSources).toEqual(["all", "owned", "direct", "delegated"]);
		expect(ContributionKinds).toEqual(["all", "created", "contributed"]);
		expect(StudioStatuses).toEqual(["draft", "published", "archived"]);
		expect(StudioVisibilities).toEqual(["public", "unlisted", "private"]);
		expect(AnyStudioFilter).toBe("any");
	});
});
