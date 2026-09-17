import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { compileVocabularies, verifyBundle } from "./importer";
import {
	BundleSchema,
	RelationRevisionSchema,
	SemanticValueSchema,
	type VocabularySource,
} from "./contracts";
import { digest, schemaId, stableJson } from "./identity";
import { diffVocabularies, VocabularyRegistry } from "./registry";
import { createProfile, initialProfiles, validateDescription } from "./profiles";

const prefix = `@prefix ex: <https://example.test/> .\n@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n@prefix owl: <http://www.w3.org/2002/07/owl#> .\n`;
const xsd = "http://www.w3.org/2001/XMLSchema#";
function source(text: string, extra: Partial<VocabularySource> = {}): VocabularySource {
	return {
		key: "example",
		version: "1",
		url: "https://example.test/schema.ttl",
		baseIri: "https://example.test/",
		namespaces: ["https://example.test/"],
		file: "example.ttl",
		mediaType: "text/turtle",
		bytes: Buffer.byteLength(text),
		sha256: digest(text),
		license: "CC0-1.0",
		contexts: [],
		...extra,
	};
}
const compile = (text: string, extra: Partial<VocabularySource> = {}) =>
	compileVocabularies({ format: 1, sources: [source(text, extra)] }, async () => Buffer.from(text));

