import { Value } from "typebox/value";
import { describe, expect, it } from "vitest";

import {
	ContributionResourceListQuery,
	ContributionResourceListResponse,
	RevisionActionBody,
	RevisionVisibilityBody,
} from "./schema";

describe("History API schemas", () => {
	const rules = [
		{
			sourceRealmId: "019b76da-a800-7300-8000-000000000001",
			revisionId: "019b76da-a800-7300-8000-000000000002",
			ruleId: "019b76da-a800-7300-8000-000000000003",
		},
	];
	it("accepts one explicit primary contribution without client assurance", () => {
		const creditedEntityId = "019b0000-0000-7000-8000-000000000004";
		expect(
			Value.Check(RevisionActionBody, {
				baseRevisionId: "019b0000-0000-7000-8000-000000000005",
				revisionContext: {
					contribution: { primary: "ai", creditedEntityId, role: "editor" },
				},
			}),
		).toBe(true);
		expect(
			Value.Check(RevisionActionBody, {
				baseRevisionId: "019b0000-0000-7000-8000-000000000005",
				revisionContext: {
					contribution: {
						primary: "ai",
						creditedEntityId,
						role: "editor",
						assurance: "server_observed",
					},
				},
			}),
		).toBe(false);
	});
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

	it("keeps localized Units and immutable Tag Paths discriminated", () => {
		const activity = {
			id: "019b76da-a800-7300-8000-000000000002",
			createdResourceAt: "2026-07-01T08:00:00.000Z",
			firstContributedAt: null,
			lastContributedAt: null,
			contributionCount: 0,
			lastParticipatedAt: "2026-07-01T08:00:00.000Z",
			createdAt: "2026-07-01T08:00:00.000Z",
			updatedAt: "2026-07-01T08:00:00.000Z",
		};
		const localized = {
			...activity,
			section: "book",
			resourceKind: "book",
			presentation: {
				kind: "localized_unit",
				slugAddress: null,
				language: "en",
				title: "A book",
				cover: null,
				status: "published",
				visibility: "public",
			},
		};
		const path = {
			...activity,
			section: "tag",
			resourceKind: "tag_path",
			presentation: {
				kind: "tag_path",
				members: [
					{
						ordinal: 0,
						nodeId: "019b76da-a800-7300-8000-000000000003",
						nodeKind: "concept",
						incomingRelation: null,
						language: "en",
						title: "Fiction",
						summary: null,
						avatar: null,
					},
					{
						ordinal: 1,
						nodeId: "019b76da-a800-7300-8000-000000000004",
						nodeKind: "concept",
						incomingRelation: {
							relationId: "019b76da-a800-7300-8000-000000000005",
							relationKind: "generic",
						},
						language: "en",
						title: "Fantasy",
						summary: null,
						avatar: null,
					},
				],
			},
		};

		expect(
			Value.Check(ContributionResourceListResponse, { items: [localized, path], nextCursor: null }),
		).toBe(true);
		expect(
			Value.Check(ContributionResourceListResponse, {
				items: [{ ...path, presentation: localized.presentation }],
				nextCursor: null,
			}),
		).toBe(false);
	});

	it.each([
		{
			visibility: { kind: "visible" },
			rules,
		},
		{
			visibility: { kind: "hidden", hiddenFields: ["content"] },
			rules,
		},
		{
			visibility: {
				kind: "suppressed",
				hiddenFields: ["content", "summary", "actor"],
			},
			rules,
		},
	])("accepts the valid revision visibility command %#", (body) => {
		expect(Value.Check(RevisionVisibilityBody, body)).toBe(true);
	});

	it.each([
		{
			visibility: { kind: "suppressed", hiddenFields: [] },
			rules,
		},
		{
			visibility: {
				kind: "suppressed",
				hiddenFields: ["content", "content"],
			},
			rules,
		},
		{
			visibility: { kind: "visible", hiddenFields: ["content"] },
			rules,
		},
		{
			visibility: { kind: "hidden", hiddenFields: ["content"] },
			rules: [{ ...rules[0], ruleId: "not-a-uuid" }],
		},
		{
			visibility: { kind: "hidden", hiddenFields: ["content"] },
		},
		{
			visibility: { kind: "visible" },
		},
	])("rejects the invalid revision visibility command %#", (body) => {
		expect(Value.Check(RevisionVisibilityBody, body)).toBe(false);
	});
});
