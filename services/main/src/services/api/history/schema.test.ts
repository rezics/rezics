import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { RevisionVisibilityBody } from "./schema";

describe("History API schemas", () => {
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
