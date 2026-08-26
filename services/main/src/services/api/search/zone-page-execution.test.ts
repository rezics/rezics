import {
	createZoneBlockExecutionPlan,
	type BlockPath,
	type DockDocument,
	type UnitReferencedBlock,
	type UnitReferencedBlockDocument,
} from "@rezics/block";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../database", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../database")>();
	return {
		...actual,
		withDatabaseTransactionDeadline: async <Result>(
			_maximumMilliseconds: number,
			work: () => Promise<Result>,
		): Promise<Result> => work(),
	};
});

import { Authorization } from "../../authorization";
import { InvalidSearch } from "../../search/errors";
import {
	executeZonePageAggregate,
	selectZonePageBlockExecutions,
	type ZonePageAggregateExecutors,
	type ZonePageExecutionSurface,
} from "./zone-page-execution";

const ZoneId = "019b0000-0000-7000-8000-000000000001";
const PageId = "019b0000-0000-7000-8000-000000000002";
const RevisionId = "019b0000-0000-7000-8000-000000000003";

type UnitList = Extract<UnitReferencedBlock, { readonly _type: "unit-list" }>;

function unitList(key: string): UnitList {
	return {
		_type: "unit-list",
		_key: key,
		source: { kind: "search", feature: { kind: "global" } },
		layout: "list",
		limit: 20,
	};
}

function document(blocks: readonly UnitReferencedBlock[]): UnitReferencedBlockDocument {
	return { _type: "block-document", _key: "000000000001", blocks: [...blocks] };
}

function executionSurface(blocks: readonly UnitReferencedBlock[]): ZonePageExecutionSurface {
	const pageDocument = document(blocks);
	return {
		page: {
			id: PageId,
			zoneId: ZoneId,
			slug: "home",
			home: true,
			placement: null,
			language: "en",
			title: "Home",
			document: pageDocument,
			localizations: [],
			latestUnitRevisionId: RevisionId,
			createdAt: new Date("2026-08-26T00:00:00.000Z"),
			updatedAt: new Date("2026-08-26T00:00:00.000Z"),
		},
		plan: createZoneBlockExecutionPlan({ page: pageDocument }),
	};
}

function successfulExecutors(
	delayMilliseconds = 0,
	onActive?: (active: number) => void,
): ZonePageAggregateExecutors {
	let active = 0;
	return {
		executeSearch: vi.fn(async () => {
			active += 1;
			onActive?.(active);
			if (delayMilliseconds > 0)
				await new Promise((resolve) => setTimeout(resolve, delayMilliseconds));
			active -= 1;
			return {
				groups: [{ hits: [], total: { kind: "exact" as const, value: 0 } }],
			};
		}),
		executeFeed: vi.fn(async () => ({
			items: [],
			total: { kind: "exact" as const, value: 0 },
		})),
	};
}

describe("Zone Page aggregate selection", () => {
	it("selects equal local paths independently on Page and Dock surfaces", () => {
		const sharedPath: BlockPath = [{ slot: "blocks", key: "100000000001" }];
		const pageDocument = document([unitList("100000000001")]);
		const dockDocument: DockDocument = {
			_type: "dock-document",
			_key: "000000000002",
			blocks: [unitList("100000000001")],
		};
		const plan = createZoneBlockExecutionPlan({ page: pageDocument, dock: dockDocument });

		const selection = selectZonePageBlockExecutions(plan, {
			page: [{ path: sharedPath }],
			dock: [{ path: sharedPath }],
		});

		expect(selection.selected.map(({ descriptor }) => descriptor.surface)).toEqual([
			"page",
			"dock",
		]);
	});

	it("rejects duplicate requests within one surface and unknown paths", () => {
		const path: BlockPath = [{ slot: "blocks", key: "100000000001" }];
		const plan = createZoneBlockExecutionPlan({
			page: document([unitList("100000000001")]),
		});

		expect(() => selectZonePageBlockExecutions(plan, { page: [{ path }, { path }] })).toThrow(
			"requested more than once",
		);
		expect(() =>
			selectZonePageBlockExecutions(plan, {
				page: [{ path: [{ slot: "blocks", key: "900000000001" }] }],
			}),
		).toThrow("is not executable");
	});
});

describe("Zone Page aggregate execution isolation", () => {
	it("isolates one Block failure while preserving deterministic result order", async () => {
		const surface = executionSurface([
			unitList("200000000001"),
			unitList("200000000002"),
			unitList("200000000003"),
		]);
		const selection = selectZonePageBlockExecutions(surface.plan, {});
		const executors = successfulExecutors();
		const executeSearch = vi.mocked(executors.executeSearch);
		executeSearch.mockImplementation(async ({ descriptor }) => {
			if (descriptor.block._key === "200000000002")
				throw new InvalidSearch("isolated invalid state");
			return { groups: [{ hits: [], total: { kind: "exact", value: 0 } }] };
		});

		const result = await executeZonePageAggregate({
			surface,
			...selection,
			authorization: new Authorization(undefined),
			localizationLanguages: ["en"],
			executors,
		});

		expect(result.page.results.map(({ path }) => path[0]?.key)).toEqual([
			"200000000001",
			"200000000002",
			"200000000003",
		]);
		expect(result.page.results.map(({ outcome }) => outcome.kind)).toEqual(["ok", "error", "ok"]);
		expect(result.page.results[1]?.outcome).toEqual({
			kind: "error",
			code: "InvalidSearch",
		});
	});

	it("bounds concurrent Block work to four workers", async () => {
		const blocks = Array.from({ length: 8 }, (_, index) =>
			unitList(`3${index.toString().padStart(11, "0")}`),
		);
		const surface = executionSurface(blocks);
		const selection = selectZonePageBlockExecutions(surface.plan, {});
		let maximumActive = 0;
		const executors = successfulExecutors(15, (active) => {
			maximumActive = Math.max(maximumActive, active);
		});

		const result = await executeZonePageAggregate({
			surface,
			...selection,
			authorization: new Authorization(undefined),
			localizationLanguages: ["en"],
			executors,
		});

		expect(result.page.results).toHaveLength(8);
		expect(executors.executeSearch).toHaveBeenCalledTimes(8);
		expect(maximumActive).toBeGreaterThan(0);
		expect(maximumActive).toBeLessThanOrEqual(4);
	});
});
