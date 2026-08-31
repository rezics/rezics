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
let projectionMigrationOverlay = "";

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
	[source, aggregateSource, realmSource, projectionMigrationOverlay] = await Promise.all([
		readFile(new URL("./tag-path.sql", import.meta.url), "utf8"),
		readFile(new URL("./tag-judgment-aggregates.sql", import.meta.url), "utf8"),
		readFile(new URL("./realm-tag-authority.sql", import.meta.url), "utf8"),
		readFile(
			new URL("./migration-overlays/tag_public_position_projection.post.sql", import.meta.url),
			"utf8",
		),
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

	it("does not expose projection-maintenance definer functions to PUBLIC", () => {
		expect(source).toContain(
			"REVOKE ALL ON FUNCTION public.enqueue_tag_expression_projection_rebuild(uuid) FROM PUBLIC;",
		);
		expect(source).toContain(
			"REVOKE ALL ON FUNCTION public.rebuild_tag_expression_effective_tags(uuid) FROM PUBLIC;",
		);
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

	it("dual-writes only public and accepted Path threshold transitions", () => {
		const publicPredicate = functionSource("tag_path_unit_is_public");
		expect(publicPredicate).toContain("target_status = 'published'");
		expect(publicPredicate).toContain("target_visibility = 'public'");
		expect(publicPredicate).toContain("target_moderation_status = 'approved'");
		expect(publicPredicate).toContain("target_deleted_at IS NULL");

		const voteProjection = functionSource("maintain_tag_path_vote_stat");
		expect(voteProjection).toContain("old_accepted IS DISTINCT FROM new_accepted");
		expect(voteProjection).toContain("tag_path_unit_is_public");
		expect(voteProjection).toContain("adjust_tag_public_position_stat");

		const publicState = functionSource("maintain_tag_path_public_state");
		expect(publicState).toContain("old_public = new_public");
		expect(publicState).toContain("tag_path_vote:");
		expect(publicState).toContain("score > 0 AND vote_count > 0");
	});

	it("bounds public-position write fan-out and protects hot and negative counters", () => {
		const adjustment = functionSource("adjust_tag_public_position_stat");
		expect(adjustment).toContain("cardinality(target_tag_ids) > 16");
		expect(adjustment).toContain("ORDER BY member.node_id");
		expect(adjustment).toContain("lock_tag_public_position_keys");
		expect(adjustment).toContain("public_position_count < -count_delta");
		expect(adjustment).toContain("tag_public_position_stat_count_check");

		const locking = functionSource("lock_tag_public_position_keys");
		expect(locking).toContain("cardinality(target_tag_ids) > 16");
		expect(locking).toContain("ORDER BY key.tag_id");
		expect(locking).toContain("lock_vote_hot_key");
	});

	it("makes zero-count Tag seeding a proven lifecycle invariant", () => {
		expect(source).toContain("tag_public_position_seed_membership");
		expect(source).toContain("tag_path_concept_lifecycle");
		expect(source).toMatch(/SELECT 1 FROM public\.tag_path_member WHERE node_id = NEW\.id LIMIT 1/);
		expect(source).toMatch(/SELECT 1 FROM public\.tag_path_member WHERE node_id = OLD\.id LIMIT 1/);
	});

	it("initializes existing Tags atomically only while Tag Paths are empty", () => {
		expect(source).not.toContain("backfill_tag_public_position_stats");
		expect(source).not.toContain("read_tag_public_position_projection_drift");
		expect(source).not.toContain("tag_public_position_projection_state");
		expect(source).not.toContain("rezics.tag_public_position_projection_owner");
		expect(projectionMigrationOverlay).toContain("SELECT 1 FROM public.tag_path_member LIMIT 1");
		expect(projectionMigrationOverlay).toContain("SELECT 1 FROM public.tag LIMIT 100001");
		expect(projectionMigrationOverlay).toContain("tag_public_position_atomic_tag_bound");
		expect(projectionMigrationOverlay).toContain(
			"LOCK TABLE public.tag, public.tag_path_member IN SHARE ROW EXCLUSIVE MODE",
		);
		for (const functionName of [
			"tag_path_unit_is_public",
			"lock_tag_public_position_keys",
			"guard_tag_public_position_stat_projection",
			"seed_tag_public_position_stat",
			"guard_tag_path_concept_lifecycle",
			"adjust_tag_public_position_stat",
			"maintain_tag_path_public_state",
			"maintain_tag_path_vote_stat",
		])
			expect(projectionMigrationOverlay).toContain(
				`CREATE OR REPLACE FUNCTION public.${functionName}`,
			);
		expect(projectionMigrationOverlay).not.toContain("guard_tag_expression_mutation");
		expect(projectionMigrationOverlay).toContain(
			"DISABLE TRIGGER tag_public_position_stat_projection_guard",
		);
		expect(projectionMigrationOverlay).toContain(
			"SELECT concept.id FROM public.tag AS concept ORDER BY concept.id",
		);
		expect(projectionMigrationOverlay).toContain(
			"ENABLE TRIGGER tag_public_position_stat_projection_guard",
		);
	});
});
