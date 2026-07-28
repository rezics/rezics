import { describe, expect, it } from "vitest";

import { isResourceVisibility, ResourceVisibilityValues } from "./resource-visibility";

describe("resource visibility", () => {
	it("keeps the frontend domain aligned with the API values", () => {
		expect(ResourceVisibilityValues).toEqual(["public", "unlisted", "private"]);
		expect(isResourceVisibility("public")).toBe(true);
		expect(isResourceVisibility("followers")).toBe(false);
	});
});