describe("complete vocabulary preservation", () => {
	it("reconstructs every pinned release and every generated term without network access", async () => {
		const manifest = JSON.parse(
			await readFile(new URL("../registry/sources.lock.json", import.meta.url), "utf8"),
		);
		const generated = JSON.parse(
			await readFile(new URL("../registry/bundle.json", import.meta.url), "utf8"),
		);
		const bundle = await compileVocabularies(manifest, (file) =>
			readFile(new URL(`../registry/sources/${file}`, import.meta.url)),
		);
		expect(bundle).toEqual(generated);
		const registry = new VocabularyRegistry(bundle);
		expect(bundle.releases.map((release) => release.source.key)).toEqual([
			"bibframe",
			"dc",
			"dcterms",
			"dctype",
			"oa",
			"owl",
			"prov",
			"rdf",
			"rdfs",
			"schemaorg",
			"skos",
		]);
		expect(registry.term("http://schema.org/creator").id).toBe(
			registry.term("https://schema.org/creator").id,
		);
		expect(registry.term("http://purl.org/dc/terms/creator").id).not.toBe(
			registry.term("https://schema.org/creator").id,
		);
		expect(
			registry
				.release("schemaorg")
				.definitions.some((definition) => definition.status === "retired"),
		).toBe(true);
		expect(
			registry.describe("https://schema.org/creator", "zh-Hant").contributions[0]?.label?.value,
		).toBe("creator");
		expect(initialProfiles(registry).map((profile) => profile.key)).toEqual([
			"book",
			"image",
			"video",
			"wiki",
			"forum",
			"message",
		]);
	});

	it("keeps multiple inheritance, unknown axioms, RDF lists, language and exact numeric lexical values", async () => {
		const text =
			prefix +
			`ex:Book a rdfs:Class; rdfs:subClassOf ex:Work, ex:Product; ex:unrecognized [ owl:oneOf (ex:A ex:B) ]; rdfs:label "書籍"@zh-Hant; ex:huge "900719925474099312345"^^<${xsd}integer> .`;
		const bundle = await compile(text),
			registry = new VocabularyRegistry(bundle);
		const canonical = registry.release("example").canonical;
		for (const value of [
			"subClassOf",
			"https://example.test/Work",
			"https://example.test/Product",
			"unrecognized",
			"#first",
			"#rest",
			"900719925474099312345",
			"書籍",
		])
			expect(canonical).toContain(value);
		expect(
			registry.describe("https://example.test/Book", "zh-Hant").contributions[0]?.label?.value,
		).toBe("書籍");
	});

	it("keeps meaning IDs stable across order, blank-node renaming and added translations", async () => {
		const a = await compile(
			prefix +
				'ex:Book a rdfs:Class; ex:rule _:x; rdfs:label "Book"@en . _:x owl:oneOf (ex:A ex:B) .',
		);
		const b = await compile(
			prefix +
				'_:renamed owl:oneOf (ex:A ex:B) . ex:Book rdfs:label "書籍"@zh-Hant, "Book"@en; ex:rule _:renamed; a rdfs:Class .',
			{ version: "2" },
		);
		const first = new VocabularyRegistry(a),
			next = new VocabularyRegistry(b);
		expect(first.definition("https://example.test/Book", "example").id).toBe(
			next.definition("https://example.test/Book", "example").id,
		);
		expect(diffVocabularies(a, b)).toEqual([
			{ vocabulary: "example", termId: first.term("https://example.test/Book").id, kind: "labels" },
		]);
	});

	it("detects actual meaning changes separately from labels", async () => {
		const a = await compile(
			prefix + 'ex:Book a rdfs:Class; rdfs:subClassOf ex:Work; rdfs:label "Book"@en .',
		);
		const b = await compile(
			prefix + 'ex:Book a rdfs:Class; rdfs:subClassOf ex:Product; rdfs:label "Book"@en .',
		);
		expect(diffVocabularies(a, b).map((change) => change.kind)).toEqual(["meaning"]);
	});

	it("preserves named/default graph distinctions and refuses generalized RDF values", async () => {
		const text =
			'<https://example.test/A> <https://example.test/p> "same" .\n<https://example.test/A> <https://example.test/p> "same" <https://example.test/graph> .\n';
		const bundle = await compile(text, { mediaType: "application/n-quads", file: "example.nq" });
		expect(bundle.releases[0]?.quadCount).toBe(2);
		expect(bundle.releases[0]?.canonical).toContain("<https://example.test/graph>");
		await expect(compile(prefix + 'ex:A ex:p "value"@en--invalid .')).rejects.toThrow();
	});

	it("scopes blank nodes independently between source documents", async () => {
		const first = prefix + 'ex:A ex:p _:same . _:same ex:value "first" .';
		const second = prefix + 'ex:B ex:p _:same . _:same ex:value "second" .';
		const sources = [source(first), source(second, { key: "other", file: "other.ttl" })];
		const bundle = await compileVocabularies({ format: 1, sources }, async (file) =>
			Buffer.from(file === "example.ttl" ? first : second),
		);
		expect(bundle.releases).toHaveLength(2);
		expect(bundle.releases[0]?.canonical).not.toContain('"second"');
		expect(bundle.releases[1]?.canonical).not.toContain('"first"');
	});

	it("loads only checksum-pinned JSON-LD contexts and preserves directional strings", async () => {
		const text = JSON.stringify({
			"@context": "https://example.test/context",
			"@id": "https://example.test/Book",
			label: { "@value": "كتاب", "@language": "ar", "@direction": "rtl" },
		});
		const context = JSON.stringify({
			"@context": { label: "http://www.w3.org/2000/01/rdf-schema#label" },
		});
		const definition = source(text, {
			mediaType: "application/ld+json",
			file: "example.jsonld",
			contexts: [
				{ url: "https://example.test/context", file: "context.jsonld", sha256: digest(context) },
			],
		});
		const bundle = await compileVocabularies({ format: 1, sources: [definition] }, async (file) =>
			Buffer.from(file === "context.jsonld" ? context : text),
		);
		expect(bundle.releases[0]?.canonical).toContain('"rtl"');
		expect(bundle.releases[0]?.canonical).toContain('"كتاب"');
		expect(bundle.releases[0]?.unindexedLabels).toBe(1);
		await expect(
			compileVocabularies({ format: 1, sources: [{ ...definition, contexts: [] }] }, async () =>
				Buffer.from(text),
			),
		).rejects.toThrow(/Unpinned/u);
	});

	it("rejects byte drift, malformed input, traversal and budget overflow without partial bundles", async () => {
		const text = prefix + "ex:A a rdfs:Class .";
		await expect(
			compileVocabularies({ format: 1, sources: [source(text)] }, async () =>
				Buffer.from(text + " "),
			),
		).rejects.toThrow(/integrity/u);
		await expect(
			compileVocabularies(
				{ format: 1, sources: [source(text, { file: "../../secret.ttl" })] },
				async () => Buffer.from(text),
			),
		).rejects.toThrow();
		await expect(
			compileVocabularies({ format: 1, sources: [source(text)] }, async () => Buffer.from(text), {
				maxTerms: 1,
			}),
		).rejects.toThrow(/budget/u);
		await expect(compile(prefix + "ex:A ex:p [ broken")).rejects.toThrow();
		await expect(
			compileVocabularies({ format: 1, sources: [source(text)] }, async () => Buffer.from(text), {
				maxExpandedBytes: 1,
			}),
		).rejects.toThrow(/byte budget/u);
	});

	it("rejects forged derived indexes even when a transport recomputes its outer hash", async () => {
		const text = prefix + "ex:A a rdfs:Class .",
			bundle = await compile(text);
		bundle.releases[0]!.definitions[0]!.types = ["https://example.test/Forged"];
		const { id: _id, digest: _digest, ...body } = bundle;
		const hash = digest(stableJson(body));
		await expect(
			verifyBundle({ ...body, digest: hash, id: schemaId("bundle", hash) }, async () =>
				Buffer.from(text),
			),
		).rejects.toThrow(/differs/u);
	});

	it("binds lookup cursors to a release bundle and preserves portable JSON round trips", async () => {
		const first = await compile(prefix + "ex:A a rdfs:Class ."),
			second = await compile(prefix + "ex:A a rdfs:Class . ex:B a rdfs:Class .");
		const registry = new VocabularyRegistry(first),
			page = registry.page({ limit: 1 });
		expect(page.after).not.toBeNull();
		expect(() => new VocabularyRegistry(second).page({ after: page.after!, limit: 1 })).toThrow(
			/another bundle/u,
		);
		expect(BundleSchema.parse(JSON.parse(JSON.stringify(first)))).toEqual(first);
		expect(() => registry.page({ limit: 1000 })).toThrow(/1..200/u);
	});
});

