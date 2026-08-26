import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
	DomainSearchBody,
	GroupedSearchBody,
	ZonePageAggregateBlockRequest,
	ZonePageAggregateExecutionBody,
} from "./schema";

describe("Search presentation localization", () => {
	it.each([DomainSearchBody, GroupedSearchBody])(
		"accepts omitted or empty localization hints",
		(schema) => {
			expect(Check(schema, { localizationLanguages: ["zh", "en"] })).toBe(true);
			expect(Check(schema, {})).toBe(true);
			expect(Check(schema, { localizationLanguages: [] })).toBe(true);
			expect(Check(schema, { localizationLanguages: ["en", "en"] })).toBe(false);
		},
	);

	it("requires a UUID for Realm Tag Context scoping", () => {
		expect(
			Check(DomainSearchBody, {
				localizationLanguages: ["zh", "en"],
				realmTagContextRealmId: "019b0000-0000-7000-8000-000000000002",
			}),
		).toBe(true);
		expect(
			Check(DomainSearchBody, {
				localizationLanguages: ["zh", "en"],
				realmTagContextRealmId: "not-a-realm",
			}),
		).toBe(false);
	});

	it("accepts only canonical content ratings", () => {
		expect(
			Check(DomainSearchBody, {
				localizationLanguages: ["zh", "en"],
				contentRatings: ["general", "r15", "r18"],
			}),
		).toBe(true);
		expect(
			Check(DomainSearchBody, {
				localizationLanguages: ["zh", "en"],
				contentRatings: ["r18", "r18"],
			}),
		).toBe(false);
		expect(
			Check(DomainSearchBody, {
				localizationLanguages: ["zh", "en"],
				contentRatings: ["adult"],
			}),
		).toBe(false);
	});
});

describe("Zone Block execution request identity", () => {
	const path = [{ slot: "blocks", key: "100000000001" }];

	it("accepts only a structural BlockPath plus execution state", () => {
		expect(
			Check(ZonePageAggregateBlockRequest, {
				path,
				selectionSeed: "continuation-a",
				state: { pageSize: 12 },
			}),
		).toBe(true);
		expect(
			Check(ZonePageAggregateExecutionBody, {
				pageRevision: "019b0000-0000-7000-8000-000000000001",
				includeDock: true,
				pageBlocks: [{ path }],
				dockBlocks: [{ path }],
				localizationLanguages: ["zh", "en"],
			}),
		).toBe(true);
	});

	it.each([
		["document kind", { path, documentKind: "page" }],
		["document id", { path, documentId: "019b0000-0000-7000-8000-000000000001" }],
		["surface", { path, surface: "dock" }],
		["client injections", { path, injections: [] }],
	] as const)("rejects client-owned %s", (_name, body) => {
		expect(Check(ZonePageAggregateBlockRequest, body)).toBe(false);
	});

	it("rejects malformed or ambiguous path segments", () => {
		expect(
			Check(ZonePageAggregateBlockRequest, {
				path: [{ slot: "blocks", key: "not-a-block-key" }],
			}),
		).toBe(false);
		expect(
			Check(ZonePageAggregateBlockRequest, {
				path: [{ slot: "comments", key: "100000000001" }],
			}),
		).toBe(false);
		expect(
			Check(ZonePageAggregateBlockRequest, {
				path: [{ slot: "blocks", key: "100000000001", index: 0 }],
			}),
		).toBe(false);
	});

	it("rejects unknown aggregate-body fields", () => {
		expect(Check(ZonePageAggregateExecutionBody, { documentId: "page-a" })).toBe(false);
	});
});
