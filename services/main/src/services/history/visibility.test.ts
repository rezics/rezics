import { describe, expect, it } from "vitest";

import {
	canViewRevisionField,
	createRevisionVisibility,
	requiredRevisionVisibilityCapability,
	revisionVisibilitiesEqual,
	revisionVisibilityFromStorage,
	revisionVisibilityToStorage,
} from "./visibility";

describe("revision visibility", () => {
	it("round-trips each valid stored state through the semantic contract", () => {
		for (const stored of [
			{
				contentHidden: false,
				summaryHidden: false,
				actorHidden: false,
				suppressed: false,
			},
			{
				contentHidden: true,
				summaryHidden: true,
				actorHidden: false,
				suppressed: false,
			},
			{
				contentHidden: true,
				summaryHidden: true,
				actorHidden: true,
				suppressed: true,
			},
		] as const) {
			expect(revisionVisibilityToStorage(revisionVisibilityFromStorage(stored))).toEqual(
				stored,
			);
		}
	});

	it("rejects restricted states that do not protect a field", () => {
		expect(() => createRevisionVisibility("hidden", [])).toThrow(TypeError);
		expect(() => createRevisionVisibility("suppressed", [])).toThrow(TypeError);
		expect(() =>
			revisionVisibilityFromStorage({
				contentHidden: false,
				summaryHidden: false,
				actorHidden: false,
				suppressed: true,
			}),
		).toThrow(TypeError);
	});

	it("rejects duplicate hidden fields", () => {
		expect(() => createRevisionVisibility("hidden", ["content", "content"])).toThrow(TypeError);
	});

	it("compares semantic visibility without depending on field order", () => {
		expect(
			revisionVisibilitiesEqual(
				createRevisionVisibility("hidden", ["content", "summary"]),
				createRevisionVisibility("hidden", ["summary", "content"]),
			),
		).toBe(true);
		expect(
			revisionVisibilitiesEqual(
				createRevisionVisibility("hidden", ["content"]),
				createRevisionVisibility("suppressed", ["content"]),
			),
		).toBe(false);
	});

	it("shows ordinary hidden fields only to moderators", () => {
		const visibility = createRevisionVisibility("hidden", ["content"]);
		expect(
			canViewRevisionField(visibility, "content", {
				moderate: false,
				suppress: false,
			}),
		).toBe(false);
		expect(
			canViewRevisionField(visibility, "content", {
				moderate: true,
				suppress: false,
			}),
		).toBe(true);
		expect(
			canViewRevisionField(visibility, "content", {
				moderate: false,
				suppress: true,
			}),
		).toBe(false);
	});

	it("shows suppressed fields only to suppressors", () => {
		const visibility = createRevisionVisibility("suppressed", ["content", "summary"]);
		expect(
			canViewRevisionField(visibility, "content", {
				moderate: true,
				suppress: false,
			}),
		).toBe(false);
		expect(
			canViewRevisionField(visibility, "content", {
				moderate: false,
				suppress: true,
			}),
		).toBe(true);
		expect(
			canViewRevisionField(visibility, "actor", {
				moderate: false,
				suppress: false,
			}),
		).toBe(true);
	});

	it("requires suppression authority to enter or leave suppression", () => {
		const visible = createRevisionVisibility("visible", []);
		const hidden = createRevisionVisibility("hidden", ["content"]);
		const suppressed = createRevisionVisibility("suppressed", ["content"]);

		expect(requiredRevisionVisibilityCapability(visible, hidden)).toBe("platform.moderate");
		expect(requiredRevisionVisibilityCapability(hidden, visible)).toBe("platform.moderate");
		expect(requiredRevisionVisibilityCapability(hidden, suppressed)).toBe("platform.suppress");
		expect(requiredRevisionVisibilityCapability(suppressed, hidden)).toBe("platform.suppress");
	});
});
