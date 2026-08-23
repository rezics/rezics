import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseTransaction } from "../../database";
import type { UnitMergeGraphPlanV1, UnitMergeOperationPhase } from "../../database/schema";
import { processUnitMergePhase } from "./phase-handlers";

const SourceUnitId = "019f8f41-888f-763b-a4f8-66f7075b51c1";
const TargetUnitId = "019f8f41-888f-763b-a4f8-66f7075b51c2";
const OperationId = "019f8f41-888f-763b-a4f8-66f7075b51c3";
const BatchSize = 41;
const GraphPlan = {
	version: 1,
	sourceRole: "standalone",
	targetRole: "standalone",
	sourceMainUnitId: null,
	targetMainUnitId: null,
	destinationMainUnitId: null,
	action: "none",
} as const satisfies UnitMergeGraphPlanV1;

type RenderedStatement = {
	readonly params: readonly unknown[];
	readonly sql: string;
};

async function capturePhase(
	phase: Extract<UnitMergeOperationPhase, "unit_tags" | "realm_tag_judgments">,
): Promise<{
	readonly result: { readonly done: boolean; readonly processedRows: number };
	readonly statements: readonly RenderedStatement[];
}> {
	const dialect = new PgDialect();
	const statements: RenderedStatement[] = [];
	const execute = vi.fn(async (statement: SQL) => {
		const rendered = dialect.sqlToQuery(statement);
		statements.push({
			params: rendered.params,
			sql: rendered.sql.toLowerCase().replaceAll(/\s+/g, " ").trim(),
		});
		return { rows: [{ processed: 0, remaining: false }] };
	});
	const result = await processUnitMergePhase({ execute } as unknown as DatabaseTransaction, phase, {
		operationId: OperationId,
		sourceUnitId: SourceUnitId,
		targetUnitId: TargetUnitId,
		graphPlan: GraphPlan,
		batchSize: BatchSize,
	});
	return { result, statements };
}

function requireStatement(
	statements: readonly RenderedStatement[],
	fragment: string,
): RenderedStatement {
	const statement = statements.find(({ sql }) => sql.includes(fragment));
	if (!statement) throw new Error(`Expected a merge statement containing ${fragment}`);
	return statement;
}

function expectGlobalAdmission(statement: RenderedStatement): void {
	expect(statement.sql).toContain(
		"admission as materialized ( select public.lock_vndb_vote_hot_keys(",
	);
	for (const column of ["unit_id", "tag_id", "profile_id"] as const) {
		expect(statement.sql).toContain(
			`array_agg(hot_keys.${column} order by hot_keys.unit_id, hot_keys.tag_id, hot_keys.profile_id)`,
		);
	}
	expect(statement.sql).toContain("cross join (values");
	expect(statement.sql).toContain("as affected(unit_id)");
	expect(statement.params).toContain(SourceUnitId);
	expect(statement.params).toContain(TargetUnitId);
}

describe("Unit merge VNDB hot-key pre-admission", () => {
	it("pre-admits every bounded global source and target key before Tag and judgment mutations", async () => {
		const captured = await capturePhase("unit_tags");
		const unitTagCopy = requireStatement(captured.statements, "insert into unit_tag (");
		const judgmentStatements = captured.statements.filter(({ sql }) =>
			sql.includes("insert into unit_tag_judgment ("),
		);
		expect(judgmentStatements).toHaveLength(2);
		const judgmentCopy = judgmentStatements.find(
			({ sql }) => !sql.includes("delete from unit_tag_judgment"),
		);
		const judgmentDrain = judgmentStatements.find(({ sql }) =>
			sql.includes("delete from unit_tag_judgment"),
		);
		if (!judgmentCopy || !judgmentDrain)
			throw new Error("Expected both Unit-Tag judgment copy and drain statements");

		for (const statement of [unitTagCopy, judgmentCopy, judgmentDrain])
			expectGlobalAdmission(statement);

		expect(unitTagCopy.sql).toContain(
			"select distinct affected.unit_id, batch.tag_id, null::uuid as profile_id",
		);
		expect(unitTagCopy.sql).toContain("order by tag_id limit");
		expect(unitTagCopy.sql).toContain("for update skip locked");
		expect(unitTagCopy.sql).toContain("from batch cross join admission on conflict");

		expect(judgmentCopy.sql).toContain(
			"select distinct affected.unit_id, vote_batch.tag_id, vote_batch.profile_id",
		);
		expect(judgmentCopy.sql).toContain("order by vote.tag_id, vote.profile_id limit");
		expect(judgmentCopy.sql).toContain("for update of vote skip locked");
		expect(judgmentCopy.sql).toContain("from vote_batch cross join admission on conflict");

		expect(judgmentDrain.sql).toContain(
			"select affected.unit_id, batch.tag_id, null::uuid as profile_id",
		);
		expect(judgmentDrain.sql).toContain(
			"union select affected.unit_id, vote_batch.tag_id, vote_batch.profile_id",
		);
		expect(judgmentDrain.sql).toContain("for update of source skip locked");
		expect(judgmentDrain.sql).toContain("for update of vote skip locked");
		expect(judgmentDrain.sql).toContain("from vote_batch cross join admission on conflict");
		expect(judgmentDrain.sql).toContain("using vote_batch, admission");
		expect(judgmentDrain.sql).toContain("using batch, admission");
		expect(captured.result).toEqual({ processedRows: 0, done: true });
	});

	it("pre-admits the sorted Realm source and target keyset before copy and delete", async () => {
		const captured = await capturePhase("realm_tag_judgments");
		const statement = requireStatement(captured.statements, "insert into realm_tag_judgment (");

		expect(statement.sql).toContain(
			"select distinct batch.realm_id, affected.unit_id, batch.tag_id",
		);
		expect(statement.sql).toContain(
			"admission as materialized ( select public.lock_realm_tag_judgment_keys(",
		);
		for (const column of ["realm_id", "unit_id", "tag_id"] as const) {
			expect(statement.sql).toContain(
				`array_agg(hot_keys.${column} order by hot_keys.realm_id, hot_keys.unit_id, hot_keys.tag_id)`,
			);
		}
		expect(statement.sql).toContain("cross join (values");
		expect(statement.sql).toContain("as affected(unit_id)");
		expect(statement.params).toContain(SourceUnitId);
		expect(statement.params).toContain(TargetUnitId);
		expect(statement.params).toContain(BatchSize);
		expect(statement.sql).toContain("order by realm_id, tag_id, profile_id limit");
		expect(statement.sql).toContain("for update skip locked");
		expect(statement.sql).toContain("from batch cross join admission on conflict");
		expect(statement.sql).toContain("using batch, admission");
		expect(statement.sql.indexOf("admission as materialized")).toBeLessThan(
			statement.sql.indexOf("insert into realm_tag_judgment"),
		);
		expect(captured.result).toEqual({ processedRows: 0, done: true });
	});
});
