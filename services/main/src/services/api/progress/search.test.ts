import { describe, expect, it } from "vitest";

import {
	createProgressSearchCursor,
	getProgressSearchDefinition,
	resolveProgressSearchRequest,
} from "./search";

describe("progress Search Feature execution boundary", () => {
	it("publishes a query-only schema with four progress-specific sort options", () => {
		const definition = getProgressSearchDefinition();

		expect(definition.controls).toEqual([]);
		expect(definition.document.template.id).toBe("progress");
		expect(definition.document.query.enabled).toBe(true);
		expect(definition.document.sort.search.options).toEqual([
			"progressLastSeenAt:desc",
			"progressLastSeenAt:asc",
			"title:asc",
			"title:desc",
		]);
	});

	it("normalizes Search Feature state and applies the schema default sort", () => {
		expect(
			resolveProgressSearchRequest({
				injections: [],
				state: { filter: { search: { query: "  Dune  " } }, pageSize: 25 },
			}),
		).toEqual(
			expect.objectContaining({
				consumed: 0,
				pageSize: 25,
				query: "Dune",
				sort: "progressLastSeenAt:desc",
			}),
		);
	});

	it("binds opaque cursors to the query, sort, and page size", () => {
		const first = resolveProgressSearchRequest({
			injections: [],
			state: { sort: "title:asc", pageSize: 20 },
		});
		const cursor = createProgressSearchCursor(first, {
			boundary: {
				sortValue: "dune",
				unitId: "0198e6bd-18ff-7760-b9cc-4f74f8bb29bf",
			},
			consumed: 20,
			total: { kind: "lower-bound", value: 21 },
		});

		expect(
			resolveProgressSearchRequest({
				injections: [],
				state: { sort: "title:asc", pageSize: 20, cursor },
			}).boundary,
		).toEqual({
			sortValue: "dune",
			unitId: "0198e6bd-18ff-7760-b9cc-4f74f8bb29bf",
		});
		expect(() =>
			resolveProgressSearchRequest({
				injections: [],
				state: { sort: "title:desc", pageSize: 20, cursor },
			}),
		).toThrow("does not match");
	});

	it("rejects client-authored scope and advanced Search state", () => {
		expect(() =>
			resolveProgressSearchRequest({
				injections: [],
				state: {
					filter: {
						where: { kind: { in: ["book"] } },
					},
				},
			}),
		).toThrow("scope is established by the server");
		expect(() =>
			resolveProgressSearchRequest({
				injections: [
					{
						source: "link",
						removable: false,
						value: {
							controlKey: "kind",
							filter: { field: "kind", operator: "equals", value: "book" },
						},
					},
				],
				state: {},
			}),
		).toThrow();
	});
});
