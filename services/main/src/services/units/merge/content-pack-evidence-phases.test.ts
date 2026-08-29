import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseTransaction } from "../../database";
import type { UnitMergeGraphPlanV1, UnitMergeOperationPhase } from "../../database/schema";
import {
	processUnitMergePhase,
	UnitMergeEvidenceConflict,
	type UnitMergePhaseResult,
} from "./phase-handlers";
import { isTerminalUnitMergeExecutionFailure } from "./worker";

const SourceUnitId = "019f7eed-5d42-7102-8387-cc1d13b176d2";
const TargetUnitId = "019f7eed-5d42-7102-8387-cc1d13b176d3";
const OperationId = "019f7eed-5d42-7102-8387-cc1d13b176d4";
const BatchSize = 500;
const GraphPlan = {
	version: 1,
	sourceRole: "standalone",
	targetRole: "standalone",
	sourceMainUnitId: null,
	targetMainUnitId: null,
	destinationMainUnitId: null,
	action: "none",
} as const satisfies UnitMergeGraphPlanV1;
const Dialect = new PgDialect();

function render(statement: SQL): string {
	return Dialect.sqlToQuery(statement).sql.toLowerCase().replaceAll(/\s+/g, " ");
}

async function capturePhase(
	phase: Extract<
		UnitMergeOperationPhase,
		"unit_tags" | "tag_path_applications" | "subject_sources" | "subject_entities"
	>,
	evidenceProcessed = 1,
): Promise<{ readonly result: UnitMergePhaseResult; readonly statements: readonly string[] }> {
	const statements: string[] = [];
	const execute = vi.fn(async (statement: SQL) => {
		const query = render(statement);
		statements.push(query);
		if (query.includes("as conflict")) return { rows: [{ conflict: false }] };
		if (query.includes("update content_pack_") && query.includes("as evidence set"))
			return { rows: [{ processed: evidenceProcessed }] };
		if (query.includes(" as remaining")) return { rows: [{ processed: 0, remaining: false }] };
		return { rows: [] };
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

function expectOrdered(
	statements: readonly string[],
	targetJudgment: string,
	evidenceUpdate: string,
	sourceDelete: string,
): void {
	const targetIndex = statements.findIndex((query) => query.includes(targetJudgment));
	const evidenceIndex = statements.findIndex((query) => query.includes(evidenceUpdate));
	const deleteIndex = statements.findIndex((query) => query.includes(sourceDelete));
	expect(targetIndex).toBeGreaterThanOrEqual(0);
	expect(evidenceIndex).toBeGreaterThan(targetIndex);
	expect(deleteIndex).toBeGreaterThan(evidenceIndex);
	expect(statements[evidenceIndex]).toContain("limit");
	expect(statements[evidenceIndex]).toContain("for update of evidence skip locked");
}

describe("Content-pack evidence convergence during Unit merge", () => {
	it("retargets Unit-Tag evidence after the target judgment and before guarded deletion", async () => {
		const captured = await capturePhase("unit_tags");
		expect(captured.result).toEqual({ processedRows: 1, done: true });
		expectOrdered(
			captured.statements,
			"insert into unit_tag_judgment",
			"update content_pack_unit_tag_evidence as evidence set unit_id =",
			"delete from unit_tag_judgment as vote",
		);
		const allSql = captured.statements.join(" ");
		expect(allSql).toContain(
			"not exists ( select 1 from content_pack_unit_tag_evidence as evidence",
		);
		expect(allSql).not.toContain("set source_fit_vote =");
		expect(allSql).not.toContain("set source_aggregate =");
	});

	it("retargets Unit–Path Application evidence after the target judgment", async () => {
		const captured = await capturePhase("tag_path_applications");
		expect(captured.result).toEqual({ processedRows: 1, done: true });
		expectOrdered(
			captured.statements,
			"insert into unit_tag_path_application_judgment",
			"update content_pack_unit_tag_path_application_evidence as evidence set unit_id =",
			"delete from unit_tag_path_application_judgment as vote",
		);
		expect(captured.statements.join(" ")).toContain(
			"not exists ( select 1 from content_pack_unit_tag_path_application_evidence as evidence",
		);
		const evidenceSql = captured.statements.find((query) =>
			query.includes("update content_pack_unit_tag_path_application_evidence"),
		);
		expect(evidenceSql).toContain("application_id = batch.target_application_id");
	});

	it.each(["subject_sources", "subject_entities"] as const)(
		"retargets only the canonical Subject association identity during %s",
		async (phase) => {
			const captured = await capturePhase(phase);
			expect(captured.result).toEqual({ processedRows: 1, done: true });
			expectOrdered(
				captured.statements,
				"insert into subject_association_judgment",
				"update content_pack_subject_association_evidence as evidence set association_id =",
				"delete from subject_association_judgment as judgment",
			);
			const evidenceSql = captured.statements.find((query) =>
				query.includes("update content_pack_subject_association_evidence"),
			);
			expect(evidenceSql).not.toContain("source_spoiler_level =");
			expect(evidenceSql).not.toContain("source_url =");
		},
	);

	it("is an exact no-op after evidence and source relations are drained", async () => {
		const captured = await capturePhase("unit_tags", 0);
		expect(captured.result).toEqual({ processedRows: 0, done: true });
	});

	it("fails before mutation when a self Subject association has evidence", async () => {
		const statements: string[] = [];
		const execute = vi.fn(async (statement: SQL) => {
			statements.push(render(statement));
			return { rows: [{ conflict: true }] };
		});
		await expect(
			processUnitMergePhase({ execute } as unknown as DatabaseTransaction, "subject_sources", {
				operationId: OperationId,
				sourceUnitId: SourceUnitId,
				targetUnitId: TargetUnitId,
				graphPlan: GraphPlan,
				batchSize: BatchSize,
			}),
		).rejects.toMatchObject({
			_tag: "UnitMergeEvidenceConflict",
			reason: "subject_self_association",
		});
		expect(statements).toHaveLength(1);
		expect(
			isTerminalUnitMergeExecutionFailure(
				new UnitMergeEvidenceConflict("subject_self_association"),
			),
		).toBe(true);
	});
});
