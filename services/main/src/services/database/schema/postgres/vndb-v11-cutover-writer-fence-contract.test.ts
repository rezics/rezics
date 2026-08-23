import { readFile } from "node:fs/promises";

import { beforeAll, describe, expect, it } from "vitest";

const LegacyFenceTables = [
	"unit_tag",
	"realm_unit_tag",
	"profile_unit_tag",
	"unit_tag_vote",
	"unit_structure",
	"unit_structure_vote",
	"unit_structure_application",
	"unit_structure_application_vote",
	"realm_tag_context",
	"realm_tag_vote",
	"unit_merge_operation",
] as const;

const FinalFenceTables = [
	"unit_tag",
	"realm_unit_tag",
	"profile_unit_tag",
	"unit_tag_judgment",
	"unit_structure",
	"unit_structure_vote",
	"unit_structure_application",
	"unit_structure_application_judgment",
	"realm_tag_context",
	"realm_tag_judgment",
	"unit_merge_operation",
	"entity_measurement",
	"subject_association_judgment",
	"unit_structure_correction",
] as const;

const fenceDeclarationPattern =
	/CREATE TRIGGER vndb_v11_cutover_write_fence\s+BEFORE\s+INSERT\s+OR\s+DELETE\s+OR\s+UPDATE\s+OR\s+TRUNCATE\s+ON\s+public\.([a-z_]+)\s+FOR\s+EACH\s+STATEMENT\s+EXECUTE\s+FUNCTION\s+public\.enforce_vndb_v11_cutover_write_fence\(\);/giu;

let canonicalSource = "";
let prepareSource = "";

beforeAll(async () => {
	[canonicalSource, prepareSource] = await Promise.all([
		readFile(new URL("./vndb-v11-contract.sql", import.meta.url), "utf8"),
		readFile(new URL("./migration-overlays/vndb_v11_prepare.pre.sql", import.meta.url), "utf8"),
	]);
});

function declaredFenceTables(source: string): readonly string[] {
	return [...source.matchAll(fenceDeclarationPattern)]
		.map((match) => match[1])
		.filter((table): table is string => table !== undefined);
}

function functionDeclaration(source: string, name: string): string {
	const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
	if (start < 0) throw new Error(`Missing function ${name}`);
	const end = source.indexOf("\n$$;", start);
	if (end < 0) throw new Error(`Unterminated function ${name}`);
	return source.slice(start, end + 4);
}

describe("VNDB v11 cutover writer-fence contract", () => {
	it("binds the prepare fence to exactly the 11 legacy mutation roots", () => {
		expect(declaredFenceTables(prepareSource)).toEqual(LegacyFenceTables);
	});

	it("binds the fresh-install fence to exactly the 14 canonical mutation roots", () => {
		expect(declaredFenceTables(canonicalSource)).toEqual(FinalFenceTables);
	});

	it("keeps the mapped identities aligned except for the three judgment renames", () => {
		expect(
			LegacyFenceTables.map((table) =>
				table
					.replace("unit_tag_vote", "unit_tag_judgment")
					.replace("unit_structure_application_vote", "unit_structure_application_judgment")
					.replace("realm_tag_vote", "realm_tag_judgment"),
			),
		).toEqual(FinalFenceTables.slice(0, LegacyFenceTables.length));
	});

	it("serializes writes before checking the durable state and final binary identity", () => {
		const declaration = functionDeclaration(
			canonicalSource,
			"enforce_vndb_v11_cutover_write_fence()",
		);
		const sharedLock = declaration.indexOf("pg_advisory_xact_lock_shared(71011001::bigint)");
		const stateRead = declaration.indexOf("FROM public.vndb_v11_cutover_control");

		expect(declaration).toContain("current_setting('transaction_isolation') <> 'read committed'");
		expect(sharedLock).toBeGreaterThan(-1);
		expect(stateRead).toBeGreaterThan(sharedLock);
		expect(declaration).toContain("cutover_state = 'paused'");
		expect(declaration).toContain("cutover_state = 'postcontract_open'");
		expect(declaration).toContain("'vndb-v11-contract-v1'");
	});
});
