import { describe, expect, it } from "vitest";

import {
	buildRevisionVisibility,
	canSetRevisionVisibility,
	canViewRevisionField,
	revisionVisibilitiesEqual,
	type UnitRevisionVisibilityCapabilities,
} from "./revision-visibility";

const noAccess = {
	canRestore: false,
	canModerate: false,
	canSuppress: false,
} satisfies UnitRevisionVisibilityCapabilities;

describe("revision visibility UI policy", () => {
	it("mirrors the server capability needed to enter or leave suppression", () => {
		const moderator = { ...noAccess, canModerate: true };
		const suppressor = { ...noAccess, canSuppress: true };

		expect(canSetRevisionVisibility("visible", "hidden", moderator)).toBe(true);
		expect(canSetRevisionVisibility("hidden", "visible", moderator)).toBe(true);
		expect(canSetRevisionVisibility("hidden", "suppressed", moderator)).toBe(false);
		expect(canSetRevisionVisibility("hidden", "suppressed", suppressor)).toBe(true);
		expect(canSetRevisionVisibility("suppressed", "hidden", moderator)).toBe(false);
		expect(canSetRevisionVisibility("suppressed", "hidden", suppressor)).toBe(true);
	});

	it("does not treat suppression authority as ordinary moderation authority", () => {
		expect(
			canViewRevisionField({ kind: "hidden", hiddenFields: ["summary"] }, "summary", {
				...noAccess,
				canSuppress: true,
			}),
		).toBe(false);
		expect(
			canViewRevisionField({ kind: "suppressed", hiddenFields: ["summary"] }, "summary", {
				...noAccess,
				canSuppress: true,
			}),
		).toBe(true);
	});

	it("builds only visible or non-empty restricted states", () => {
		expect(buildRevisionVisibility("visible", ["content"])).toEqual({
			kind: "visible",
		});
		expect(buildRevisionVisibility("hidden", [])).toBeNull();
		expect(buildRevisionVisibility("suppressed", ["content", "content"])).toEqual({
			kind: "suppressed",
			hiddenFields: ["content"],
		});
	});

	it("compares semantic visibility without depending on field order", () => {
		expect(
			revisionVisibilitiesEqual(
				{ kind: "hidden", hiddenFields: ["content", "summary"] },
				{ kind: "hidden", hiddenFields: ["summary", "content"] },
			),
		).toBe(true);
		expect(
			revisionVisibilitiesEqual(
				{ kind: "hidden", hiddenFields: ["content"] },
				{ kind: "suppressed", hiddenFields: ["content"] },
			),
		).toBe(false);
	});
});
