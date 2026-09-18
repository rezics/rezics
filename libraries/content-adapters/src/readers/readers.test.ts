import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { convertProviderSchemas } from "../convert";
import { convertOpenApi, convertJsonSchema, readSchemaDocument } from "./json-schema";
import { readPostgresDeclarations } from "./postgres-ddl";
import { convertWikibase } from "./wikibase";
import { convertIiif } from "./iiif";
import { convertMediaFragment } from "./media-fragments";
const source = { source: "fixture", origin: "https://example.test/schema", version: "1" };
describe("complete schema readers", () => {
	it("reconstructs every provider artifact, including reverse properties and operation schemas", async () => {
		await expect(convertProviderSchemas("typo")).rejects.toThrow();
		const contracts = await convertProviderSchemas("all");
		for (const provider of ["bangumi", "musicbrainz", "vndb", "openlibrary"]) {
			expect(contracts.filter((c) => c.source === provider)).toEqual(
				JSON.parse(
					await readFile(
						new URL(`../../generated/${provider}/contracts.json`, import.meta.url),
						"utf8",
					),
				),
			);
		}
		expect(contracts.some((c) => c.name.startsWith("#/paths/") && c.fields.length > 0)).toBe(true);
		expect(contracts.some((c) => c.fields.some((f) => f.shape === "reverse-reference"))).toBe(true);
		expect(new Set(contracts.map((c) => c.id)).size).toBe(contracts.length);
	});
	it("preserves composition, required facets, numeric syntax, boolean schemas and operation references", () => {
		const text =
			'{"openapi":"3.1.0","components":{"schemas":{"A":{"type":"object","required":["id"],"properties":{"id":{"type":"integer","maximum":900719925474099312345},"choice":{"oneOf":[false,{"$ref":"#/components/schemas/B"}]}}},"B":true}},"paths":{"/items":{"get":{"responses":{"200":{"content":{"application/json":{"schema":{"$ref":"#/components/schemas/A"}}}}}}}}}';
		const contracts = convertOpenApi({ ...source, text });
		expect(
			contracts.find((c) => c.name === "A")?.fields.find((f) => f.path === "#/properties/id")
				?.required,
		).toBe("yes");
		expect(
			contracts.find((c) => c.name === "A")?.fields.find((f) => f.shape === "never"),
		).toBeDefined();
		expect(JSON.stringify(contracts)).toContain("900719925474099312345");
		expect(
			contracts.find((c) => c.name.startsWith("#/paths/"))?.fields[0]?.references[0]?.target,
		).toBe("https://example.test/schema#/components/schemas/A");
		expect(() => readSchemaDocument('{"type":"object","type":"string"}')).toThrow();
		const cycle: Record<string, unknown> = { type: "object" };
		cycle.properties = { cycle };
		expect(() => convertJsonSchema({ ...source, name: "cycle", schema: cycle })).toThrow(/Cyclic/);
	});
	it("keeps SQL quoted defaults and composite references separate", () => {
		const tables = readPostgresDeclarations(
			"CREATE TABLE a (one int NOT NULL, two int, note text DEFAULT 'NOT NULL, hi', empty text DEFAULT NULL, PRIMARY KEY (one,two));",
			["ALTER TABLE a ADD CONSTRAINT a_parent FOREIGN KEY (one,two) REFERENCES b (id,version);"],
		);
		expect(tables.get("a")?.columns.get("note")).toMatchObject({
			nullable: true,
			defaultExpression: "'NOT NULL, hi'",
		});
		expect(tables.get("a")?.columns.get("empty")?.defaultExpression).toBe("NULL");
		expect(tables.get("a")?.clauses).toContainEqual(
			expect.objectContaining({
				kind: "FOREIGN KEY",
				columns: ["one", "two"],
				target: { table: "b", columns: ["id", "version"] },
			}),
		);
	});
	it("keeps Wikibase ordering, exact quantities, repeated references and revision-local IDs", () => {
		const unknown = { snaktype: "somevalue", property: "P2" },
			absent = { snaktype: "novalue", property: "P3" };
		const statement = {
			id: "Q1$opaque",
			rank: "normal",
			mainsnak: {
				snaktype: "value",
				property: "P1",
				datavalue: { type: "quantity", value: { amount: "+900719925474099312345", unit: "1" } },
			},
			qualifiers: { P2: [unknown], P3: [absent] },
			"qualifiers-order": ["P3", "P2"],
			references: [
				{ snaks: { P2: [unknown] }, "snaks-order": ["P2"] },
				{ snaks: { P2: [unknown] }, "snaks-order": ["P2"] },
			],
		};
		const original = { id: "Q1", type: "item", claims: { P1: [statement] } };
		const parsed = convertWikibase(original),
			first = parsed.statements[0]!;
		expect(parsed.raw).toEqual(original);
		expect(first.qualifiers.map((v) => v.state)).toEqual(["no-value", "unknown"]);
		expect(first.references[0]!.id).not.toBe(first.references[1]!.id);
		expect(JSON.stringify(first.main)).toContain("+900719925474099312345");
		const changed = convertWikibase({
			...original,
			claims: { P1: [{ ...statement, rank: "preferred" }] },
		}).statements[0]!;
		expect(changed.id).toBe(first.id);
		expect(changed.revisionId).not.toBe(first.revisionId);
		expect(convertWikibase(original, "https://other.test").id).not.toBe(parsed.id);
		expect(() =>
			convertWikibase({
				...original,
				claims: { P1: [{ ...statement, "qualifiers-order": ["P2"] }] },
			}),
		).toThrow(/order/);
		const form = {
			id: "L1-F1",
			representations: { en: { language: "en", value: "a" } },
			claims: {},
		};
		expect(convertWikibase({ id: "L1", type: "lexeme", forms: [form] }).children[0]?.raw).toEqual(
			form,
		);
	});
	it("keeps repeated IIIF body occurrences and exact fragment dimensions", () => {
		const body = { id: "https://example.test/image", type: "Image" };
		const manifest = {
			id: "https://example.test/manifest",
			type: "Manifest",
			items: [
				{
					id: "https://example.test/canvas",
					type: "Canvas",
					items: [
						{
							type: "AnnotationPage",
							items: [
								{
									type: "Annotation",
									body: [body, body],
									target: {
										type: "SpecificResource",
										source: "https://example.test/canvas",
										selector: { type: "FragmentSelector", value: "xywh=10,20,30,40" },
									},
								},
							],
						},
					],
				},
			],
		};
		const result = convertIiif(manifest),
			images = result.nodes.filter((n) => n.iri === body.id);
		expect(images).toHaveLength(2);
		expect(images[0]!.id).not.toBe(images[1]!.id);
		expect(result.raw).toEqual(manifest);
		const fragment = convertMediaFragment(
			"https://example.test/v#t=1.0000000000000000001,2&xywh=percent:0,0,50,50&track=voice&extra=a%2Bb",
		);
		expect(fragment.dimensions[0]).toMatchObject({ start: "1.0000000000000000001", end: "2" });
		expect(fragment.dimensions[3]).toMatchObject({ kind: "extension", value: "a+b" });
		expect(() => convertMediaFragment("https://example.test/v#xywh=percent:80,0,30,100")).toThrow();
	});
});
