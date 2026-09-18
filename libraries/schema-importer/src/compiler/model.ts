import {
	CompiledModelSchema,
	type NativeModelDecision,
	type OperationalDecision,
	type StorageModule,
} from "@rezics/schema/model/contracts";
import { VocabularyRegistry } from "@rezics/schema/registry";
import { digest, schemaId, stableJson } from "@rezics/schema/identity";
import type { VocabularyBundle } from "@rezics/schema";
import { modelWriters } from "@rezics/schema/model-decisions/writers";
import type { Ontology } from "./ontology";

/** @alpha Compile authored decisions against exact standard definitions; physical table topology is never inferred from RDF inheritance. */
export function compileModel(
	bundle: VocabularyBundle,
	ontology: Ontology,
	decisions: NativeModelDecision[],
	owners: OperationalDecision[],
	modules: StorageModule[],
) {
	const registry = new VocabularyRegistry(bundle);
	const pin = (iri: string, vocabulary: string) => {
		const term = registry.term(iri),
			release = registry.release(vocabulary),
			definition = registry.definition(term.id, vocabulary);
		if (definition.status === "retired")
			throw new TypeError(`An active model cannot silently adopt retired meaning: ${iri}`);
		return { termId: term.id, definitionId: definition.id, releaseId: release.id };
	};
	if (new Set(decisions.map((profile) => profile.key)).size !== decisions.length)
		throw new TypeError("Duplicate native profile key");
	const profiles = decisions.map((profile) => {
		if (!profile.grain || !profile.locality.growth || profile.identity.requiresUniversalParent)
			throw new TypeError("Native identity grain and independent locality must be explicit");
		const predicates = new Set<string>();
		return {
			...profile,
			types: profile.types.map((type) => ({ ...type, ...pin(type.iri, type.vocabulary) })),
			properties: profile.properties.map((property) => {
				if (predicates.has(registry.term(property.iri).id))
					throw new TypeError(`Ambiguous writable authority for ${profile.key}/${property.iri}`);
				predicates.add(registry.term(property.iri).id);
				if (property.max !== null && property.max < property.min)
					throw new TypeError(`Invalid cardinality for ${profile.key}/${property.iri}`);
				if (!property.meaning || !property.storage.writer)
					throw new TypeError("Every storage mapping needs its reviewed meaning and writer");
				const writer = modelWriters.find((writer) => writer.key === property.storage.writer);
				if (
					!writer ||
					!new RegExp(writer.tablePattern).test(property.storage.table) ||
					!(writer.representations as readonly string[]).includes(property.storage.kind)
				)
					throw new TypeError("Property storage is outside its declared write authority");
				const { termId, ...definition } = pin(property.iri, property.vocabulary);
				return {
					...property,
					predicateId: termId,
					...definition,
					datatypes: property.datatypes ?? [],
					targetOwners: property.targetOwners ?? [],
					uniqueLanguage: property.uniqueLanguage ?? false,
				};
			}),
		};
	});
	const generatedStorage = modules.flatMap((module) =>
		module.tables.map((table) => {
			for (const iri of table.sourceTerms) registry.term(iri);
			return {
				symbol: table.symbol,
				table: table.name,
				module: module.output,
				meaning: table.meaning,
				decision: table.decision,
				sourceTerms: table.sourceTerms,
			};
		}),
	);
	const content = {
		format: "rezics.application-model/1" as const,
		ontologyDigest: ontology.digest,
		storageDigest: digest(stableJson(modules)),
		sourceReleases: bundle.releases.map((release) => ({
			key: release.source.key,
			id: release.id,
			digest: release.digest,
		})),
		profiles,
		operationalOwners: owners,
		writers: modelWriters.map((writer) => ({
			...writer,
			representations: [...writer.representations],
		})),
		generatedStorage,
	};
	const hash = digest(stableJson(content));
	return CompiledModelSchema.parse({
		...content,
		id: schemaId("application-model", hash),
		digest: hash,
	});
}

