import {
	ProfileSchema,
	RelationRevisionSchema,
	type ApplicationProfile,
	type RelationRevision,
} from "./contracts";
import { digest, schemaId, stableJson } from "./identity";
import type { VocabularyRegistry } from "./registry";

/** @alpha Compile explicit REZICS rules without treating vocabulary range/domain hints as validation. */
export function createProfile(
	input: Omit<ApplicationProfile, "id" | "revisionId" | "digest">,
): ApplicationProfile {
	const hash = digest(stableJson(input)),
		id = schemaId("profile", input.key);
	const profile = ProfileSchema.parse({
		...input,
		id,
		digest: hash,
		revisionId: schemaId("profile-revision", id, hash),
	});
	if (new Set(profile.rules.map((rule) => rule.predicateId)).size !== profile.rules.length)
		throw new TypeError("Duplicate profile predicate");
	for (const rule of profile.rules)
		if (rule.max !== null && rule.max < rule.min)
			throw new TypeError("Invalid profile cardinality");
	return profile;
}

/**
 * Compile all declared Schema.org classes, including multiple inheritance and every applicable property.
 * @alpha
 * @remarks These are complete vocabulary description profiles, not inferred business validation or publishing authority.
 */
export function compileDeclarationProfiles(registry: VocabularyRegistry): ApplicationProfile[] {
	const release = registry.release("schemaorg"),
		nodeById = new Map(release.nodes.map((node) => [node.id, node]));
	const iri = (id: string) => registry.term(id).iri;
	const parents = new Map<string, Set<string>>(),
		properties = new Map<string, Set<string>>();
	for (const statement of release.statements) {
		const subject = nodeById.get(statement.subjectId)?.termId,
			object = nodeById.get(statement.objectId)?.termId;
		if (!subject || !object) continue;
		const predicate = iri(statement.predicateId);
		if (predicate === "http://www.w3.org/2000/01/rdf-schema#subClassOf") {
			const values = parents.get(subject) ?? new Set<string>();
			values.add(object);
			parents.set(subject, values);
		} else if (predicate === "https://schema.org/domainIncludes") {
			const values = properties.get(object) ?? new Set<string>();
			values.add(subject);
			properties.set(object, values);
		}
	}
	const definitions = new Map(
		release.definitions.map((definition) => [definition.termId, definition]),
	);
	return release.definitions
		.filter(
			(definition) =>
				definition.types.includes("http://www.w3.org/2000/01/rdf-schema#Class") &&
				registry.term(definition.termId).iri.startsWith("https://schema.org/"),
		)
		.map((definition) => {
			const ancestors = new Set<string>(),
				queue = [definition.termId];
			for (let i = 0; i < queue.length; i++) {
				const current = queue[i]!;
				if (ancestors.has(current)) continue;
				ancestors.add(current);
				queue.push(...(parents.get(current) ?? []));
			}
			const predicates = new Set(
				[...ancestors].flatMap((ancestor) => [...(properties.get(ancestor) ?? [])]),
			);
			return createProfile({
				key: "schemaorg-" + digest(registry.term(definition.termId).iri).slice(0, 32),
				types: [definition.termId],
				additionalProperties: true,
				rules: [...predicates].sort().map((predicateId) => {
					const meaning = definitions.get(predicateId);
					if (!meaning) throw new TypeError("Applicable property has no pinned definition");
					return {
						predicateId,
						definitionId: meaning.id,
						min: 0,
						max: null,
						ordered: false,
						valueKinds: ["reference", "iri", "literal", "unknown", "no-value"],
					};
				}),
			});
		});
}

/**
 * @alpha Validate the selected description profile's explicit rules.
 * @remarks Endpoint existence, permissions, datatype value spaces and native domain invariants belong to the writer.
 */
export function validateDescription(
	profileInput: ApplicationProfile,
	input: { types: string[]; relations: RelationRevision[] },
): void {
	const profile = createProfile({
		key: profileInput.key,
		types: profileInput.types,
		rules: profileInput.rules,
		additionalProperties: profileInput.additionalProperties,
	});
	if (stableJson(profileInput) !== stableJson(profile))
		throw new TypeError("Profile content identity mismatch");
	if (!input.types.some((type) => profile.types.includes(type)))
		throw new TypeError("Description has no applicable profile type");
	const relations = input.relations.map((relation) => RelationRevisionSchema.parse(relation));
	if (new Set(relations.map((relation) => relation.relationId)).size !== relations.length)
		throw new TypeError("A description cannot count the same relation more than once");
	if (
		new Set(relations.map((relation) => `${relation.subject.owner}/${relation.subject.id}`)).size >
		1
	)
		throw new TypeError("Description relations belong to different subjects");
	const predicates = new Map(profile.rules.map((rule) => [rule.predicateId, rule]));
	for (const relation of relations) {
		const rule = predicates.get(relation.predicateId);
		if (!rule) {
			if (!profile.additionalProperties) throw new TypeError("Property is outside the profile");
			continue;
		}
		if (relation.definitionId !== rule.definitionId)
			throw new TypeError("Property meaning differs from the pinned profile");
		if (!rule.valueKinds.includes(relation.value.kind))
			throw new TypeError("Property value kind is outside the profile");
		if (!rule.ordered && relation.position !== null)
			throw new TypeError("Unordered property cannot assert an ordering position");
	}
	for (const rule of profile.rules) {
		const values = relations.filter((relation) => relation.predicateId === rule.predicateId);
		if (values.length < rule.min || (rule.max !== null && values.length > rule.max))
			throw new TypeError("Profile cardinality violated");
		if (
			rule.ordered &&
			(values.some((value) => value.position === null) ||
				new Set(values.map((value) => value.position)).size !== values.length)
		)
			throw new TypeError("Ordered property requires unique explicit positions");
	}
}
