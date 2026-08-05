import { beforeEach, describe, expect, it, vi } from "vitest";

const searchDomainFacets = vi.hoisted(() => vi.fn());
const searchGlobalIdentifiers = vi.hoisted(() => vi.fn());
const validateSearchDomainRequest = vi.hoisted(() => vi.fn());

vi.mock("../database", () => ({ database: {} }));
vi.mock("./service", () => ({
	searchDomain: vi.fn(),
	searchDomainFacets,
	searchGlobalIdentifiers,
	validateSearchDomainRequest,
}));

import { executeCompiledSearchIdentifiers } from "./execution";
import { parseGlobalSearchCursor } from "./query";
import { compileSearchFeatureInput, createDefaultSearchDocument } from "./templates";

describe("globally ranked PostgreSQL Search execution", () => {
	beforeEach(() => {
		searchDomainFacets.mockReset().mockResolvedValue([]);
		searchGlobalIdentifiers.mockReset();
		validateSearchDomainRequest.mockReset();
	});

	it("uses one global page budget and carries the authoritative keyset", async () => {
		const first = "019f7eed-5d42-7102-8387-cc1d13b176d3";
		const position = { primary: "1720000000", secondary: "0", unitId: first } as const;
		searchGlobalIdentifiers.mockResolvedValueOnce({
			hits: [{ id: first }],
			total: { kind: "lower-bound", value: 2 },
			offset: 0,
			nextOffset: 1,
			exhausted: false,
			nextPosition: position,
			limit: 3,
			processingTimeMs: 1,
		});
		const compiled = compileSearchFeatureInput(
			{
				document: createDefaultSearchDocument("global"),
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

		expect(searchGlobalIdentifiers).toHaveBeenCalledWith(
			expect.objectContaining({
				limit: 3,
				offset: 0,
				sort: "createdAt:desc",
				branches: compiled.request.categories.map((category) => ({ category })),
			}),
		);
		const cursor = parseGlobalSearchCursor(result.nextCursor ?? "");
		expect(cursor).toMatchObject({ version: 2, pageSize: 3, seen: 1, position });
	});

	it("does not produce a cursor for an exhausted result", async () => {
		searchGlobalIdentifiers.mockResolvedValueOnce({
			hits: [],
			total: { kind: "exact", value: 0 },
			offset: 0,
			nextOffset: 0,
			exhausted: true,
			limit: 3,
			processingTimeMs: 1,
		});
		const compiled = compileSearchFeatureInput(
			{
				document: createDefaultSearchDocument("global"),
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
});
