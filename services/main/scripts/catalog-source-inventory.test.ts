import { describe, expect, it } from "vitest";
import {
	applyMusicBrainzKeys,
	assertSchemaReferencesComplete,
	canonicalContractHash,
	inventoryJsonSchema,
	inventoryMusicBrainz,
	inventoryOpenLibrary,
	inventoryVndb,
	splitSqlColumns,
} from "./catalog-source-inventory";

describe("pinned source contract inventory", () => {
	it("applies declared SQL keys instead of guessing references from column names", () => {
		const fields = inventoryMusicBrainz(
			"CREATE TABLE track (id SERIAL, recording INTEGER, title TEXT);\nCREATE TABLE recording (id SERIAL);",
		);
		const keyed = applyMusicBrainzKeys(
			fields,
			"ALTER TABLE track ADD CONSTRAINT track_recording_fk FOREIGN KEY (recording) REFERENCES recording(id);",
			"ALTER TABLE track ADD CONSTRAINT track_pkey PRIMARY KEY (id);",
		);
		expect(keyed.find(({ path }) => path === "recording")?.reference).toBe("recording.id");
		expect(keyed.find(({ path }) => path === "id")?.nullable).toBe(false);
		expect(keyed.find(({ path }) => path === "title")?.reference).toBeNull();
		expect(() =>
			applyMusicBrainzKeys(
				fields,
				"ALTER TABLE track ADD CONSTRAINT missing FOREIGN KEY (absent) REFERENCES recording(id);",
				"",
			),
		).toThrow("unlisted column");
	});
	it("terminates cyclic VNDB inheritance while retaining release-context fields", () => {
		const fields = inventoryVndb({
			api_fields: {
				"/vn": { id: null, characters: { _inherit: "/character" } },
				"/character": { vns: { _inherit: "/vn", role: null, release: { _inherit: "/release" } } },
				"/release": { id: null },
			},
		});
		expect(fields.find((field) => field.path === "vns.release")?.reference).toBe("/release");
		expect(fields.some((field) => field.path === "vns.role")).toBe(true);
		expect(fields).toHaveLength(6);
	});
	it("rejects missing inherited contracts instead of dropping their fields", () => {
		expect(() =>
			inventoryVndb({ api_fields: { "/vn": { release: { _inherit: "/missing" } } } }),
		).toThrow("Unknown VNDB");
	});
	it("retains contradictory outer Wiki value type and both union branches", () => {
		const fields = inventoryJsonSchema("bangumi", "WikiV0", {
			type: "object",
			anyOf: [
				{ type: "string" },
				{ type: "array", items: { type: "object", properties: { v: { type: "string" } } } },
			],
		});
		expect(fields[0]?.shape).toBe("object");
		expect(fields.find((field) => field.path === "@anyOf:0")?.shape).toBe("string");
		expect(fields.find((field) => field.path === "@anyOf:1[].v")?.repeated).toBe(true);
	});
	it("validates local and external component references without network fallback", () => {
		const documents = new Map<string, unknown>([
			[
				"https://example.test/v0.yaml",
				{ components: { schemas: { Subject: { $ref: "components/subject.yaml" } } } },
			],
			[
				"https://example.test/components/subject.yaml",
				{ properties: { parent: { $ref: "../v0.yaml#/components/schemas/Subject" } } },
			],
		]);
		expect(() => assertSchemaReferencesComplete(documents)).not.toThrow();
		documents.delete("https://example.test/components/subject.yaml");
		expect(() => assertSchemaReferencesComplete(documents)).toThrow("Unpinned schema reference");
	});
	it("does not confuse Open Library single-valued properties with globally unique values", () => {
		const fields = inventoryOpenLibrary({
			key: "/type/edition",
			properties: [
				{ name: "title", expected_type: { key: "/type/string" }, unique: true },
				{ name: "isbn_13", expected_type: { key: "/type/string" }, unique: false },
			],
		});
		expect(fields.map(({ path, repeated }) => [path, repeated])).toEqual([
			["title", false],
			["isbn_13", true],
		]);
	});
	it("preserves SQL types, nested checks, array columns and partition relationships", () => {
		const fields = inventoryMusicBrainz(`CREATE TABLE track (
 id INTEGER NOT NULL,
 name TEXT DEFAULT 'a, --b',
 offsets INTEGER[],
 CHECK (id IN (1, 2))
) PARTITION BY LIST (id);
CREATE TABLE track_one PARTITION OF track FOR VALUES IN (1);`);
		expect(fields.map(({ contract, path }) => [contract, path])).toEqual([
			["track", "id"],
			["track", "name"],
			["track", "offsets"],
			["track_one", "$partition"],
		]);
		expect(fields[0]?.nullable).toBe(false);
		expect(fields[2]?.repeated).toBe(true);
		expect(fields[3]?.reference).toBe("track");
	});
	it("fails closed when new SQL table syntax cannot be enumerated", () => {
		expect(() => inventoryMusicBrainz("CREATE TABLE unexpected AS SELECT 1;")).toThrow();
		expect(() => splitSqlColumns("id INTEGER, value TEXT CHECK ((1 = 1)")).toThrow("Unterminated");
	});
	it("does not split a quoted SQL value or nested comment into a new field", () => {
		expect(
			splitSqlColumns(
				"id INTEGER, name TEXT DEFAULT 'a,''b', /* outer /* nested */ x */ n NUMERIC(10,2)",
			),
		).toEqual(["id INTEGER", "name TEXT DEFAULT 'a,''b'", "n NUMERIC(10,2)"]);
	});
	it("treats JSON object key order as irrelevant and array order as meaningful", () => {
		expect(canonicalContractHash({ b: 2, a: [1, 2] })).toBe(
			canonicalContractHash({ a: [1, 2], b: 2 }),
		);
		expect(canonicalContractHash({ a: [1, 2] })).not.toBe(canonicalContractHash({ a: [2, 1] }));
	});
});
