import { datatypeDefinitions } from "@rezics/schema/model/datatypes";
import type { VocabularyBundle } from "@rezics/schema";
import { VocabularyRegistry } from "@rezics/schema/registry";
import { digest, stableJson } from "@rezics/schema/identity";
const rdfs = "http://www.w3.org/2000/01/rdf-schema#",
	owl = "http://www.w3.org/2002/07/owl#",
	schema = "https://schema.org/";
const facets: Record<string, string> = {
	[rdfs + "subClassOf"]: "superClasses",
	[rdfs + "subPropertyOf"]: "superProperties",
	[rdfs + "domain"]: "domains",
	[rdfs + "range"]: "ranges",
	[schema + "domainIncludes"]: "suggestedDomains",
	[schema + "rangeIncludes"]: "suggestedRanges",
	[schema + "supersededBy"]: "replacements",
	[owl + "inverseOf"]: "inverses",
	[owl + "equivalentClass"]: "equivalentClasses",
	[owl + "equivalentProperty"]: "equivalentProperties",
	[owl + "disjointWith"]: "disjointClasses",
};
/** @alpha Normalize every selected vocabulary definition while preserving graph expressions and provenance. No entailment becomes a storage constraint. */
export function compileOntology(bundle: VocabularyBundle) {
	const registry = new VocabularyRegistry(bundle);
	const definitions = bundle.releases.flatMap((release) => {
		const nodes = new Map(release.nodes.map((node) => [node.id, node]));
		const outgoing = new Map<string, typeof release.statements>();
		for (const statement of release.statements) {
			const subject = nodes.get(statement.subjectId)?.termId;
			if (!subject) continue;
			const values = outgoing.get(subject) ?? [];
			values.push(statement);
			outgoing.set(subject, values);
		}
		return release.definitions.map((definition) => {
			const normalized: Record<string, unknown[]> = {};
			for (const statement of outgoing.get(definition.termId) ?? []) {
				const name = facets[registry.term(statement.predicateId).iri];
				if (!name) continue;
				const node = nodes.get(statement.objectId)!;
				const target = node.termId
					? { termId: node.termId, iri: registry.term(node.termId).iri }
					: { nodeId: node.id, releaseId: release.id };
				(normalized[name] ??= []).push(target);
			}
			return {
				termId: definition.termId,
				iri: registry.term(definition.termId).iri,
				definitionId: definition.id,
				releaseId: release.id,
				vocabulary: release.source.key,
				types: definition.types,
				status: definition.status,
				replacements: definition.replacements,
				facets: normalized,
				statementIds: (outgoing.get(definition.termId) ?? []).map((statement) => statement.id),
			};
		});
	});
	const content = {
		format: "rezics.ontology/1",
		bundleId: bundle.id,
		datatypes: datatypeDefinitions,
		definitions,
		vocabularies: bundle.releases.map((release) => ({
			key: release.source.key,
			releaseId: release.id,
			definitions: release.definitions.length,
			statements: release.statements.length,
		})),
	};
	return { ...content, digest: digest(stableJson(content)) };
}
export type Ontology = ReturnType<typeof compileOntology>;
