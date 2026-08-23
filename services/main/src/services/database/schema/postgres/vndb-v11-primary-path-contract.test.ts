import { readFile } from "node:fs/promises";

import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { beforeAll, describe, expect, it } from "vitest";

import { tagPrimaryDisplayPath, unitStructurePrimaryPathCandidate } from "../structure";

let canonicalSource = "";
let prepareSource = "";
let preContractSource = "";
let postContractSource = "";

const dialect = new PgDialect();

interface SqlStatementSplitterModule {
	readonly splitSqlStatements: (source: string) => readonly string[];
}

function isSqlStatementSplitterModule(value: unknown): value is SqlStatementSplitterModule {
	return (
		typeof value === "object" &&
		value !== null &&
		"splitSqlStatements" in value &&
		typeof value.splitSqlStatements === "function"
	);
}

let splitSqlStatements: SqlStatementSplitterModule["splitSqlStatements"];

function declarationSource(marker: string, terminator: string, source = canonicalSource): string {
	const start = source.indexOf(marker);
	if (start === -1) throw new Error(`Missing SQL declaration ${marker}`);
	const end = source.indexOf(terminator, start);
	if (end === -1) throw new Error(`Unterminated SQL declaration ${marker}`);
	return source.slice(start, end + terminator.length);
}

function functionSource(name: string): string {
	return declarationSource(`CREATE OR REPLACE FUNCTION public.${name}`, "\n$$;");
}

function triggerSource(name: string): string {
	return declarationSource(`CREATE TRIGGER ${name}`, ";");
}

function viewSource(name: string): string {
	return declarationSource(`CREATE OR REPLACE VIEW public.${name}`, "\nCREATE OR REPLACE ");
}

function compactSql(value: string): string {
	return value.replace(/\s+/gu, " ").trim();
}

function rankColumn(column: unknown): { readonly name: string; readonly order: string } {
	if (
		typeof column !== "object" ||
		column === null ||
		!("name" in column) ||
		typeof column.name !== "string" ||
		!("indexConfig" in column) ||
		typeof column.indexConfig !== "object" ||
		column.indexConfig === null ||
		!("order" in column.indexConfig) ||
		typeof column.indexConfig.order !== "string"
	) {
		throw new TypeError("Primary-Path rank index contains a non-column expression");
	}
	return { name: column.name, order: column.indexConfig.order };
}

beforeAll(async () => {
	const splitterModule: unknown = await import(
		new URL("../../../../../scripts/apply-database-migration-overlay.ts", import.meta.url).href
	);
	if (!isSqlStatementSplitterModule(splitterModule))
		throw new TypeError("Migration-overlay module does not export the SQL statement splitter");
	splitSqlStatements = splitterModule.splitSqlStatements;

	[canonicalSource, prepareSource, preContractSource, postContractSource] = await Promise.all([
		readFile(new URL("./vndb-v11-contract.sql", import.meta.url), "utf8"),
		readFile(new URL("./migration-overlays/vndb_v11_prepare.pre.sql", import.meta.url), "utf8"),
		readFile(new URL("./migration-overlays/vndb_v11_contract.pre.sql", import.meta.url), "utf8"),
		readFile(new URL("./migration-overlays/vndb_v11_contract.post.sql", import.meta.url), "utf8"),
	]);
});

