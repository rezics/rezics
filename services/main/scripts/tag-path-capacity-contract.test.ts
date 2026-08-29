import { describe, expect, it } from "vitest";

import {
	assertBoundedPostgreSqlPlan,
	decodePostgreSqlExplainPlan,
	requireDisposableTagPathDatabase,
	summarizeLatencies,
} from "./tag-path-capacity-contract";

function plan(
	root: Readonly<Record<string, unknown>>,
): ReturnType<typeof decodePostgreSqlExplainPlan> {
	return decodePostgreSqlExplainPlan([
		{
			"Execution Time": 1,
			"Planning Time": 0.2,
			Plan: {
				"Shared Hit Blocks": 4,
				"Shared Read Blocks": 1,
				...root,
			},
		},
	]);
}

describe("Tag Path capacity contract", () => {
	it("allows only explicitly marked loopback rezics_atlas targets", () => {
		expect(
			requireDisposableTagPathDatabase({
				confirmation: true,
				connectionString: "postgres://postgres:secret@127.0.0.1:5433/rezics_atlas",
				marker: "tag-path-capacity-v2",
			}),
		).toContain("rezics_atlas");
		for (const connectionString of [
			"postgres://postgres:secret@database.internal/rezics_atlas",
			"postgres://postgres:secret@localhost/rezics",
		])
			expect(() =>
				requireDisposableTagPathDatabase({
					confirmation: true,
					connectionString,
					marker: "tag-path-capacity-v2",
				}),
			).toThrow();
	});

	it("requires routed indexes and rejects corpus scans, unbounded sorts, and excess IO", () => {
		const bounded = plan({
			"Node Type": "Index Scan",
			"Index Name": "tag_path_member_node_path_idx",
			"Relation Name": "tag_path_member",
		});
		expect(
			assertBoundedPostgreSqlPlan({
				name: "hierarchy",
				plan: bounded,
				requiredIndexes: ["tag_path_member_node_path_idx"],
				requiredIndexAlternatives: [
					["tag_path_member_node_path_idx", "tag_path_member_relation_idx"],
				],
				corpusRelations: ["tag_path_member"],
				maximumSharedBlocks: 8,
			}).indexNames,
		).toContain("tag_path_member_node_path_idx");
		const popularTagKeyset = plan({
			"Node Type": "Index Scan",
			"Index Name": "tag_path_member_pkey",
			"Relation Name": "tag_path_member",
		});
		expect(
			assertBoundedPostgreSqlPlan({
				name: "popular Tag hierarchy",
				plan: popularTagKeyset,
				requiredIndexes: [],
				requiredIndexAlternatives: [["tag_path_member_node_path_idx", "tag_path_member_pkey"]],
				corpusRelations: ["tag_path_member"],
				maximumSharedBlocks: 8,
			}).indexNames,
		).toContain("tag_path_member_pkey");
		expect(() =>
			assertBoundedPostgreSqlPlan({
				name: "missing alternatives",
				plan: bounded,
				requiredIndexes: [],
				requiredIndexAlternatives: [
					[
						"unit_tag_path_application_unit_position_idx",
						"realm_unit_tag_path_application_unit_route_idx",
					],
				],
				corpusRelations: ["tag_path_member"],
				maximumSharedBlocks: 8,
			}),
		).toThrow(/accepted routing index/);
		expect(() =>
			assertBoundedPostgreSqlPlan({
				name: "missing route",
				plan: bounded,
				requiredIndexes: ["tag_path_member_relation_idx"],
				corpusRelations: ["tag_path_member"],
				maximumSharedBlocks: 8,
			}),
		).toThrow(/required routing index/);
		expect(() =>
			assertBoundedPostgreSqlPlan({
				name: "scan",
				plan: plan({ "Node Type": "Seq Scan", "Relation Name": "tag_path_member" }),
				requiredIndexes: [],
				corpusRelations: ["tag_path_member"],
				maximumSharedBlocks: 8,
			}),
		).toThrow(/sequentially scanned/);
		expect(() =>
			assertBoundedPostgreSqlPlan({
				name: "sort",
				plan: plan({
					"Node Type": "Sort",
					"Sort Method": "quicksort",
					"Actual Rows": 50,
					Plans: [{ "Node Type": "Index Scan", "Actual Rows": 51, "Actual Loops": 1 }],
				}),
				requiredIndexes: [],
				corpusRelations: [],
				maximumSharedBlocks: 8,
				maximumSortRows: 50,
			}),
		).toThrow(/unbounded sort/);
		expect(
			assertBoundedPostgreSqlPlan({
				name: "small fixture sort",
				plan: plan({
					"Node Type": "Sort",
					"Sort Method": "quicksort",
					"Actual Rows": 49,
					Plans: [{ "Node Type": "Index Scan", "Actual Rows": 49, "Actual Loops": 1 }],
				}),
				requiredIndexes: [],
				corpusRelations: [],
				maximumSharedBlocks: 8,
				maximumSortRows: 50,
			}).sorts,
		).toEqual([{ actualRows: 49, inputRows: 49, method: "quicksort" }]);
		expect(
			assertBoundedPostgreSqlPlan({
				name: "incremental unique-key sort",
				plan: plan({
					"Node Type": "Incremental Sort",
					"Actual Rows": 50,
					Plans: [{ "Node Type": "Index Scan", "Actual Rows": 50, "Actual Loops": 1 }],
				}),
				requiredIndexes: [],
				corpusRelations: [],
				maximumSharedBlocks: 8,
				maximumSortRows: 50,
			}).sorts,
		).toEqual([{ actualRows: 50, inputRows: 50, method: "incremental sort" }]);
		expect(() =>
			assertBoundedPostgreSqlPlan({
				name: "IO",
				plan: bounded,
				requiredIndexes: [],
				corpusRelations: [],
				maximumSharedBlocks: 4,
			}),
		).toThrow(/shared blocks/);
	});

	it("reports deterministic latency percentiles", () => {
		expect(summarizeLatencies([10, 1, 2, 4, 3])).toEqual({
			count: 5,
			maximumMilliseconds: 10,
			p50Milliseconds: 3,
			p95Milliseconds: 10,
			p99Milliseconds: 10,
		});
	});
});
