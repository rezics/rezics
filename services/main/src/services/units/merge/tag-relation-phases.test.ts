import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DatabaseTransaction } from "../../database";
import { fractionalPositionByteLength, isFractionalPosition } from "../../ordering/position";
import type { UnitMergeGraphPlanV1, UnitMergeOperationPhase } from "../../database/schema";
import { processUnitMergePhase } from "./phase-handlers";

const SourceUnitId = "019f7eed-5d42-7102-8387-cc1d13b176d2";
const TargetUnitId = "019f7eed-5d42-7102-8387-cc1d13b176d3";
const OperationId = "019f7eed-5d42-7102-8387-cc1d13b176d4";
const GraphPlan = {
	version: 1,
	sourceRole: "standalone",
	targetRole: "standalone",
	sourceMainUnitId: null,
	targetMainUnitId: null,
	destinationMainUnitId: null,
	action: "none",
} as const satisfies UnitMergeGraphPlanV1;

const execute = vi.fn(async (_statement: SQL) => ({
	rows: [{ processed: 1, remaining: false }],
}));
const Transaction = { execute } as unknown as DatabaseTransaction;
const Dialect = new PgDialect();

async function phaseSql(
	phase: Extract<UnitMergeOperationPhase, "unit_tags" | "realm_unit_tags" | "profile_unit_tags">,
): Promise<string> {
	await processUnitMergePhase(Transaction, phase, {
		operationId: OperationId,
		sourceUnitId: SourceUnitId,
		targetUnitId: TargetUnitId,
		graphPlan: GraphPlan,
		batchSize: 64,
	});
	const statements = execute.mock.calls.map(([statement]) => statement);
	if (!statements.length) throw new Error(`Unit merge phase ${phase} executed no SQL`);
	return statements
		.map((statement) => Dialect.sqlToQuery(statement).sql.toLowerCase().replaceAll(/\s+/g, " "))
		.join(" ");
}

describe("Unit merge Tag-relation convergence", () => {
	beforeEach(() => {
		execute.mockClear();
	});

	it("preserves author or platform attribution and pinned curation when the target has no Unit Tag", async () => {
		const query = await phaseSql("unit_tags");

		expect(query).toContain("batch.tag_id, batch.created_by_profile_id, batch.pinned, case");
		expect(query).toContain(
			"else batch.position end, batch.created_at, batch.updated_at from batch",
		);
		expect(query).not.toContain("false, null, created_at, updated_at");
	});

	it("keeps an existing author or platform Unit Tag unchanged on a canonical-key collision", async () => {
		const query = await phaseSql("unit_tags");

		expect(query).toContain("on conflict (unit_id, tag_id) do nothing");
		expect(query).toContain(
			"select 1 from unit_tag as target where target.unit_id = $2::uuid and target.tag_id = source.tag_id",
		);
		expect(query).not.toContain("set updated_at = greatest(unit_tag.updated_at");
		expect(query).toContain("delete from unit_tag as relation using batch");
	});

	it("rebases only a different pinned Tag's position collision to a deterministic valid token", async () => {
		const query = await phaseSql("unit_tags");
		const TagId = "019f7eed-5d42-7102-8387-cc1d13b176d5";
		const collisionPosition = `a0${OperationId.replaceAll("-", "")}${SourceUnitId.replaceAll(
			"-",
			"",
		)}${TagId.replaceAll("-", "")}V`;

		expect(query).toContain("target_position.position = batch.position");
		expect(query).toContain("target_position.tag_id <> batch.tag_id");
		expect(query).toMatch(
			/then 'a0' \|\| replace\(\$\d+::text, '-', ''\) \|\| replace\(\$\d+::text, '-', ''\) \|\| replace\(batch\.tag_id::text, '-', ''\) \|\| 'v'/u,
		);
		expect(fractionalPositionByteLength(collisionPosition)).toBe(99);
		expect(isFractionalPosition(collisionPosition)).toBe(true);
	});

	it.each([
		{
			phase: "profile_unit_tags" as const,
			conflict: "on conflict (profile_id, unit_id, tag_id) do nothing",
			preserved: "select profile_id, $3::uuid, tag_id, position, created_at, updated_at from batch",
			delete: "delete from profile_unit_tag as relation using ensured_targets",
		},
		{
			phase: "realm_unit_tags" as const,
			conflict: "on conflict (realm_id, unit_id, tag_id) do nothing",
			preserved:
				"select realm_id, $3::uuid, tag_id, position, created_by_profile_id, created_at, updated_at from batch",
			delete: "delete from realm_unit_tag as relation using ensured_targets",
		},
	])(
		"moves an existing legacy fact exactly in $phase while the target fact wins collisions",
		async (input) => {
			const query = await phaseSql(input.phase);

			expect(query).toContain(input.preserved);
			expect(query).toContain(input.conflict);
			expect(query).toContain(input.delete);
		},
	);
});