describe("portable relation and profile contracts", () => {
	it("preserves independent relation identity, exact revision targets and integers without numeric coercion", () => {
		const id = (key: string) => schemaId("test", key);
		const value = {
			kind: "literal",
			value: "900719925474099312345",
			datatype: `${xsd}integer`,
		} as const;
		const revision = RelationRevisionSchema.parse({
			id: id("revision"),
			relationId: id("relation"),
			subject: { owner: "video", id: id("video"), revisionId: id("video-revision") },
			predicateId: id("time"),
			definitionId: id("meaning"),
			parentRevisionId: null,
			changeId: id("edit"),
			value,
			position: "900719925474099312345",
		});
		expect(RelationRevisionSchema.parse(JSON.parse(JSON.stringify(revision)))).toEqual(revision);
		expect(SemanticValueSchema.parse({ kind: "no-value" })).not.toEqual(
			SemanticValueSchema.parse({ kind: "unknown" }),
		);
		expect(() =>
			SemanticValueSchema.parse({
				kind: "literal",
				value: "1",
				datatype: `${xsd}integer`,
				language: "en",
			}),
		).toThrow();
	});

	it("enforces explicit profile rules while allowing multiple independently identified authors", () => {
		const id = (key: string) => schemaId("test", key);
		const profile = createProfile({
			key: "authors",
			types: [id("book")],
			additionalProperties: false,
			rules: [
				{
					predicateId: id("author"),
					definitionId: id("meaning"),
					min: 1,
					max: null,
					ordered: true,
					valueKinds: ["reference"],
				},
			],
		});
		const author = (position: string) =>
			RelationRevisionSchema.parse({
				id: id(`revision${position}`),
				relationId: id(`relation${position}`),
				subject: { owner: "publishing", id: id("work") },
				predicateId: id("author"),
				definitionId: id("meaning"),
				parentRevisionId: null,
				changeId: id("edit"),
				value: { kind: "reference", reference: { owner: "entity", id: id("person") } },
				position,
			});
		expect(() =>
			validateDescription(profile, { types: [id("book")], relations: [author("0"), author("1")] }),
		).not.toThrow();
		expect(() => validateDescription(profile, { types: [id("book")], relations: [] })).toThrow(
			/cardinality/u,
		);
		expect(() =>
			validateDescription(profile, {
				types: [id("book")],
				relations: [
					author("0"),
					{ ...author("0"), id: id("another-revision"), relationId: id("another-relation") },
				],
			}),
		).toThrow(/positions/u);
		expect(() =>
			validateDescription(profile, { types: [id("book")], relations: [author("0"), author("0")] }),
		).toThrow(/same relation/u);
		expect(() =>
			validateDescription(profile, {
				types: [id("book")],
				relations: [{ ...author("0"), definitionId: id("other") }],
			}),
		).toThrow(/meaning/u);
	});
});
