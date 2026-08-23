import { readFile } from "node:fs/promises";

import { getTableConfig } from "drizzle-orm/pg-core";
import { beforeAll, describe, expect, it } from "vitest";

import { realmTagJudgment } from "../tag";

let canonicalSource = "";

function declarationSource(marker: string, terminator: string): string {
	const start = canonicalSource.indexOf(marker);
	if (start === -1) throw new Error(`Missing SQL declaration ${marker}`);
	const end = canonicalSource.indexOf(terminator, start);
	if (end === -1) throw new Error(`Unterminated SQL declaration ${marker}`);
	return canonicalSource.slice(start, end + terminator.length);
}

function functionSource(name: string): string {
	return declarationSource(`CREATE OR REPLACE FUNCTION public.${name}`, "\n$$;");
}

function triggerSource(name: string): string {
	return declarationSource(`CREATE TRIGGER ${name}`, ";");
}

function compactSql(value: string): string {
	return value.replace(/\s+/gu, " ").trim();
}

beforeAll(async () => {
	canonicalSource = await readFile(new URL("./vndb-v11-contract.sql", import.meta.url), "utf8");
});

describe("VNDB v11 direct-Tag and Entity-measurement guards", () => {
	it("serializes direct applicability with every direct mutation surface", () => {
		const applicationGuard = compactSql(functionSource("guard_direct_tag_application_policy"));
		expect(applicationGuard).toContain("LANGUAGE plpgsql VOLATILE");
		expect(applicationGuard).toContain("current_setting('transaction_isolation')");
		expect(applicationGuard).toContain(
			"SELECT directly_applicable INTO is_directly_applicable FROM public.tag WHERE id = NEW.tag_id FOR SHARE",
		);

		const transitionGuard = compactSql(functionSource("guard_tag_directly_applicable_transition"));
		for (const relation of ["unit_tag", "realm_unit_tag", "profile_unit_tag", "realm_tag_judgment"])
			expect(transitionGuard).toContain(`SELECT 1 FROM public.${relation} WHERE tag_id = NEW.id`);
		expect(transitionGuard).toContain("CONSTRAINT = 'tag_directly_applicable_in_use'");

		const realmJudgmentTagRoute = getTableConfig(realmTagJudgment).indexes.find(
			({ config }) => config.name === "realm_tag_judgment_tag_route_idx",
		);
		if (!realmJudgmentTagRoute) throw new Error("Missing Realm judgment tag-route index");
		expect(realmJudgmentTagRoute.config.columns[0]).toMatchObject({ name: "tag_id" });

		for (const [trigger, relation] of [
			["unit_tag_application_policy_guard", "unit_tag"],
			["realm_unit_tag_application_policy_guard", "realm_unit_tag"],
			["profile_unit_tag_application_policy_guard", "profile_unit_tag"],
			["realm_tag_judgment_application_policy_guard", "realm_tag_judgment"],
		] as const)
			expect(compactSql(triggerSource(trigger))).toContain(
				`BEFORE INSERT OR UPDATE ON public.${relation} FOR EACH ROW EXECUTE FUNCTION public.guard_direct_tag_application_policy()`,
			);
		expect(compactSql(triggerSource("realm_tag_judgment_content_label_reject"))).toContain(
			"BEFORE INSERT OR UPDATE ON public.realm_tag_judgment FOR EACH ROW EXECUTE FUNCTION public.reject_content_label_judgment()",
		);
	});

	it("maps platform content-label failures to their exact mutation contracts", () => {
		const guard = compactSql(functionSource("guard_platform_content_label_unit_tag"));
		expect(guard).toContain("ERRCODE = '23514', CONSTRAINT = 'content_label_platform_identity'");
		expect(guard).toContain("WHEN 'INSERT' THEN 'content_label_platform_apply'");
		expect(guard).toContain("WHEN 'DELETE' THEN 'content_label_platform_remove'");
		expect(guard).toContain("ELSE 'content_label_platform_identity'");
		for (const action of ["content_label.apply", "content_label.replace", "content_label.remove"])
			expect(guard).toContain(`'${action}'`);
		expect(guard).not.toContain("content_label_platform_governance");
	});

	it("rejects fixed content-label registry Units from either Unit-merge endpoint", () => {
		const guard = compactSql(functionSource("guard_content_label_unit_merge"));
		for (const id of [
			"019b76da-a800-7370-8000-000000000001",
			"019b76da-a800-7370-8000-000000000002",
			"019b76da-a800-7370-8000-000000000003",
			"019b76da-a800-7370-8000-000000000004",
		])
			expect(guard).toContain(`'${id}'::uuid`);
		expect(guard).toContain("NEW.source_unit_id = ANY(registry_ids)");
		expect(guard).toContain("NEW.target_unit_id = ANY(registry_ids)");
		expect(guard).toContain("CONSTRAINT = 'content_label_unit_merge_rejected'");
		expect(compactSql(triggerSource("unit_merge_operation_content_label_guard"))).toContain(
			"BEFORE INSERT OR UPDATE OF source_unit_id, target_unit_id ON public.unit_merge_operation FOR EACH ROW EXECUTE FUNCTION public.guard_content_label_unit_merge()",
		);
	});

	it("freezes every Entity-measurement mutation and admits only exact leased moves", () => {
		const guard = compactSql(functionSource("guard_entity_measurement"));
		expect(guard).toContain("current_setting('rezics.unit_merge_operation_id', true)");
		expect(guard).toContain("current_setting('rezics.unit_merge_lease_token', true)");
		expect(guard).toContain("operation.lease_expires_at > clock_timestamp()");
		for (const phase of [
			"entity_measurement_preflight",
			"entity_measurement_entities",
			"entity_measurement_contexts",
		])
			expect(guard).toContain(`'${phase}'::public.unit_merge_operation_phase`);
		expect(guard).toContain("pg_advisory_xact_lock_shared(");
		expect(guard).toContain("ORDER BY endpoint.unit_id");
		expect(guard).toContain("CONSTRAINT = 'entity_measurement_merge_frozen'");
		expect(guard).toContain("CONSTRAINT = 'entity_measurement_merge_mutation_invalid'");
		expect(guard).toContain("CONSTRAINT = 'entity_measurement_identity_immutable'");
		expect(guard).toContain("CONSTRAINT = 'entity_measurement_context_limit'");
		expect(guard).toContain("FROM public.entity_measurement AS target_measurement");
		expect(guard).toContain(
			"ARRAY['entity_id', 'context_unit_id', 'created_at', 'updated_at']::text[]",
		);
		expect(compactSql(triggerSource("entity_measurement_guard"))).toContain(
			"BEFORE INSERT OR DELETE OR UPDATE ON public.entity_measurement",
		);
	});

	it("publishes processing measurement phases behind sorted exclusive endpoint locks", () => {
		const insertPrepare = compactSql(functionSource("prepare_entity_measurement_merge_freeze"));
		expect(insertPrepare).toContain("FROM new_operation AS operation");
		expect(insertPrepare).toContain(
			"operation.state = 'processing'::public.unit_merge_operation_state",
		);
		expect(insertPrepare).toContain("ORDER BY endpoint.unit_id");
		expect(insertPrepare).toContain("PERFORM pg_advisory_xact_lock(");

		const insertTrigger = compactSql(
			triggerSource("unit_merge_operation_entity_measurement_freeze_insert_prepare"),
		);
		expect(insertTrigger).toContain("AFTER INSERT ON public.unit_merge_operation");
		expect(insertTrigger).toContain("REFERENCING NEW TABLE AS new_operation");
		expect(insertTrigger).toContain(
			"FOR EACH STATEMENT EXECUTE FUNCTION public.prepare_entity_measurement_merge_freeze()",
		);

		const updatePrepare = compactSql(
			functionSource("prepare_entity_measurement_merge_freeze_update"),
		);
		expect(updatePrepare).toContain("JOIN old_operation AS previous_operation");
		expect(updatePrepare).toContain(
			"previous_operation.state IS DISTINCT FROM 'processing'::public.unit_merge_operation_state",
		);
		expect(updatePrepare).toContain("previous_operation.phase NOT IN (");
		expect(updatePrepare).toContain(
			"ROW( operation.source_unit_id, operation.target_unit_id, operation.phase, operation.lease_token, operation.lease_expires_at ) IS DISTINCT FROM ROW(",
		);
		expect(updatePrepare).toContain("previous_operation.lease_expires_at");
		expect(updatePrepare).not.toContain("processed_rows");
		expect(updatePrepare).not.toContain("measurement_preflight_cursor_entity_id");
		expect(updatePrepare).toContain("ORDER BY endpoint.unit_id");
		expect(updatePrepare).toContain("PERFORM pg_advisory_xact_lock(");

		const updateTrigger = compactSql(
			triggerSource("unit_merge_operation_entity_measurement_freeze_update_prepare"),
		);
		expect(updateTrigger).toContain("AFTER UPDATE ON public.unit_merge_operation");
		expect(updateTrigger).toContain(
			"REFERENCING OLD TABLE AS old_operation NEW TABLE AS new_operation",
		);
		expect(updateTrigger).toContain(
			"FOR EACH STATEMENT EXECUTE FUNCTION public.prepare_entity_measurement_merge_freeze_update()",
		);
	});
});
