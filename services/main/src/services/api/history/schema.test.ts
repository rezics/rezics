import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { ContributionResourceListQuery, RevisionVisibilityBody } from "./schema";

describe("History API schemas", () => {
	it("keeps public contribution-resource filters typed and bounded", () => {
		expect(
			Value.Check(ContributionResourceListQuery, {
				section: "book",
				kind: "contributed",
				localizationLanguages: ["zh", "en"],
				limit: 100,
			}),
		).toBe(true);
		expect(Value.Check(ContributionResourceListQuery, { section: "book" })).toBe(true);
		expect(Value.Check(ContributionResourceListQuery, { section: "book", kind: "assigned" })).toBe(
			false,
		);
		expect(Value.Check(ContributionResourceListQuery, { section: "book", limit: 101 })).toBe(false);
	});

	it.each([
		{
			visibility: { kind: "visible" },
			reasonCode: "copyright",
		},
		{
			visibility: { kind: "hidden", hiddenFields: ["content"] },
			reasonCode: "content_policy",
		},
		{
			visibility: {
				kind: "suppressed",
				hiddenFields: ["content", "summary", "actor"],
			},
			reasonCode: "copyright",
		},
	])("accepts the valid revision visibility command %#", (body) => {
		expect(Value.Check(RevisionVisibilityBody, body)).toBe(true);
	});

	it.each([
		{
			visibility: { kind: "suppressed", hiddenFields: [] },
			reasonCode: "copyright",
		},
		{
			visibility: {
				kind: "suppressed",
				hiddenFields: ["content", "content"],
			},
			reasonCode: "copyright",
		},
		{
			visibility: { kind: "visible", hiddenFields: ["content"] },
			reasonCode: "copyright",
		},
		{
			visibility: { kind: "hidden", hiddenFields: ["content"] },
			reasonCode: "unreviewed",
		},
		{
			visibility: { kind: "hidden", hiddenFields: ["content"] },
		},
	])("rejects the invalid revision visibility command %#", (body) => {
		expect(Value.Check(RevisionVisibilityBody, body)).toBe(false);
	});
});
