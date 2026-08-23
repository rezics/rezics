import { readFile } from "node:fs/promises";

import { beforeAll, describe, expect, it } from "vitest";

let source = "";

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function functionSource(name: string): string {
	const match = source.match(
		new RegExp(`CREATE OR REPLACE FUNCTION public\\.${escapeRegExp(name)}[\\s\\S]*?\\$\\$;`, "u"),
	);
	if (!match) throw new Error(`Missing SQL function ${name}`);
	return match[0];
}

function triggerSource(name: string): string {
	const match = source.match(new RegExp(`CREATE TRIGGER ${escapeRegExp(name)}[\\s\\S]*?;`, "u"));
	if (!match) throw new Error(`Missing SQL trigger ${name}`);
	return match[0].replace(/\s+/gu, " ");
}

beforeAll(async () => {
	source = await readFile(new URL("./content-pack-import.sql", import.meta.url), "utf8");
});

describe("content-pack import PostgreSQL guard contract", () => {
	it("makes the import ledger and non-movable evidence fully immutable", () => {
		for (const table of [
			"content_pack_import",
			"content_pack_tag_evidence",
			"content_pack_structure_definition_evidence",
		]) {
			const trigger = triggerSource(`${table}_immutable`);
			expect(trigger).toContain(`BEFORE UPDATE OR DELETE OR TRUNCATE ON public.${table}`);
			expect(trigger).toContain("FOR EACH STATEMENT");
			expect(trigger).toContain(
				"EXECUTE FUNCTION public.reject_content_pack_import_evidence_mutation()",
			);
		}
	});

	it("makes movable evidence append-only outside guarded updates", () => {
		for (const table of [
			"content_pack_unit_tag_evidence",
			"content_pack_structure_application_evidence",
			"content_pack_subject_association_evidence",
		]) {
			const trigger = triggerSource(`${table}_delete_guard`);
			expect(trigger).toContain(`BEFORE DELETE OR TRUNCATE ON public.${table}`);
			expect(trigger).toContain("FOR EACH STATEMENT");
		}
	});

	it("requires a processing operation with the transaction-local lease token", () => {
		const guard = functionSource("require_content_pack_evidence_merge_operation");
		expect(guard).toContain("current_setting('rezics.unit_merge_operation_id', true)");
		expect(guard).toContain("current_setting('rezics.unit_merge_lease_token', true)");
		expect(guard).toContain("operation.state = 'processing'::public.unit_merge_operation_state");
		expect(guard).toContain("operation.lease_token = active_lease_token");
		expect(guard).toContain("operation.lease_expires_at > clock_timestamp()");
		expect(guard).toContain("active_operation.phase = ANY(allowed_phases)");
	});

	it.each([
		{
			table: "content_pack_unit_tag_evidence",
			functionName: "guard_content_pack_unit_tag_evidence_retarget",
			allowedKey: "unit_id",
			phase: "unit_tags",
			judgmentTable: "unit_tag_judgment",
		},
		{
			table: "content_pack_structure_application_evidence",
			functionName: "guard_content_pack_structure_application_evidence_retarget",
			allowedKey: "unit_id",
			phase: "structure_applications",
			judgmentTable: "unit_structure_application_judgment",
		},
	])(
		"permits only $allowedKey retargets for $table during $phase/finalize",
		({ table, functionName, allowedKey, phase, judgmentTable }) => {
			const trigger = triggerSource(`${table}_retarget_guard`);
			expect(trigger).toContain(`AFTER UPDATE ON public.${table}`);
			expect(trigger).toContain("REFERENCING OLD TABLE AS old_evidence NEW TABLE AS new_evidence");
			expect(trigger).toContain("FOR EACH STATEMENT");

			const guard = functionSource(functionName);
			expect(guard).toContain(`'${phase}'::public.unit_merge_operation_phase`);
			expect(guard).toContain("'finalize'::public.unit_merge_operation_phase");
			expect(guard).toContain("FULL JOIN new_evidence AS new_row");
			expect(guard).toContain(`to_jsonb(old_row) - '${allowedKey}'`);
			expect(guard).toContain(`to_jsonb(new_row) - '${allowedKey}'`);
			expect(guard).toContain("old_row.unit_id <> active_operation.source_unit_id");
			expect(guard).toContain("new_row.unit_id <> active_operation.target_unit_id");
			expect(guard.match(new RegExp(`FROM public\\.${judgmentTable}`, "gu"))).toHaveLength(2);
		},
	);

	it("proves Subject-association identity mapping and both judgments before retargeting", () => {
		const table = "content_pack_subject_association_evidence";
		const trigger = triggerSource(`${table}_retarget_guard`);
		expect(trigger).toContain(`AFTER UPDATE ON public.${table}`);
		expect(trigger).toContain("REFERENCING OLD TABLE AS old_evidence NEW TABLE AS new_evidence");

		const guard = functionSource("guard_content_pack_subject_association_evidence_retarget");
		expect(guard).toContain("to_jsonb(old_row) - 'association_id'");
		expect(guard).toContain("to_jsonb(new_row) - 'association_id'");
		expect(guard).toContain("'subject_sources'::public.unit_merge_operation_phase");
		expect(guard).toContain("'subject_entities'::public.unit_merge_operation_phase");
		expect(guard).toContain("'finalize'::public.unit_merge_operation_phase");
		expect(guard).toContain("source_association.unit_id = active_operation.source_unit_id");
		expect(guard).toContain("target_association.unit_id = active_operation.target_unit_id");
		expect(guard).toContain("source_association.entity_id = active_operation.source_unit_id");
		expect(guard).toContain("target_association.entity_id = active_operation.target_unit_id");
		expect(guard).toContain("source_association.role = target_association.role");
		expect(guard.match(/FROM public\.subject_association_judgment/gu)).toHaveLength(2);
	});
});
