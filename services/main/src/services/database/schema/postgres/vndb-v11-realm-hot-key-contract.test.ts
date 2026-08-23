import { readFile } from "node:fs/promises";

import { beforeAll, describe, expect, it } from "vitest";

import { PostgreSqlSchemaFunctionNames, PostgreSqlSchemaTriggers } from "./manifest";

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

describe("Realm judgment hot-key admission PostgreSQL contract", () => {
	it("locks distinct OLD and NEW Realm keys in deterministic tuple order", () => {
		const preparer = compactSql(functionSource("prepare_realm_tag_judgment_hot_key"));

		expect(preparer).toContain("target_realm_ids := ARRAY[OLD.realm_id, NEW.realm_id]");
		expect(preparer).toContain("target_unit_ids := ARRAY[OLD.unit_id, NEW.unit_id]");
		expect(preparer).toContain("target_tag_ids := ARRAY[OLD.tag_id, NEW.tag_id]");
		expect(preparer).toContain(
			"SELECT DISTINCT value.realm_id, value.unit_id, value.tag_id FROM unnest(target_realm_ids, target_unit_ids, target_tag_ids) AS value(realm_id, unit_id, tag_id) ORDER BY value.realm_id, value.unit_id, value.tag_id",
		);
		expect(preparer.match(/PERFORM public\.lock_realm_tag_judgment_key/gu)).toHaveLength(1);
	});

	it("admits before row mutation and keeps the aggregate lock reentrant", () => {
		expect(compactSql(triggerSource("realm_tag_judgment_hot_key_lock"))).toBe(
			"CREATE TRIGGER realm_tag_judgment_hot_key_lock BEFORE INSERT OR DELETE OR UPDATE ON public.realm_tag_judgment FOR EACH ROW EXECUTE FUNCTION public.prepare_realm_tag_judgment_hot_key();",
		);
		expect(compactSql(functionSource("apply_realm_tag_judgment_stat_delta"))).toContain(
			"PERFORM public.lock_realm_tag_judgment_key( target_realm_id, target_unit_id, target_tag_id )",
		);
	});

	it("registers the function and trigger in the canonical manifest", () => {
		expect(PostgreSqlSchemaFunctionNames).toContain("prepare_realm_tag_judgment_hot_key");
		expect(PostgreSqlSchemaTriggers).toContainEqual({
			name: "realm_tag_judgment_hot_key_lock",
			table: "realm_tag_judgment",
		});
	});
});
