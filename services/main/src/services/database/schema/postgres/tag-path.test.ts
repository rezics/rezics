import { readFile } from "node:fs/promises";

import { beforeAll, describe, expect, it } from "vitest";

import {
	TagExpressionMaximumActiveInferenceRules,
	TagExpressionMaximumEffectiveTags,
	TagExpressionMaximumReachableExpressions,
} from "../tag-expression";

let source = "";
let aggregateSource = "";
let realmSource = "";

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

beforeAll(async () => {
	[source, aggregateSource, realmSource] = await Promise.all([
		readFile(new URL("./tag-path.sql", import.meta.url), "utf8"),
		readFile(new URL("./tag-judgment-aggregates.sql", import.meta.url), "utf8"),
		readFile(new URL("./realm-tag-authority.sql", import.meta.url), "utf8"),
	]);
});

describe("Tag Path PostgreSQL semantic contract", () => {
	it("keeps Path projection structural and derives Unit evidence only from Expressions", () => {
		const projection = functionSource("project_tag_path_definition");
		expect(projection).toContain(
			"tag_path_member(path_id, ordinal, node_id, incoming_relation_id)",
		);
		expect(projection).not.toContain("support");
		expect(projection).not.toContain("display");

		const assertion = functionSource("maintain_unit_application_expression");
		expect(assertion).toContain("refresh_unit_expression_assertion");
		expect(assertion).toContain("SELECT expression_id INTO target_expression_id");
	});

	it("serializes and cycle-checks both definition graphs", () => {
		const relations = functionSource("guard_tag_relation_graph");
		expect(relations).toContain("pg_advisory_xact_lock");
		expect(relations).toContain("WITH RECURSIVE descendant");
		expect(relations).toContain("tag_relation_cycle");

		const inference = functionSource("guard_tag_expression_inference_graph");
		expect(inference).toContain("pg_advisory_xact_lock");
		expect(inference).toContain("WITH RECURSIVE descendant");
		expect(inference).toContain("WITH RECURSIVE ancestor");
		expect(inference).toContain("tag_expression_inference_cycle");
	});

	it("mirrors hard inference work bounds in schema constants and SQL guards", () => {
		const inference = functionSource("guard_tag_expression_inference_graph");
		expect(inference).toContain(`active_rule_count >= ${TagExpressionMaximumActiveInferenceRules}`);
		expect(inference).toContain(`descendant_count > ${TagExpressionMaximumReachableExpressions}`);
		expect(inference).toContain(`ancestor_count > ${TagExpressionMaximumReachableExpressions}`);

		const closure = functionSource("rebuild_tag_expression_effective_tags");
		expect(closure).toContain(`LIMIT ${TagExpressionMaximumEffectiveTags + 1}`);
		expect(closure).toContain(`effective_tag_count > ${TagExpressionMaximumEffectiveTags}`);
		expect(closure).toContain("ARRAY[$1, rule.target_expression_id]");
		expect(closure).toContain("SELECT $1, tag_id, evidence_kind FROM strongest");
		expect(closure).not.toContain("SELECT target_expression_id, tag_id");
	});

	it("queues bounded downstream projection work when a definition closure changes", () => {
		const enqueue = functionSource("enqueue_tag_expression_projection_rebuild");
		expect(enqueue).toContain("unit_expression_assertion");
		expect(enqueue).toContain("realm_unit_expression_assertion");
		expect(enqueue).toContain("ON CONFLICT (expression_id) DO UPDATE");
		expect(enqueue).toContain("global_cursor_unit_id = NULL");

		const closure = functionSource("rebuild_tag_expression_effective_tags");
		expect(closure).toContain("enqueue_tag_expression_projection_rebuild");
	});

	it("branches before reading table-specific fields in the shared closure trigger", () => {
		const trigger = functionSource("maintain_tag_expression_inference_closure");
		expect(trigger).toContain("IF TG_TABLE_NAME = 'tag_expression' THEN");
		expect(trigger).toContain("ELSIF TG_TABLE_NAME = 'tag_expression_inference_rule' THEN");
		expect(trigger).toContain("changed_expression_id := NEW.id");
		expect(trigger).toContain("changed_expression_id := NEW.source_expression_id");
		expect(trigger).not.toContain("changed_expression_id uuid := CASE");
	});

	it("allows new Applications only from active sealed Senses", () => {
		const guard = functionSource("guard_unit_tag_path_application");
		expect(guard).toContain("scope = 'global'");
		expect(guard).toContain("status = 'active'");
		expect(guard).toContain("sealed_at IS NOT NULL");
	});

	it("keeps accepted historical Applications effective after Sense retirement", () => {
		for (const projection of [aggregateSource, realmSource]) {
			const start = projection.indexOf("accepted_application_count");
			const end = projection.indexOf("IF direct_exists OR accepted_application_count", start);
			const applicationRead = projection.slice(start, end);
			expect(applicationRead).toContain("sense.sealed_at IS NOT NULL");
			expect(applicationRead).not.toContain("sense.status = 'active'");
		}
	});
});
