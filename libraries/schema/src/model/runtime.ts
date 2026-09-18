import { z } from "zod";
import { LogicalReferenceSchema, SemanticValueSchema } from "../contracts";
import { digest, schemaId, stableJson } from "../identity";
import { CompiledModelSchema, type CompiledModel } from "./contracts";
import { validateSemanticValue } from "./datatypes";
export { CompiledModelSchema, type CompiledModel } from "./contracts";
export { datatypeDefinitions, validateDatatype, validateSemanticValue } from "./datatypes";
export const ModelRecordSchema = z.strictObject({
	subject: LogicalReferenceSchema,
	types: z.array(z.uuid().toLowerCase()).min(1).max(64),
	statements: z
		.array(
			z.strictObject({
				id: z.uuid().toLowerCase(),
				predicateId: z.uuid().toLowerCase(),
				definitionId: z.uuid().toLowerCase().optional(),
				value: SemanticValueSchema,
				position: z
					.string()
					.regex(/^(0|[1-9][0-9]*)$/)
					.max(40)
					.nullable()
					.default(null),
			}),
		)
		.max(2048),
});
export type ModelRecord = z.input<typeof ModelRecordSchema>;
/** @alpha Verify portable model identity before accepting its constraints or write-routing decisions. */
export function verifyModel(input: unknown): CompiledModel {
	const model = CompiledModelSchema.parse(input),
		{ id, digest: hash, ...content } = model;
	if (digest(stableJson(content)) !== hash || schemaId("application-model", hash) !== id)
		throw new TypeError("Compiled model identity does not match its content");
	return model;
}
/** @alpha Find candidates without choosing an ambiguous referent such as Book work versus publication. */
export function candidateProfiles(model: CompiledModel, types: readonly string[]) {
	return model.profiles
		.filter((profile) => profile.types.some((type) => types.includes(type.termId)))
		.map((profile) => ({ key: profile.key, grain: profile.grain, owner: profile.owner }));
}
/**
 * Validate a complete bounded description revision and return explicit write authorities.
 * @alpha
 * @remarks Native writers still own authorization, endpoint existence, transactional state and specialized constraints. Description preservation is never reported as native adoption.
 */
export function validateModelRecord(
	inputModel: unknown,
	profileKey: string,
	input: ModelRecord,
	mode: "native-write" | "description" = "native-write",
) {
	const model = verifyModel(inputModel),
		record = ModelRecordSchema.parse(input),
		profile = model.profiles.find((profile) => profile.key === profileKey);
	if (!profile) throw new TypeError(`Unknown native profile: ${profileKey}`);
	if (profile.owner !== record.subject.owner)
		throw new TypeError("Profile and logical owner disagree");
	if (!profile.types.some((type) => record.types.includes(type.termId)))
		throw new TypeError("Record does not declare a type in the chosen profile");
	if (new Set(record.statements.map((statement) => statement.id)).size !== record.statements.length)
		throw new TypeError("Repeated assertion identity in one revision");
	const rules = new Map(profile.properties.map((rule) => [rule.predicateId, rule])),
		unmapped: string[] = [],
		unsupportedDatatypes: string[] = [],
		authorities = new Map<string, (typeof profile.properties)[number]["storage"]>();
	for (const statement of record.statements) {
		const literal = validateSemanticValue(statement.value);
		if (literal.status === "invalid") throw new TypeError(literal.reason);
		if (literal.status === "unsupported") {
			if (mode === "native-write") throw new TypeError(literal.reason);
			unsupportedDatatypes.push(statement.id);
		}
		const rule = rules.get(statement.predicateId);
		if (!rule) {
			if (profile.additionalProperties === "reject" || mode === "native-write")
				throw new TypeError("Property has no reviewed native write mapping");
			unmapped.push(statement.id);
			continue;
		}
		if (statement.definitionId !== undefined && statement.definitionId !== rule.definitionId)
			throw new TypeError("Assertion uses another meaning revision");
		if (!rule.valueKinds.includes(statement.value.kind))
			throw new TypeError("Property value kind is outside the reviewed model");
		if (
			statement.value.kind === "literal" &&
			rule.datatypes.length &&
			!rule.datatypes.includes(statement.value.datatype)
		)
			throw new TypeError("Property datatype is outside the reviewed model");
		if (
			statement.value.kind === "reference" &&
			rule.targetOwners.length &&
			!rule.targetOwners.includes(statement.value.reference.owner)
		)
			throw new TypeError("Property target owner is outside the reviewed model");
		authorities.set(statement.predicateId, rule.storage);
	}
	for (const rule of profile.properties) {
		const statements = record.statements.filter(
			(statement) => statement.predicateId === rule.predicateId,
		);
		if (statements.length < rule.min || (rule.max !== null && statements.length > rule.max))
			throw new TypeError("Property cardinality is outside the reviewed model");
		if (
			rule.ordered &&
			(statements.some((statement) => statement.position === null) ||
				new Set(statements.map((statement) => statement.position)).size !== statements.length)
		)
			throw new TypeError("An ordered native property requires distinct explicit positions");
		if (rule.uniqueLanguage) {
			const languages = statements
				.filter((statement) => statement.value.kind === "literal")
				.map((statement) =>
					statement.value.kind === "literal" ? (statement.value.language ?? "").toLowerCase() : "",
				);
			if (new Set(languages).size !== languages.length)
				throw new TypeError("Preferred labels must be unique per language");
		}
	}
	return {
		modelId: model.id,
		profileKey,
		scope: mode,
		unmapped,
		unsupportedDatatypes,
		authorities: [...authorities].map(([predicateId, storage]) => ({ predicateId, ...storage })),
	};
}
/** @alpha Enforce one authoritative writer for a reviewed predicate rather than permitting shadow copies in a generic relation table. */
export function requireModelWriter(
	model: CompiledModel,
	profileKey: string,
	predicateId: string,
	writer: string,
) {
	const rule = model.profiles
		.find((profile) => profile.key === profileKey)
		?.properties.find((rule) => rule.predicateId === predicateId);
	if (!rule || rule.storage.writer !== writer)
		throw new TypeError("This property belongs to another native writer");
	return rule;
}