/** @alpha Complete vocabulary disposition is separate from native workflow coverage. Every row retains its exact upstream meaning. */
export function compileTraceability(ontology: Ontology, model: ReturnType<typeof compileModel>) {
	return ontology.definitions.map((definition) => {
		const mappings = model.profiles.flatMap((profile) => [
			...profile.types
				.filter((type) => type.definitionId === definition.definitionId)
				.map((type) => ({
					profile: profile.key,
					kind: "type",
					relationship: type.relationship,
					reason: type.reason,
					table: profile.identity.table,
					writer: "native identity owner",
				})),
			...profile.properties
				.filter((rule) => rule.definitionId === definition.definitionId)
				.map((rule) => ({
					profile: profile.key,
					kind: "property",
					relationship: rule.storage.transform ? "transformation" : "reviewed-native-rule",
					reason: rule.meaning,
					table: rule.storage.table,
					writer: rule.storage.writer,
				})),
		]);
		const type =
			definition.types.includes("http://www.w3.org/2000/01/rdf-schema#Class") ||
			definition.types.includes("http://www.w3.org/2002/07/owl#Class")
				? "class"
				: definition.types.some((type) =>
							[
								"http://www.w3.org/1999/02/22-rdf-syntax-ns#Property",
								"http://www.w3.org/2002/07/owl#ObjectProperty",
								"http://www.w3.org/2002/07/owl#DatatypeProperty",
							].includes(type),
						)
					? "property"
					: "vocabulary-definition";
		return {
			iri: definition.iri,
			termId: definition.termId,
			definitionId: definition.definitionId,
			releaseId: definition.releaseId,
			vocabulary: definition.vocabulary,
			status: definition.status,
			type,
			mappings,
			disposition: mappings.length
				? "reviewed-native-mapping"
				: type === "class"
					? "semantic-description"
					: type === "property"
						? "typed-semantic-assertion"
						: "retained-vocabulary-definition",
			preservation: { table: "schema_statement", statements: definition.statementIds.length },
			nativeWorkflowImplemented:
				mappings.length > 0
					? "Only the named storage/validation contracts; product workflows require their owner qualification"
					: false,
		};
	});
}

/** @alpha Export necessary SHACL Core constraints for a direct-triple projection, with an explicit lowering report. Native occurrence validation remains authoritative. */
export function emitShapes(model: ReturnType<typeof compileModel>): string {
	const iri = (value: string) => `<${value.replaceAll(">", "%3E")}>`,
		literal = (value: string) => JSON.stringify(value);
	const lines = [
		"# Advisory direct-triple projection. See model-shacl-report.json; this is not native-record validation.",
		"@prefix sh: <http://www.w3.org/ns/shacl#> .",
		"@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
		"",
	];
	for (const profile of model.profiles) {
		// Profiles are chosen explicitly: ambiguous Book grains must not all auto-apply by sh:targetClass.
		lines.push(
			`${iri(`https://rezics.com/schema/profiles/${profile.key}`)} a sh:NodeShape ;`,
			`  sh:name ${literal(profile.key)} ;`,
		);
		profile.properties.forEach((rule) => {
			const entries = [
				`sh:path ${iri(rule.iri)}`,
				`sh:minCount ${rule.min > 0 && !rule.valueKinds.some((kind) => kind === "unknown" || kind === "no-value") ? 1 : 0}`,
			];
			if (rule.max !== null) entries.push(`sh:maxCount ${rule.max}`);
			if (rule.uniqueLanguage) entries.push("sh:uniqueLang true");
			if (rule.datatypes.length) {
				const datatypeShape =
					rule.datatypes.length === 1
						? `sh:datatype ${iri(rule.datatypes[0]!)}`
						: `sh:or ( ${rule.datatypes.map((type) => `[ sh:datatype ${iri(type)} ]`).join(" ")} )`;
				entries.push(
					rule.valueKinds.some((kind) => kind === "reference" || kind === "iri")
						? `sh:or ( [ sh:nodeKind sh:IRI ] [ ${datatypeShape} ] )`
						: datatypeShape,
				);
			}
			if (rule.valueKinds.every((kind) => kind === "reference" || kind === "iri"))
				entries.push("sh:nodeKind sh:IRI");
			if (rule.valueKinds.every((kind) => kind === "literal"))
				entries.push("sh:nodeKind sh:Literal");
			lines.push(`  sh:property [ ${entries.join(" ; ")} ] ;`);
		});
		lines.push(`  sh:closed ${profile.additionalProperties === "reject" ? "true" : "false"} .`, "");
	}
	return lines.join("\n");
}

/** @alpha Explicitly report constraints that a direct-triple SHACL projection cannot prove. */
export function shapeLoweringReport(model: ReturnType<typeof compileModel>) {
	return {
		format: "rezics.shacl-projection/1",
		modelId: model.id,
		scope: "Necessary constraints on direct RDF triples only; never sufficient for native adoption",
		authoritativeValidation: "validateModelRecord plus the owning transactional writer",
		globalOmissions: [
			"Relationship occurrence identity and duplicate endpoints",
			"Logical owner existence and authorization",
			"Revision, interpretation and selection CAS",
			"Native writer and storage authority",
			"Erasure and workload-locality invariants",
		],
		rules: model.profiles.flatMap((profile) =>
			profile.properties.map((rule) => ({
				profile: profile.key,
				predicate: rule.iri,
				omissions: [
					...(rule.ordered ? ["Explicit native occurrence ordering"] : []),
					...(rule.uniqueLanguage
						? ["Duplicate occurrences of an identical language literal collapse in RDF triples"]
						: []),
					...(rule.targetOwners.length
						? ["Native target-owner restrictions require the host resolver"]
						: []),
					...(rule.min > 1
						? ["Minimum occurrence count is weakened to one distinct projected value"]
						: []),
					...(rule.valueKinds.some((kind) => kind === "unknown" || kind === "no-value")
						? ["Unknown/no-value states require native reification"]
						: []),
				],
			})),
		),
	};
}
