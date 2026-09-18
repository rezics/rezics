import { Readable } from "node:stream";
import { rdfParser } from "rdf-parse";
import { canonize, NQuads } from "rdf-canonize";
import {
	BundleSchema,
	RdfQuadSchema,
	SourceManifestSchema,
	type RdfQuad,
	type TermDefinition,
	type TermLabel,
	type VocabularyBundle,
	type VocabularyRelease,
	type VocabularySource,
	type VocabularyTerm,
	type GraphNode,
	type GraphStatement,
} from "@rezics/schema";
import { digest, schemaId, stableJson, termId } from "@rezics/schema/identity";

const rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const rdfs = "http://www.w3.org/2000/01/rdf-schema#";
const skos = "http://www.w3.org/2004/02/skos/core#";
/** @alpha Display-label predicates excluded from meaning digests; all remain in the complete graph. */
const labelPredicates = new Set([
	`${rdfs}label`,
	`${skos}prefLabel`,
	`${skos}altLabel`,
	`${skos}hiddenLabel`,
	"https://schema.org/name",
	"http://schema.org/name",
	"http://purl.org/dc/terms/title",
]);

/** @alpha Vocabulary compilation is bounded control-plane work, not an instance-corpus ingestion API. */
export interface ImportLimits {
	maxQuads: number;
	maxTerms: number;
	maxClosureQuads: number;
	maxTotalBytes: number;
	maxExpandedBytes: number;
	canonicalTimeoutMs: number;
}
const defaults: ImportLimits = {
	maxQuads: 250_000,
	maxTerms: 50_000,
	maxClosureQuads: 10_000,
	maxTotalBytes: 67_108_864,
	maxExpandedBytes: 67_108_864,
	canonicalTimeoutMs: 30_000,
};
/** @alpha The host provides exact local artifact/context bytes; the importer never fetches the network. */
export type ArtifactReader = (file: string) => Promise<Uint8Array>;

function copyTerm(term: {
	termType: string;
	value: string;
	datatype?: { value: string };
	language?: string;
	direction?: string;
}) {
	if (term.direction)
		throw new TypeError("RDF 1.2 directional literals need an explicitly supported bundle format");
	if (term.termType === "Literal")
		return {
			termType: term.termType,
			value: term.value,
			language: term.language ?? "",
			datatype: { termType: "NamedNode", value: term.datatype?.value },
		};
	return { termType: term.termType, value: term.value };
}

/** @alpha Parse pinned RDF 1.1 serializations, retaining named graphs, lists and lexical literals. */
export async function parseArtifact(
	source: VocabularySource,
	read: ArtifactReader,
	limits: ImportLimits = defaults,
): Promise<RdfQuad[]> {
	const bytes = await read(source.file);
	if (
		bytes.byteLength !== source.bytes ||
		bytes.byteLength > 16_777_216 ||
		digest(bytes) !== source.sha256
	)
		throw new TypeError(`Artifact integrity mismatch: ${source.key}`);
	new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	const contexts = new Map(source.contexts.map((context) => [context.url, context]));
	let contextLoads = 0;
	// These keys are the pinned rdf-parse 5 / Comunica JSON-LD adapter contract.
	const options = {
		contentType: source.mediaType,
		baseIRI: source.baseIri,
		version: "1.1",
		"@comunica/actor-rdf-parse-jsonld:documentLoader": {
			load: async (url: string) => {
				const context = contexts.get(url);
				if (!context || ++contextLoads > 64)
					throw new TypeError(`Unpinned or excessive JSON-LD context: ${url}`);
				const input = await read(context.file);
				if (input.byteLength > 1_048_576 || digest(input) !== context.sha256)
					throw new TypeError("Context integrity mismatch");
				return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input));
			},
		},
		"@comunica/actor-rdf-parse-jsonld:strictValues": true,
		"@comunica/actor-rdf-parse-jsonld:parserOptions": {
			rdfDirection: "compound-literal",
			validateValueIndexes: true,
		},
	};
	const input = Readable.from([bytes]);
	const stream = rdfParser.parse(input, options);
	const timer = setTimeout(
		() => stream.destroy(new Error("Vocabulary parse timed out")),
		limits.canonicalTimeoutMs,
	);
	const quads: RdfQuad[] = [];
	let expandedBytes = 0;
	try {
		for await (const quad of stream) {
			if (quads.length >= limits.maxQuads) throw new RangeError("Vocabulary quad budget exceeded");
			for (const term of [quad.subject, quad.predicate, quad.object, quad.graph])
				expandedBytes += Buffer.byteLength(term.value);
			if (expandedBytes > limits.maxExpandedBytes)
				throw new RangeError("Expanded RDF byte budget exceeded");
			quads.push(
				RdfQuadSchema.parse({
					subject: copyTerm(quad.subject),
					predicate: copyTerm(quad.predicate),
					object: copyTerm(quad.object),
					graph: copyTerm(quad.graph),
				}),
			);
		}
	} finally {
		clearTimeout(timer);
		stream.destroy();
		input.destroy();
	}
	return quads;
}

