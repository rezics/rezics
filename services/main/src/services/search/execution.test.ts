import { beforeEach, describe, expect, it, vi } from "vitest";

const searchDomainFacets = vi.hoisted(() => vi.fn());
const searchGlobalIdentifiers = vi.hoisted(() => vi.fn());
const validateSearchDomainRequest = vi.hoisted(() => vi.fn());

vi.mock("../database", () => ({ database: {} }));
vi.mock("./generation", () => ({
	getActiveSearchGeneration: vi.fn().mockResolvedValue({
		id: "019f7eed-5d42-7102-8387-cc1d13b176d2",
		kind: "current",
		indexUid: "rezics_units_v1_20260804",
		projectionVersion: 1,
		settingsFingerprint: "a".repeat(64),
	}),
}));
vi.mock("./service", () => ({
	searchDomain: vi.fn(),
	searchDomainFacets,
	searchGlobalIdentifiers,
	validateSearchDomainRequest,
}));
vi.mock("./meilisearch", () => ({
	createCandidateSearchContext: vi.fn((generation: { id: string; indexUid: string }) =>
		Promise.resolve({
			generationId: generation.id,
			indexUid: generation.indexUid,
		}),
	),
}));

import { executeCompiledSearchIdentifiers } from "./execution";
import { parseGlobalSearchCursor } from "./query";
import { compileSearchFeatureInput, createDefaultSearchDocument } from "./templates";

describe("globally ranked Search Feed execution", () => {
	beforeEach(() => {
		searchDomainFacets.mockReset();
		searchDomainFacets.mockResolvedValue([]);
		searchGlobalIdentifiers.mockReset();
		validateSearchDomainRequest.mockReset();
	});

	it("uses the full page budget once and carries one global offset in its cursor", async () => {
		const first = "019f7eed-5d42-7102-8387-cc1d13b176d3";
		const second = "019f7eed-5d42-7102-8387-cc1d13b176d4";
		const third = "019f7eed-5d42-7102-8387-cc1d13b176d5";
		searchGlobalIdentifiers
			.mockResolvedValueOnce({
				hits: [{ id: first }, { id: second }],
				total: { value: 4, relation: "lower-bound" },
				offset: 0,
				nextOffset: 3,
				exhausted: false,
				limit: 3,
				processingTimeMs: 1,
			})
			.mockResolvedValueOnce({
				hits: [{ id: third }],
				total: { value: 4, relation: "exact" },
				offset: 3,
				nextOffset: 4,
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

		const result = await executeCompiledSearchIdentifiers(
			compiled.request,
			["zh", "en"],
			undefined,
			compiled.enforcedZoneId,
			compiled.inputIdentity,
		);

		expect(result.hits).toEqual([{ id: first }, { id: second }]);
		expect(result).not.toHaveProperty("groups");
		expect(searchGlobalIdentifiers).toHaveBeenCalledTimes(1);
		expect(searchGlobalIdentifiers).toHaveBeenCalledWith(
			expect.objectContaining({
				limit: 3,
				offset: 0,
				sort: "createdAt:desc",
				branches: compiled.request.categories.map((category) => ({ category })),
			}),
			expect.objectContaining({ indexUid: "rezics_units_v1_20260804" }),
		);
		const cursor = parseGlobalSearchCursor(result.nextCursor ?? "");
		expect(cursor).toMatchObject({ version: 2, pageSize: 3, offset: 3 });

		const nextCompiled = compileSearchFeatureInput(
			{
				document: createDefaultSearchDocument("global"),
				contexts: [],
				injections: [],
				state: {
					pageSize: 3,
					sort: "createdAt:desc",
					cursor: result.nextCursor,
				},
			},
			{ sortProfile: "feed", pageBudget: "global" },
		);
		const nextResult = await executeCompiledSearchIdentifiers(
			nextCompiled.request,
			["zh", "en"],
			undefined,
			nextCompiled.enforcedZoneId,
			nextCompiled.inputIdentity,
		);

		expect(nextResult.hits).toEqual([{ id: third }]);
		expect(nextResult.nextCursor).toBeUndefined();
		expect(searchGlobalIdentifiers).toHaveBeenCalledTimes(2);
		expect(searchGlobalIdentifiers).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ offset: 3, limit: 3, sort: "createdAt:desc" }),
			expect.objectContaining({ indexUid: "rezics_units_v1_20260804" }),
		);
	});
});
