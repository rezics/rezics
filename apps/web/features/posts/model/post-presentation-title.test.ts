import { describe, expect, it } from "vitest";

import { resolvePostPresentationTitle } from "./post-presentation-title";

const messages = {
	reviewOf: ({ author, subject }: { author: string; subject: string }) =>
		`${author}'s review of ${subject}`,
	reply: "Reply",
	unknownAttribution: "Unknown",
	unnamedSubject: "Unnamed subject",
};

describe("Post presentation title", () => {
	it("preserves an authored title and its content language", () => {
		expect(
			resolvePostPresentationTitle(
				{
					title: " Authored title ",
					language: "en",
					postKind: "post",
					attributions: [],
				},
				messages,
			),
		).toEqual({ value: "Authored title", language: "en" });
	});

	it("does not invent a presentation title for a titleless Post", () => {
		expect(
			resolvePostPresentationTitle(
				{
					title: null,
					postKind: "post",
					attributions: [
						{ role: "author", creditedUnit: { title: "Author" } },
						{ role: "publisher", creditedUnit: { title: "Publisher" } },
					],
				},
				messages,
			),
		).toBeNull();
	});

	it("derives a titleless Review from its attribution and subject", () => {
		expect(
			resolvePostPresentationTitle(
				{
					title: null,
					postKind: "review",
					attributions: [],
					subject: { title: "The Work" },
				},
				messages,
			),
		).toEqual({ value: "Unknown's review of The Work" });
	});
});