describe("versioned primary display Path PostgreSQL contract", () => {
	it("keeps the top-one lookup aligned with the accepted rank index", () => {
		const candidate = getTableConfig(unitStructurePrimaryPathCandidate);
		const rank = candidate.indexes.find(
			(index) => index.config.name === "unit_structure_primary_path_candidate_rank_idx",
		);
		if (!rank?.config.where) throw new Error("Missing partial primary-Path rank index");

		expect(rank.config.columns.map(rankColumn)).toEqual([
			{ name: "final_tag_id", order: "asc" },
			{ name: "wilson_lower_bound", order: "desc" },
			{ name: "score", order: "desc" },
			{ name: "vote_count", order: "desc" },
			{ name: "structure_id", order: "asc" },
			{ name: "projection_version", order: "asc" },
		]);
		expect(dialect.sqlToQuery(rank.config.where).sql).toBe(
			'"unit_structure_primary_path_candidate"."accepted"',
		);

		const display = getTableConfig(tagPrimaryDisplayPath);
		expect(display.primaryKeys).toHaveLength(0);
		expect(display.columns.find(({ name }) => name === "tag_id")?.primary).toBe(true);
		expect(
			display.columns.find(({ name }) => name === "structure_projection_version")?.notNull,
		).toBe(true);
	});

	it("refreshes exactly one active Structure generation with the exact Wilson tuple", () => {
		const refresh = compactSql(functionSource("refresh_unit_structure_primary_path_candidate"));
		expect(refresh).toContain("WHERE structure.id = target_structure_id");
		expect(refresh).toContain(
			"AND structure.active_projection_version = target_projection_version",
		);
		expect(refresh).toContain(
			"WHERE structure_id = target_structure_id AND projection_version = target_projection_version",
		);
		expect(refresh).toContain("active_score > 0 AND active_vote_count > 0");
		expect(refresh).toContain(
			"(active_vote_count::numeric + active_score::numeric) / (2 * active_vote_count::numeric)",
		);
		expect(refresh).toContain("/ (1 + (1.96 * 1.96) / active_vote_count::numeric)");
		expect(refresh).toContain("ON CONFLICT (structure_id, projection_version) DO UPDATE SET");
		expect(
			refresh.match(/INSERT INTO public\.unit_structure_primary_path_candidate/gu),
		).toHaveLength(1);
		expect(refresh).not.toContain("final_tag_id = target_tag_id");
	});

	it("selects one indexed current-generation winner without rebuilding its leaf", () => {
		const refresh = compactSql(functionSource("refresh_tag_primary_display_path"));
		expect(refresh).not.toContain("INSERT INTO public.unit_structure_primary_path_candidate");
		expect(refresh).toContain(
			"FROM public.unit_structure_primary_path_candidate AS candidate JOIN public.unit_structure AS structure ON structure.id = candidate.structure_id AND structure.active_projection_version = candidate.projection_version WHERE candidate.final_tag_id = target_tag_id AND candidate.accepted",
		);
		expect(refresh).toContain(
			"ORDER BY candidate.wilson_lower_bound DESC, candidate.score DESC, candidate.vote_count DESC, candidate.structure_id, candidate.projection_version LIMIT 1",
		);
		expect(refresh).toContain(
			"VALUES (target_tag_id, selected_structure_id, selected_projection_version)",
		);
	});

	it("maintains candidate and display rows from bounded end, vote, and pointer events", () => {
		const endMaintainer = functionSource("maintain_tag_primary_display_path_from_end");
		const voteMaintainer = compactSql(
			functionSource("maintain_tag_primary_display_path_from_vote_stat"),
		);
		const structureMaintainer = functionSource("maintain_tag_primary_display_path_from_structure");

		expect(
			endMaintainer.match(/PERFORM public\.refresh_unit_structure_primary_path_candidate/gu),
		).toHaveLength(1);
		expect(voteMaintainer).toContain(
			"SELECT structure.id, structure.active_projection_version FROM public.unit_structure AS structure WHERE structure.id = ANY(target_structure_ids) ORDER BY structure.id",
		);
		expect(
			voteMaintainer.match(/PERFORM public\.refresh_unit_structure_primary_path_candidate/gu),
		).toHaveLength(1);
		expect(
			voteMaintainer.indexOf("PERFORM public.lock_unit_structure_definition_key"),
		).toBeLessThan(
			voteMaintainer.indexOf("SELECT coalesce( array_agg(DISTINCT structure_end.final_tag_id"),
		);
		expect(
			structureMaintainer.match(/PERFORM public\.refresh_unit_structure_primary_path_candidate/gu),
		).toHaveLength(2);
		expect(structureMaintainer).toContain("OLD.active_projection_version");
		expect(structureMaintainer).toContain("NEW.active_projection_version");
		expect(structureMaintainer).toContain("OLD.member_unit_ids[cardinality(OLD.member_unit_ids)]");
		expect(structureMaintainer).toContain("NEW.member_unit_ids[cardinality(NEW.member_unit_ids)]");

		expect(compactSql(triggerSource("unit_structure_primary_display_maintain"))).toContain(
			"AFTER UPDATE OF member_unit_ids, active_projection_version ON public.unit_structure FOR EACH ROW EXECUTE FUNCTION public.maintain_tag_primary_display_path_from_structure()",
		);
		expect(compactSql(triggerSource("unit_structure_primary_path_candidate_immutable"))).toContain(
			"BEFORE INSERT OR DELETE OR UPDATE ON public.unit_structure_primary_path_candidate FOR EACH ROW EXECUTE FUNCTION public.protect_vndb_projection()",
		);
	});

	it("fails fast instead of waiting on opposing multi-row hot-key orders", () => {
		for (const lockName of [
			"lock_unit_structure_definition_key",
			"lock_tag_primary_display_path_key",
		]) {
			const lock = compactSql(functionSource(lockName));
			expect(lock).toContain("current_setting('transaction_isolation') <> 'read committed'");
			expect(lock).toContain("CONSTRAINT = 'vndb_v11_cutover_read_committed_required'");
			expect(lock).toContain("pg_try_advisory_xact_lock");
			expect(lock).not.toMatch(/(?<!try_)pg_advisory_xact_lock\(/u);
		}

		const prepare = compactSql(prepareSource);
		expect(prepare.match(/pg_try_advisory_xact_lock/gu)?.length).toBeGreaterThanOrEqual(2);
		expect(prepare).toContain("CONSTRAINT = ''vndb_v11_cutover_read_committed_required''");
	});

	it("installs live prepare maintenance and a coalescing delta-drain API", () => {
		const prepare = compactSql(prepareSource);
		expect(splitSqlStatements(prepareSource).length).toBeGreaterThan(40);
		expect(prepare).not.toMatch(
			/\bTRUNCATE TABLE public\.(?:unit_structure_end|unit_structure_primary_path_candidate|tag_primary_display_path)\b/u,
		);
		expect(prepare).toContain(
			"CREATE TABLE public.vndb_v11_primary_path_dirty_key ( key_kind text NOT NULL, key_id uuid NOT NULL, revision bigint DEFAULT 1 NOT NULL",
		);
		expect(prepare).toContain(
			"CONSTRAINT vndb_v11_primary_path_dirty_key_pkey PRIMARY KEY (key_kind, key_id)",
		);
		expect(prepare).toContain(
			"ON CONFLICT (key_kind, key_id) DO UPDATE SET revision = dirty.revision + 1",
		);
		expect(prepare).toContain(
			"CREATE FUNCTION public.refresh_vndb_v11_primary_path_projection( target_structure_id uuid ) RETURNS void",
		);
		expect(prepare).toContain("WHERE structure.id = target_structure_id");
		expect(prepare).toContain(
			"CREATE FUNCTION public.refresh_vndb_v11_primary_path_dirty_key( target_key_kind text, target_key_id uuid ) RETURNS void",
		);
		expect(prepare).toContain(
			"CREATE TRIGGER vndb_v11_primary_path_structure_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_structure",
		);
		expect(prepare).toContain(
			"CREATE TRIGGER unit_structure_vote_stat_primary_path_dirty AFTER INSERT OR DELETE OR UPDATE ON public.unit_structure_vote_stat",
		);
		expect(prepare).toContain(
			"CREATE TRIGGER unit_structure_end_primary_path_dirty AFTER INSERT OR DELETE OR UPDATE ON public.unit_structure_end",
		);

		const contractPre = compactSql(preContractSource);
		const fence = contractPre.indexOf("SELECT pg_catalog.pg_advisory_xact_lock(71011001::bigint)");
		const disable = contractPre.indexOf("DISABLE TRIGGER vndb_v11_primary_path_structure_maintain");
		const firstContractMutation = contractPre.indexOf(
			"ALTER TABLE public.unit_tag_structure_support DROP CONSTRAINT",
		);
		expect(fence).toBeGreaterThanOrEqual(0);
		expect(disable).toBeGreaterThan(fence);
		expect(firstContractMutation).toBeGreaterThan(disable);
		expect(canonicalSource).not.toContain("vndb_v11_primary_path_dirty_key");
	});

	it("filters both candidate and display reads to the active projection generation", () => {
		const candidateView = compactSql(viewSource("current_unit_structure_primary_path_candidate"));
		const displayView = compactSql(viewSource("current_tag_primary_display_path"));
		expect(candidateView).toContain(
			"structure.active_projection_version = candidate.projection_version",
		);
		expect(
			displayView.match(
				/selected_structure\.active_projection_version = (?:primary_path\.structure_projection_version|projection\.target_projection_version)/gu,
			),
		).toHaveLength(2);
	});

	it("requires a paused-epoch proof instead of rebuilding the corpus in contract.post", () => {
		const postContract = compactSql(postContractSource);
		expect(postContract).not.toContain("INSERT INTO public.unit_structure_end");
		expect(postContract).not.toContain("INSERT INTO public.unit_structure_primary_path_candidate");
		expect(postContract).not.toContain("refresh_tag_primary_display_path");
		expect(postContract).toContain(
			"JOIN public.vndb_v11_cutover_verification_checkpoint AS checkpoint",
		);
		expect(postContract).toContain(
			"checkpoint.relation = 'unit_structure_primary_path_projection'",
		);
		expect(postContract).toContain("checkpoint.transition_epoch = control.transition_epoch");
		expect(postContract).toContain("control.state = 'paused'");
		expect(postContract).toContain("CONSTRAINT = 'vndb_v11_primary_path_backfill_incomplete'");
	});
});
