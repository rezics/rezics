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

/** @alpha Initial description profiles exercise different workloads without coupling them to physical tables. */
export function initialProfiles(registry: VocabularyRegistry): ApplicationProfile[] {
	const schema = "https://schema.org/";
	const make = (key: string, types: string[], properties: string[]) =>
		createProfile({
			key,
			types: types.map((type) => registry.term(schema + type).id),
			additionalProperties: true,
			rules: properties
				.map((property) => {
					const predicate = registry.term(schema + property),
						definition = registry.definition(predicate.id, "schemaorg");
					return {
						predicateId: predicate.id,
						definitionId: definition.id,
						min: 0,
						max: null,
						ordered: false,
						valueKinds:
							property === "name" || property === "text"
								? (["literal"] as const)
								: (["reference", "iri", "literal", "unknown", "no-value"] as const),
					};
				})
				.map((rule) => ({ ...rule, valueKinds: [...rule.valueKinds] })),
		});
	return [
		make("book", ["Book"], ["name", "author", "creator", "image", "isbn"]),
		make("image", ["ImageObject"], ["name", "creator", "contentUrl", "encodingFormat"]),
		make("video", ["VideoObject"], ["name", "creator", "contentUrl", "duration", "thumbnail"]),
		make("wiki", ["Article", "WebPage"], ["name", "text", "about", "citation"]),
		make("forum", ["DiscussionForumPosting", "Comment"], ["text", "author", "about"]),
		make("message", ["Message"], ["text", "sender", "recipient"]),
	];
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