async function canonicalize(quads: RdfQuad[], limits: ImportLimits): Promise<string> {
	return canonize(quads, {
		algorithm: "RDFC-1.0",
		maxWorkFactor: 1,
		signal: AbortSignal.timeout(limits.canonicalTimeoutMs),
	});
}

function parseCanonical(canonical: string): RdfQuad[] {
	return NQuads.parse(canonical).map((quad) => RdfQuadSchema.parse(quad));
}

function blankValues(quad: RdfQuad): string[] {
	return [quad.subject, quad.object, quad.graph]
		.filter((term) => term.termType === "BlankNode")
		.map((term) => term.value);
}

/** @alpha A label's content identity is independent of the release or translation selection using it. */
export function makeLabel(input: Omit<TermLabel, "id">): TermLabel {
	return { id: schemaId("label", stableJson(input)), ...input };
}

async function describeRelease(
	source: VocabularySource,
	canonical: string,
	resolveIri: (iri: string) => string,
	limits: ImportLimits,
	budget: { bytes: number },
): Promise<VocabularyRelease> {
	const quads = parseCanonical(canonical);
	const vocabularyId = schemaId("vocabulary", source.key);
	const namedSubjects = new Map<string, RdfQuad[]>(),
		blanks = new Map<string, Set<RdfQuad>>();
	for (const quad of quads) {
		if (quad.subject.termType === "NamedNode") {
			const key = resolveIri(quad.subject.value);
			const values = namedSubjects.get(key) ?? [];
			values.push(quad);
			namedSubjects.set(key, values);
		}
		for (const blank of blankValues(quad)) {
			const values = blanks.get(blank) ?? new Set<RdfQuad>();
			values.add(quad);
			blanks.set(blank, values);
		}
	}
	const definitions: TermDefinition[] = [],
		labels: TermLabel[] = [];
	let unindexedLabels = 0;
	for (const [iri, direct] of [...namedSubjects].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
		const id = termId(resolveIri(iri));
		const meaningRoots = direct.filter((quad) => !labelPredicates.has(quad.predicate.value));
		const closure = new Set(meaningRoots),
			queue = [...new Set(meaningRoots.flatMap(blankValues))],
			seen = new Set(queue);
		for (let offset = 0; offset < queue.length; offset++) {
			for (const quad of blanks.get(queue[offset]!) ?? []) {
				if (labelPredicates.has(quad.predicate.value)) continue;
				closure.add(quad);
				if (closure.size > limits.maxClosureQuads)
					throw new RangeError(`Definition closure budget exceeded: ${iri}`);
				for (const blank of blankValues(quad))
					if (!seen.has(blank)) {
						seen.add(blank);
						queue.push(blank);
					}
			}
		}
		const meaning = await canonicalize(
			[...closure].filter((quad) => !labelPredicates.has(quad.predicate.value)),
			limits,
		);
		const hash = digest(meaning);
		budget.bytes += Buffer.byteLength(meaning);
		if (budget.bytes > limits.maxExpandedBytes)
			throw new RangeError("Definition expansion byte budget exceeded");
		const objects = (predicate: string) =>
			direct
				.filter(
					(quad) => quad.predicate.value === predicate && quad.object.termType === "NamedNode",
				)
				.map((quad) => quad.object.value);
		const sections = objects("https://schema.org/isPartOf");
		const deprecated = direct.some(
			(quad) =>
				quad.predicate.value === "http://www.w3.org/2002/07/owl#deprecated" &&
				quad.object.termType === "Literal" &&
				["true", "1"].includes(quad.object.value),
		);
		definitions.push({
			id: schemaId("definition", vocabularyId, id, hash),
			termId: id,
			vocabularyId,
			digest: hash,
			canonical: meaning,
			types: [...new Set(objects(`${rdf}type`))].sort(),
			status:
				deprecated ||
				sections.includes("https://attic.schema.org") ||
				sections.includes("https://attic.schema.org/")
					? "retired"
					: sections.includes("https://pending.schema.org") ||
							sections.includes("https://pending.schema.org/")
						? "pending"
						: "active",
			replacements: [...new Set(objects("https://schema.org/supersededBy"))].sort(),
		});
		for (const quad of direct)
			if (labelPredicates.has(quad.predicate.value) && quad.object.termType === "Literal") {
				labels.push(
					makeLabel({
						termId: id,
						predicate: quad.predicate.value,
						value: quad.object.value,
						language: quad.object.language,
						datatype: quad.object.datatype.value,
					}),
				);
			}
		unindexedLabels += direct.filter(
			(quad) => labelPredicates.has(quad.predicate.value) && quad.object.termType !== "Literal",
		).length;
	}
	const hash = digest(stableJson({ compiler: "rezics-schema/2", source, canonical }));
	const releaseId = schemaId("release", vocabularyId, hash);
	const nodes = new Map<string, GraphNode>();
	const node = (value: RdfQuad["subject"] | RdfQuad["object"] | RdfQuad["graph"]) => {
		const id = schemaId("rdf-node", releaseId, stableJson(value));
		if (!nodes.has(id))
			nodes.set(id, {
				id,
				kind:
					value.termType === "NamedNode"
						? "iri"
						: value.termType === "BlankNode"
							? "blank"
							: value.termType === "Literal"
								? "literal"
								: "default-graph",
				lexical: value.value,
				termId: value.termType === "NamedNode" ? termId(resolveIri(value.value)) : null,
				datatypeId: value.termType === "Literal" ? termId(resolveIri(value.datatype.value)) : null,
				language: value.termType === "Literal" ? value.language : null,
			});
		return id;
	};
	const statements: GraphStatement[] = quads.map((quad) => ({
		id: schemaId("rdf-statement", releaseId, stableJson(quad)),
		subjectId: node(quad.subject),
		predicateId: termId(resolveIri(quad.predicate.value)),
		predicateIri: quad.predicate.value,
		objectId: node(quad.object),
		graphId: node(quad.graph),
	}));
	return {
		id: releaseId,
		vocabularyId,
		source,
		digest: hash,
		canonical,
		quadCount: quads.length,
		definitions: definitions.sort((a, b) => a.id.localeCompare(b.id)),
		labels: [...new Map(labels.map((label) => [label.id, label])).values()].sort((a, b) =>
			a.id.localeCompare(b.id),
		),
		unindexedLabels,
		nodes: [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
		statements: statements.sort((a, b) => a.id.localeCompare(b.id)),
	};
}

/** @alpha Compile complete selected vocabularies; no web data, code generation or database writes occur here. */
export async function compileVocabularies(
	manifestInput: unknown,
	read: ArtifactReader,
	overrides: Partial<ImportLimits> = {},
): Promise<VocabularyBundle> {
	const manifest = SourceManifestSchema.parse(manifestInput),
		limits = { ...defaults, ...overrides };
	for (const limit of Object.values(limits))
		if (!Number.isSafeInteger(limit) || limit <= 0) throw new RangeError("Invalid import limit");
	if (manifest.sources.reduce((sum, source) => sum + source.bytes, 0) > limits.maxTotalBytes)
		throw new RangeError("Vocabulary byte budget exceeded");
	const datasets: { source: VocabularySource; canonical: string; quads: RdfQuad[] }[] = [];
	let count = 0;
	for (const source of [...manifest.sources].sort((a, b) => a.key.localeCompare(b.key))) {
		const canonical = await canonicalize(await parseArtifact(source, read, limits), limits),
			quads = parseCanonical(canonical);
		count += quads.length;
		if (count > limits.maxQuads) throw new RangeError("Combined vocabulary quad budget exceeded");
		datasets.push({ source, canonical, quads });
	}
	const aliases = new Map<string, string>();
	// Only declared Schema.org terms receive the documented HTTP alias. Original graph IRIs stay untouched.
	for (const { source, quads } of datasets)
		if (source.key === "schemaorg")
			for (const quad of quads) {
				if (
					quad.subject.termType === "NamedNode" &&
					quad.subject.value.startsWith("https://schema.org/")
				)
					aliases.set(quad.subject.value.replace(/^https:/u, "http:"), quad.subject.value);
			}
	const resolveIri = (iri: string) => aliases.get(iri) ?? iri;
	const terms = new Map<string, VocabularyTerm>();
	for (const { quads } of datasets)
		for (const quad of quads) {
			for (const term of [
				quad.subject,
				quad.predicate,
				quad.object,
				quad.graph,
				...(quad.object.termType === "Literal" ? [quad.object.datatype] : []),
			]) {
				if (term.termType !== "NamedNode") continue;
				const iri = resolveIri(term.value),
					id = termId(iri);
				terms.set(id, { id, iri, aliases: [] });
				if (terms.size > limits.maxTerms) throw new RangeError("Vocabulary term budget exceeded");
			}
		}
	for (const [alias, iri] of aliases) terms.get(termId(iri))?.aliases.push(alias);
	const releases: VocabularyRelease[] = [];
	const budget = {
		bytes: datasets.reduce((sum, data) => sum + Buffer.byteLength(data.canonical), 0),
	};
	if (budget.bytes > limits.maxExpandedBytes)
		throw new RangeError("Combined graph byte budget exceeded");
	for (const { source, canonical } of datasets)
		releases.push(await describeRelease(source, canonical, resolveIri, limits, budget));
	const body = {
		format: 2 as const,
		compiler: "rezics-schema/2" as const,
		terms: [...terms.values()].sort((a, b) => a.id.localeCompare(b.id)),
		releases,
	};
	const serialized = stableJson(body);
	if (Buffer.byteLength(serialized) > limits.maxExpandedBytes)
		throw new RangeError("Serialized bundle byte budget exceeded");
	const hash = digest(serialized);
	return BundleSchema.parse({ ...body, id: schemaId("bundle", hash), digest: hash });
}

/** @alpha Rebuild from pinned source bytes before trusting a transported bundle's derived indexes. */
export async function verifyBundle(
	input: unknown,
	read: ArtifactReader,
): Promise<VocabularyBundle> {
	const bundle = BundleSchema.parse(input);
	const rebuilt = await compileVocabularies(
		{ format: 1, sources: bundle.releases.map((release) => release.source) },
		read,
	);
	if (stableJson(bundle) !== stableJson(rebuilt))
		throw new TypeError("Bundle differs from its complete pinned sources");
	return bundle;
}
