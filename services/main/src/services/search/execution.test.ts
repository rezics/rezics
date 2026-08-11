import { beforeEach, describe, expect, it, vi } from "vitest";

const searchDomainFacets = vi.hoisted(() => vi.fn());
const searchGlobalIdentifiersWithFacets = vi.hoisted(() => vi.fn());
const validateSearchDomainRequest = vi.hoisted(() => vi.fn());

vi.mock("../database", () => ({ database: {} }));
vi.mock("./service", () => ({
	searchDomain: vi.fn(),
	searchDomainFacets,
	searchDomainWithFacets: vi.fn(),
	searchGlobalIdentifiersWithFacets,
	validateSearchDomainRequest,
}));

import { executeCompiledSearchIdentifiers } from "./execution";
import { parseGlobalSearchCursor } from "./query";
import { compileSearchFeatureInput } from "./filter-document";

describe("globally ranked PostgreSQL Search execution", () => {
	beforeEach(() => {
		searchDomainFacets.mockReset().mockResolvedValue([]);
		searchGlobalIdentifiersWithFacets.mockReset();
		validateSearchDomainRequest.mockReset();
	});

	it("uses one global page budget and carries the authoritative keyset", async () => {
		const first = "019f7eed-5d42-7102-8387-cc1d13b176d3";
		const position = { primary: "1720000000", secondary: "0", unitId: first } as const;
		searchGlobalIdentifiersWithFacets.mockResolvedValueOnce({
			page: {
				hits: [{ id: first }],
				total: { kind: "lower-bound", value: 2 },
				offset: 0,
				nextOffset: 1,
				exhausted: false,
				nextPosition: position,
				limit: 3,
				processingTimeMs: 1,
			},
			facetGroups: [],
		});
		const compiled = compileSearchFeatureInput(
			{
				filterDocument: {},
				contexts: [],
				injections: [],
				state: { pageSize: 3, sort: "createdAt:desc" },
			},
			{ sortProfile: "feed", pageBudget: "global" },
		);

		const result = await executeCompiledSearchIdentifiers(
			compiled.plan,
			["zh", "en"],
			undefined,
			compiled.enforcedZoneId,
			compiled.inputIdentity,
		);

		expect(searchGlobalIdentifiersWithFacets).toHaveBeenCalledWith(
			expect.objectContaining({
				limit: 3,
				offset: 0,
				sort: "createdAt:desc",
				branches: compiled.request.categories.map((category) => ({ category })),
			}),
			expect.any(Array),
		);
		expect(searchDomainFacets).not.toHaveBeenCalled();
		const cursor = parseGlobalSearchCursor(result.nextCursor ?? "");
		expect(cursor).toMatchObject({ version: 3, pageSize: 3, seen: 1, position });
	});

	it("does not produce a cursor for an exhausted result", async () => {
		searchGlobalIdentifiersWithFacets.mockResolvedValueOnce({
			page: {
				hits: [],
				total: { kind: "exact", value: 0 },
				offset: 0,
				nextOffset: 0,
				exhausted: true,
				limit: 3,
				processingTimeMs: 1,
			},
			facetGroups: [],
		});
		const compiled = compileSearchFeatureInput(
			{
				filterDocument: {},
				contexts: [],
				injections: [],
				state: { pageSize: 3, sort: "createdAt:desc" },
			},
			{ sortProfile: "feed", pageBudget: "global" },
		);
		const result = await executeCompiledSearchIdentifiers(compiled.plan, ["en"]);
		expect(result.nextCursor).toBeUndefined();
		expect(result.total).toEqual({ kind: "exact", value: 0 });
	});

	it("continues after a bounded scan that returned no hits", async () => {
		const position = {
			primary: "1720000000",
			secondary: "0",
			unitId: "019f7eed-5d42-7102-8387-cc1d13b176d3",
			source: "ordered" as const,
		};
		searchGlobalIdentifiersWithFacets.mockResolvedValueOnce({
			page: {
				hits: [],
				total: { kind: "lower-bound", value: 0 },
				offset: 0,
				nextOffset: 0,
				exhausted: false,
				nextPosition: position,
				limit: 3,
				processingTimeMs: 1,
			},
			facetGroups: [],
		});
		const compiled = compileSearchFeatureInput(
			{
				filterDocument: {},
				contexts: [],
				injections: [],
				state: { pageSize: 3, sort: "createdAt:desc" },
			},
			{ sortProfile: "feed", pageBudget: "global" },
		);

		const result = await executeCompiledSearchIdentifiers(compiled.plan, ["en"]);

		expect(parseGlobalSearchCursor(result.nextCursor ?? "")).toMatchObject({
			seen: 0,
			position,
		});
		expect(result.total).toEqual({ kind: "lower-bound", value: 0 });
	});

	it("continues the global keyset beyond the former 200-result window", async () => {
		const filterDocument = {};
		let cursor: string | undefined;

		for (let pageIndex = 0; pageIndex < 5; pageIndex += 1) {
			const hits = Array.from({ length: 50 }, (_, itemIndex) => ({
				id: `019f7eed-5d42-7102-8387-${(pageIndex * 50 + itemIndex + 1)
					.toString(16)
					.padStart(12, "0")}`,
			}));
			const last = hits.at(-1);
			if (!last) throw new Error("Expected a non-empty Search page fixture");
			const nextOffset = (pageIndex + 1) * 50;
			const position = {
				primary: String(1_720_000_000 - nextOffset),
				secondary: "0",
				unitId: last.id,
			} as const;
			searchGlobalIdentifiersWithFacets.mockResolvedValueOnce({
				page: {
					hits,
					total: { kind: "lower-bound", value: nextOffset + 1 },
					offset: pageIndex * 50,
					nextOffset,
					exhausted: false,
					nextPosition: position,
					limit: 50,
					processingTimeMs: 1,
				},
				facetGroups: [],
			});
			const compiled = compileSearchFeatureInput(
				{
					filterDocument,
					contexts: [],
					injections: [],
					state: {
						pageSize: 50,
						sort: "createdAt:desc",
						...(cursor ? { cursor } : {}),
					},
				},
				{ sortProfile: "feed", pageBudget: "global" },
			);

			const result = await executeCompiledSearchIdentifiers(
				compiled.plan,
				["en"],
				undefined,
				compiled.enforcedZoneId,
				compiled.inputIdentity,
			);
			cursor = result.nextCursor;
			expect(cursor).toBeDefined();
		}

		expect(parseGlobalSearchCursor(cursor ?? "")).toMatchObject({ seen: 250 });
		expect(searchGlobalIdentifiersWithFacets).toHaveBeenLastCalledWith(
			expect.objectContaining({ limit: 50, offset: 200 }),
			expect.any(Array),
		);
	});
});
