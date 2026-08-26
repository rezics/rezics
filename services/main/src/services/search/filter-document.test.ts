import { SearchFieldValues } from "@rezics/filter";
import { describe, expect, it } from "vitest";

import { WorkPolicy } from "../performance/policy";
import {
	compileSearchFeatureInput,
	resolveFilterDocument,
	type SearchEndpointPolicy,
} from "./filter-document";

const TagId = "019f7eed-5d42-7102-8387-cc1d13b176d3";
const ZoneId = "019f7eed-5d42-7102-8387-cc1d13b176d4";

function input(filterDocument: unknown, state: Record<string, unknown> = {}) {
	return {
		filterDocument,
		contexts: [],
		injections: [],
		state,
	};
}

describe("sparse Filter documents", () => {
	it("keeps an empty document empty while resolving the global capability ceiling", () => {
		const resolved = resolveFilterDocument({}, true);

		expect(resolved.filterDocument).toEqual({});
		expect(resolved.categories.length).toBeGreaterThan(1);
		expect(resolved.controls.map((control) => control.field)).toEqual(
			expect.arrayContaining([...SearchFieldValues]),
		);
		expect(resolved.sort.search.defaults).toEqual({
			emptyQuery: "best",
			textQuery: "relevance",
		});
	});

	it("does not accept document-owned defaults, sorts, or result limits", () => {
		for (const document of [
			{ defaults: [] },
			{ sort: { options: ["best"] } },
			{ results: { pageSize: 1 } },
		])
			expect(() => resolveFilterDocument(document, true)).toThrow("Invalid Filter document");
	});

	it("compiles only the explicit categories and domain predicate", () => {
		const filterDocument = {
			categories: ["units"],
			where: { kind: { in: ["book"] } },
		} as const;
		const compiled = compileSearchFeatureInput(input(filterDocument), {
			sortProfile: "search",
			pageBudget: "per-category",
		});

		expect(compiled.request.categories).toEqual(["units"]);
		expect(compiled.request.domainFilter).toEqual(filterDocument.where);
		expect(compiled.request.pageSize).toBe(20);
		expect(compiled.request.maxResultWindow).toBe(WorkPolicy.search.maxResultWindow);
	});

	it("treats controls as sparse overrides of server-owned controls", () => {
		const resolved = resolveFilterDocument(
			{ controls: [{ key: "language", enabled: false, disclosure: "hidden" }] },
			true,
		);

		expect(resolved.controls.find((control) => control.key === "language")).toMatchObject({
			field: "language",
			enabled: false,
			disclosure: "hidden",
		});
		expect(() =>
			compileSearchFeatureInput(
				input(
					{ controls: [{ key: "language", enabled: false }] },
					{
						expression: {
							controlKey: "language",
							filter: { field: "language", operator: "equals", value: "en" },
						},
					},
				),
				{ sortProfile: "search", pageBudget: "per-category" },
			),
		).toThrow("unavailable");
	});

	it("allows repeated custom Tag controls but no other repeated field", () => {
		const filterDocument = {
			controls: [{ key: "genre", field: "tag", required: true }],
		} as const;
		const compiled = compileSearchFeatureInput(
			input(filterDocument, {
				expression: {
					controlKey: "genre",
					filter: { field: "tag", operator: "equals", value: TagId },
				},
			}),
			{ sortProfile: "search", pageBudget: "per-category" },
		);

		expect(compiled.request.searchExpression).toEqual({
			field: "tag",
			operator: "equals",
			value: TagId,
		});
		expect(() =>
			resolveFilterDocument({ controls: [{ key: "spoken", field: "language" }] }, true),
		).toThrow("Only Tag controls may be repeated");
	});

	it("enforces server-owned page and result-window limits", () => {
		expect(() =>
			compileSearchFeatureInput(input({}, { pageSize: WorkPolicy.search.maxPageSize + 1 }), {
				sortProfile: "search",
				pageBudget: "per-category",
			}),
		).toThrow("Invalid Search Feature input");
	});

	it("lets an endpoint narrow the global fields and sorts without creating a preset", () => {
		const policy = {
			fields: [],
			sorts: ["title:asc", "title:desc"],
			defaultSorts: {
				search: { emptyQuery: "title:asc", textQuery: "title:asc" },
				feed: { emptyQuery: "title:asc", textQuery: "title:asc" },
			},
			facets: [],
		} as const satisfies SearchEndpointPolicy;
		const resolved = resolveFilterDocument({}, true, policy);

		expect(resolved.filterDocument).toEqual({});
		expect(resolved.controls).toEqual([]);
		expect(resolved.sort.search.options).toEqual(["title:asc", "title:desc"]);
	});

	it("keeps Zone scope separate from the Filter document", () => {
		const compiled = compileSearchFeatureInput(
			{
				...input({}),
				contexts: [{ kind: "zone", zoneId: ZoneId }],
			},
			{ sortProfile: "search", pageBudget: "per-category" },
		);

		expect(compiled.enforcedZoneId).toBe(ZoneId);
		expect(compiled.request.domainFilter).toBeUndefined();
	});

	it("rejects Tag Paths as an ordinary Search category", () => {
		expect(resolveFilterDocument({}, false).categories).not.toContain("tag-paths");
		expect(() => resolveFilterDocument({ categories: ["tag-paths"] }, false)).toThrow(
			"Invalid Filter document",
		);
	});
});
