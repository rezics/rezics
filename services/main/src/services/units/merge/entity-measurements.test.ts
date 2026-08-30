import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import { UnitMergeMeasurementConflict } from "../../api/governance/errors";
import type { DatabaseTransaction } from "../../database";
import {
	isEntityMeasurementMergePhase,
	processEntityMeasurementMergeBatch,
	processEntityMeasurementPreflightBatch,
	requireEntityMeasurementsMergeable,
} from "./entity-measurements";
import {
	isTerminalUnitMergeExecutionFailure,
	unitMergeFailureTransition,
	unitMergeYieldTransition,
} from "./worker";

const SourceUnitId = "019f80b1-b42a-7c34-8b8b-f7cb85fa1201";
const TargetUnitId = "019f80b1-b42a-7c34-8b8b-f7cb85fa1202";
const OperationId = "019f80b1-b42a-7c34-8b8b-f7cb85fa1203";
const BatchSize = 2;
const Dialect = new PgDialect();

function render(statement: SQL): string {
	return Dialect.sqlToQuery(statement).sql.toLowerCase().replaceAll(/\s+/g, " ").trim();
}

function transactionWithRows(rows: ReadonlyArray<ReadonlyArray<Record<string, unknown>>>) {
	const statements: SQL[] = [];
	let index = 0;
	const execute = vi.fn(async (statement: SQL) => {
		statements.push(statement);
		return { rows: rows[index++] ?? [] };
	});
	return {
		statements,
		transaction: { execute } as unknown as DatabaseTransaction,
	};
}

