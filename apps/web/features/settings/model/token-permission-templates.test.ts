import { describe, expect, it } from "vitest";

import { ContentAgentPermissions, ReadOnlyPermissions } from "./token-permission-templates";

describe("API token permission templates", () => {
	it("allows content agents to propose and vote on Unit references", () => {
		expect(ContentAgentPermissions).toEqual(
			expect.arrayContaining(["unit:read", "interaction:write", "profile:read"]),
		);
	});

	it("keeps the read-only template free of write permissions", () => {
		expect(ReadOnlyPermissions).not.toContain("interaction:write");
		expect(ReadOnlyPermissions).not.toContain("unit:update");
	});
});
