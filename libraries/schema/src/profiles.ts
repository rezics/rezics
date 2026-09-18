import type { VocabularyRegistry } from "./registry";
/** @alpha Vocabulary-only class descriptions. No cardinality, storage or business validity is inferred. */
export function describeVocabularyClasses(registry: VocabularyRegistry, vocabulary = "schemaorg") {
	const release = registry.release(vocabulary),
		nodes = new Map(release.nodes.map((node) => [node.id, node]));
	const parents = new Map<string, Set<string>>(),
		properties = new Map<string, Set<string>>();
	for (const statement of release.statements) {
		const subject = nodes.get(statement.subjectId)?.termId,
			object = nodes.get(statement.objectId)?.termId;
		if (!subject || !object) continue;
		const predicate = registry.term(statement.predicateId).iri;
		if (predicate === "http://www.w3.org/2000/01/rdf-schema#subClassOf") {
			const values = parents.get(subject) ?? new Set<string>();
			values.add(object);
			parents.set(subject, values);
		}
		if (predicate === "https://schema.org/domainIncludes") {
			const values = properties.get(object) ?? new Set<string>();
			values.add(subject);
			properties.set(object, values);
		}
	}
	return release.definitions
		.filter(
			(definition) =>
				definition.types.includes("http://www.w3.org/2000/01/rdf-schema#Class") &&
				release.source.namespaces.some((namespace) =>
					registry.term(definition.termId).iri.startsWith(namespace),
				),
		)
		.map((definition) => {
			const ancestors = new Set<string>(),
				queue = [definition.termId];
			for (let i = 0; i < queue.length; i++) {
				const id = queue[i]!;
				if (ancestors.has(id)) continue;
				ancestors.add(id);
				queue.push(...(parents.get(id) ?? []));
			}
			return {
				termId: definition.termId,
				iri: registry.term(definition.termId).iri,
				definitionId: definition.id,
				ancestors: [...ancestors].sort(),
				suggestedProperties: [
					...new Set([...ancestors].flatMap((id) => [...(properties.get(id) ?? [])])),
				].sort(),
				interpretation: "vocabulary description; not a native validation profile",
			};
		});
}