describe("lossless Entity measurement merge", () => {
	it.each([
		"entity_measurement_preflight",
		"entity_measurement_entities",
		"entity_measurement_contexts",
	] as const)("recognizes %s as part of the durable measurement freeze", (phase) => {
		expect(isEntityMeasurementMergePhase(phase)).toBe(true);
	});

	it("does not extend the measurement freeze into unrelated convergence", () => {
		expect(isEntityMeasurementMergePhase("variant_graph")).toBe(false);
	});

	it.each([
		"entity_measurement_preflight",
		"entity_measurement_entities",
		"entity_measurement_contexts",
	] as const)("keeps %s frozen during transient retry backoff", (phase) => {
		const now = new Date("2026-08-24T00:00:00.000Z");
		const retryAt = new Date("2026-08-24T00:01:00.000Z");

		expect(
			unitMergeFailureTransition({
				phase,
				terminal: false,
				now,
				retryAt,
				leaseToken: OperationId,
			}),
		).toEqual({
			state: "processing",
			availableAt: retryAt,
			leaseToken: OperationId,
			leaseExpiresAt: retryAt,
		});
	});

	it("releases unrelated transient failures into retry_wait", () => {
		const now = new Date("2026-08-24T00:00:00.000Z");
		const retryAt = new Date("2026-08-24T00:01:00.000Z");

		expect(
			unitMergeFailureTransition({
				phase: "variant_graph",
				terminal: false,
				now,
				retryAt,
				leaseToken: OperationId,
			}),
		).toEqual({
			state: "retry_wait",
			availableAt: retryAt,
			leaseToken: null,
			leaseExpiresAt: null,
		});
	});

	it("clears a terminal measurement cursor so manual retry must preflight from zero", () => {
		const now = new Date("2026-08-24T00:00:00.000Z");

		expect(
			unitMergeFailureTransition({
				phase: "entity_measurement_contexts",
				terminal: true,
				now,
				retryAt: now,
				leaseToken: OperationId,
			}),
		).toEqual({
			state: "failed",
			phase: "entity_measurement_preflight",
			measurementPreflightCursorEntityId: null,
			availableAt: now,
			leaseToken: null,
			leaseExpiresAt: null,
		});
	});

	it("publishes an immediately reclaimable processing lease at a bounded measurement yield", () => {
		const now = new Date("2026-08-24T00:00:00.000Z");

		expect(
			unitMergeYieldTransition({
				phase: "entity_measurement_contexts",
				now,
				leaseToken: OperationId,
			}),
		).toEqual({
			state: "processing",
			availableAt: now,
			leaseToken: OperationId,
			leaseExpiresAt: now,
		});
	});

	it("releases an unrelated bounded yield to pending", () => {
		const now = new Date("2026-08-24T00:00:00.000Z");

		expect(
			unitMergeYieldTransition({
				phase: "variant_graph",
				now,
				leaseToken: OperationId,
			}),
		).toEqual({
			state: "pending",
			availableAt: now,
			leaseToken: null,
			leaseExpiresAt: null,
		});
	});

	it.each([0, -1, 1.5, 501, Number.NaN])(
		"rejects an unsafe runtime batch size (%s) before issuing SQL",
		async (batchSize) => {
			const { transaction, statements } = transactionWithRows([]);

			await expect(
				processEntityMeasurementPreflightBatch(transaction, {
					operationId: OperationId,
					sourceUnitId: SourceUnitId,
					targetUnitId: TargetUnitId,
					batchSize,
				}),
			).rejects.toThrow(RangeError);
			expect(statements).toHaveLength(0);
		},
	);

	it.each([
		{
			row: { selfContext: true, entityCollision: false, targetContextualCount: 0 },
			reason: "self_context",
		},
		{
			row: { selfContext: false, entityCollision: true, targetContextualCount: 0 },
			reason: "differing_collision",
		},
		{
			row: { selfContext: false, entityCollision: false, targetContextualCount: 9 },
			reason: "context_limit",
		},
	] as const)("rejects $reason before accepting a bounded Entity-side rewrite", async (input) => {
		const { transaction } = transactionWithRows([[input.row]]);

		await expect(
			requireEntityMeasurementsMergeable(transaction, {
				sourceUnitId: SourceUnitId,
				targetUnitId: TargetUnitId,
				sourceIsEntity: true,
			}),
		).rejects.toMatchObject({
			type: "UnitMergeMeasurementConflict",
			details: { reason: input.reason },
		});
	});

	it("advances a durable keyset cursor without mutating measurement rows", async () => {
		const firstEntityId = "019f80b1-b42a-7c34-8b8b-f7cb85fa1210";
		const secondEntityId = "019f80b1-b42a-7c34-8b8b-f7cb85fa1211";
		const thirdEntityId = "019f80b1-b42a-7c34-8b8b-f7cb85fa1212";
		const { transaction, statements } = transactionWithRows([
			[],
			[{ selfContext: false, entityCollision: false, targetContextualCount: 0 }],
			[{ cursorEntityId: firstEntityId }],
			[
				{ entityId: secondEntityId, selfContext: false, differingCollision: false },
				{ entityId: thirdEntityId, selfContext: false, differingCollision: false },
			],
			[{ id: OperationId }],
		]);

		await expect(
			processEntityMeasurementPreflightBatch(transaction, {
				operationId: OperationId,
				sourceUnitId: SourceUnitId,
				targetUnitId: TargetUnitId,
				batchSize: 1,
			}),
		).resolves.toEqual({ processedRows: 1, done: false });

		const sql = statements.map(render).join(" ");
		expect(sql).toContain("source.context_unit_id =");
		expect(sql).toContain("source.entity_id >");
		expect(sql).toContain("order by source.entity_id limit");
		expect(sql).toContain("set measurement_preflight_cursor_entity_id =");
		expect(sql).not.toContain("update entity_measurement");
		expect(sql).not.toContain("delete from entity_measurement");
	});

	it("blocks a late context collision before convergence changes any row", async () => {
		const { transaction, statements } = transactionWithRows([
			[],
			[{ selfContext: false, differingCollision: true, targetContextualCount: 0 }],
		]);

		await expect(
			processEntityMeasurementMergeBatch(
				transaction,
				{
					operationId: OperationId,
					sourceUnitId: SourceUnitId,
					targetUnitId: TargetUnitId,
					batchSize: BatchSize,
				},
				"context_unit_id",
			),
		).rejects.toMatchObject({
			type: "UnitMergeMeasurementConflict",
			details: { reason: "differing_collision" },
		});

		expect(statements.map(render).join(" ")).not.toContain("update entity_measurement");
		expect(statements.map(render).join(" ")).not.toContain("delete from entity_measurement");
	});

	it.each(["entity_id", "context_unit_id"] as const)(
		"deduplicates only an exact sourced fact during %s convergence",
		async (direction) => {
			const { transaction, statements } = transactionWithRows([
				[],
				[{ selfContext: false, differingCollision: false, targetContextualCount: 0 }],
				[{ processed: 2, remaining: false }],
			]);

			await expect(
				processEntityMeasurementMergeBatch(
					transaction,
					{
						operationId: OperationId,
						sourceUnitId: SourceUnitId,
						targetUnitId: TargetUnitId,
						batchSize: BatchSize,
					},
					direction,
				),
			).resolves.toEqual({ processedRows: 2, done: true });

			const convergence = render(statements.at(-1)!);
			for (const field of [
				"height_millimetres",
				"weight_grams",
				"bust_millimetres",
				"waist_millimetres",
				"hips_millimetres",
				"source_url",
				"source_imported_at",
				"source_provenance",
			])
				expect(convergence).toContain(`"batch".${field}`);
			expect(convergence).toContain("is not distinct from row");
			expect(convergence).toContain("delete from entity_measurement as source using duplicates");
			expect(convergence).toContain("and not exists ( select 1 from duplicates");
		},
	);

	it("treats evidence conflicts as terminal worker failures", () => {
		expect(
			isTerminalUnitMergeExecutionFailure(
				new UnitMergeMeasurementConflict({ reason: "differing_collision" }),
			),
		).toBe(true);
		expect(isTerminalUnitMergeExecutionFailure({ type: "UnitMergeMeasurementConflict" })).toBe(
			true,
		);
		expect(isTerminalUnitMergeExecutionFailure(new Error("transient"))).toBe(false);
	});
});
