import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseTransaction } from "../../database";
import type { UnitMergeOperationPhase, UnitMergeGraphPlanV1 } from "../../database/schema";
import { processUnitMergePhase, type UnitMergePhaseResult } from "./phase-handlers";

const sourceUnitId = "019b76da-a800-7300-8000-000000000001";
const targetUnitId = "019b76da-a800-7300-8000-000000000002";
const batchSize = 37;
const graphPlan: UnitMergeGraphPlanV1 = {
	version: 1,
	sourceRole: "standalone",
	targetRole: "standalone",
	sourceMainUnitId: null,
	targetMainUnitId: null,
	destinationMainUnitId: null,
	action: "none",
};

type BatchResponse = { readonly processed: number; readonly remaining: boolean };

async function renderSubjectAssociationPhase(
	phase: Extract<UnitMergeOperationPhase, "subject_sources" | "subject_entities">,
	responses: readonly BatchResponse[] = [{ processed: 0, remaining: false }],
): Promise<{
	readonly execute: ReturnType<typeof vi.fn>;
	readonly results: readonly UnitMergePhaseResult[];
	readonly sql: string;
	readonly params: readonly unknown[];
}> {
	const statements: SQL[] = [];
	let responseIndex = 0;
	const execute = vi.fn(async (statement: SQL) => {
		statements.push(statement);
		const rendered = new PgDialect()
			.sqlToQuery(statement)
			.sql.toLowerCase()
			.replaceAll(/\s+/g, " ");
		if (rendered.includes("as conflict")) return { rows: [{ conflict: false }] };
		if (
			rendered.includes("update content_pack_subject_association_evidence as evidence")
		)
			return { rows: [{ processed: 0 }] };
		if (rendered.includes("exists(select 1 from subject_association"))
			return { rows: [responses[responseIndex++] ?? responses.at(-1)] };
		return { rows: [] };
	});
	const transaction = { execute } as unknown as DatabaseTransaction;
	const results: UnitMergePhaseResult[] = [];
	for (const _response of responses) {
		results.push(
			await processUnitMergePhase(transaction, phase, {
				operationId: "019b76da-a800-7300-8000-000000000003",
				sourceUnitId,
				targetUnitId,
				graphPlan,
				batchSize,
			}),
		);
	}
	const rendered = statements.map((statement) => new PgDialect().sqlToQuery(statement));
	return {
		execute,
		results,
		sql: rendered
			.map((statement) => statement.sql.replace(/\s+/g, " ").trim())
			.join(" "),
		params: rendered.flatMap((statement) => statement.params),
	};
}

describe("Unit merge subject-association judgments", () => {
	it.each([
		["subject_sources", 'where source."unit_id" ='],
		["subject_entities", 'where source."entity_id" ='],
	] as const)(
		"transfers duplicate-association judgments during %s",
		async (phase, sourceFilter) => {
			const query = await renderSubjectAssociationPhase(phase);

			expect(query.sql).toContain(sourceFilter);
			expect(query.sql).toContain("association_to_drain as materialized");
			expect(query.sql).toContain(
				"insert into subject_association_judgment ( association_id, profile_id, spoiler_level, created_at, updated_at )",
			);
			expect(query.sql).toContain("on conflict (association_id, profile_id) do update");
			expect(query.sql).toContain(
				"when excluded.updated_at > subject_association_judgment.updated_at then excluded.spoiler_level else subject_association_judgment.spoiler_level",
			);
			expect(query.sql).toContain("from copied_judgments");
			expect(query.sql).toContain("delete from subject_association_judgment as judgment");
			expect(query.sql).not.toContain("subject_association_judgment_stat");
		},
	);

	it.each([
		["subject_sources", 'set "unit_id" =', 'order by "entity_id", role'],
		["subject_entities", 'set "entity_id" =', 'order by "unit_id", role'],
	] as const)(
		"keeps the no-collision %s path as an in-place association move",
		async (phase, update, batchOrder) => {
			const query = await renderSubjectAssociationPhase(phase);

			expect(query.sql).toContain(update);
			expect(query.sql).toContain(batchOrder);
			expect(query.sql).toContain("from classified");
			expect(query.sql).toContain("and not classified.becomes_self");
			expect(query.sql).toContain("and classified.canonical_id is null");
			expect(query.sql).toContain(
				"where becomes_self or canonical_id is not null order by id limit",
			);
		},
	);

	it("is bounded and retry-idempotent, with the canonical value winning equal timestamps", async () => {
		const query = await renderSubjectAssociationPhase("subject_sources", [
			{ processed: 2, remaining: true },
			{ processed: 0, remaining: false },
		]);

		expect(query.results).toEqual([
			{ processedRows: 2, done: false },
			{ processedRows: 0, done: true },
		]);
		expect(query.execute).toHaveBeenCalledTimes(8);
		expect(query.sql).toContain("order by id limit");
		expect(query.sql).toContain("order by judgment.profile_id limit");
		expect(query.sql).toContain("for update of judgment skip locked");
		expect(query.sql).toContain(
			"and not exists ( select 1 from subject_association_judgment where association_id = classified.id )",
		);
		expect(query.params.filter((parameter) => parameter === batchSize).length).toBeGreaterThanOrEqual(
			4,
		);
	});
});
