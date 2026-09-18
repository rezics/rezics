import { desc, eq, getTableName, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";
import {
	LogicalReferenceSchema,
	RelationRevisionSchema,
	type LogicalReference,
	type RelationRevision,
} from "../contracts";
import { digest, stableJson } from "../identity";
import * as tables from "../postgres/vocabulary";
import type { CompiledModel } from "../model/contracts";
import { verifyModel, requireModelWriter } from "../model/runtime";
import { validateSemanticValue } from "../model/datatypes";
export type SchemaTransaction = Parameters<Parameters<NodePgDatabase["transaction"]>[0]>[0];
/** @alpha Store an immutable common edit; retrying an ID with different content is rejected. */
export async function putChange(
	tx: SchemaTransaction,
	input: { id: string; actor: { owner: string; id: string } | null; message: string },
): Promise<void> {
	input = {
		...input,
		id: z.uuid().toLowerCase().parse(input.id),
		actor: input.actor ? LogicalReferenceSchema.parse(input.actor) : null,
	};
	if (!input.message || Buffer.byteLength(input.message) > 16_384)
		throw new TypeError("Invalid edit message");
	await tx.insert(tables.schemaChange).values(input).onConflictDoNothing();
	const [stored] = await tx
		.select()
		.from(tables.schemaChange)
		.where(eq(tables.schemaChange.id, input.id));
	if (
		!stored ||
		stored.message !== input.message ||
		stableJson(stored.actor) !== stableJson(input.actor)
	)
		throw new TypeError("Edit ID reused with different content");
}

/** @alpha Endpoint validation is supplied by the owning service and executes inside the same transaction. */
export type ReferenceValidator = (
	reference: LogicalReference,
	tx: SchemaTransaction,
) => Promise<void>;
/** @alpha Select another physical family without changing logical records or command semantics. */
export type RelationTables = ReturnType<typeof tables.defineRelationTables>;
const defaultFamily: RelationTables = {
	relation: tables.schemaRelation,
	revision: tables.schemaRelationRevision,
	selection: tables.schemaRelationSelection,
};

/** @alpha Include these guards in migrations for additional relation families after installing package migrations. */
export function relationIntegritySql(family: RelationTables): string {
	const names = [family.relation, family.revision, family.selection].map(getTableName);
	if (names.some((name) => !/^[a-z][a-z0-9_]{0,62}$/u.test(name)))
		throw new TypeError("Invalid relation family name");
	return (
		names
			.map(
				(name) =>
					`CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public."${name}" FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();`,
			)
			.join("\n") +
		`\nCREATE OR REPLACE TRIGGER schema_revision_parent BEFORE INSERT ON public."${names[1]}" FOR EACH ROW EXECUTE FUNCTION public.schema_require_prior_revision();\n`
	);
}

/** @alpha Append an addressable assertion; creating a proposal does not adopt it as current truth. */
export async function putRelationRevision(
	tx: SchemaTransaction,
	raw: RelationRevision,
	validateReference: ReferenceValidator,
	family: RelationTables = defaultFamily,
): Promise<void> {
	const input = RelationRevisionSchema.parse(raw),
		hash = digest(stableJson(input));
	if (input.model) {
		const [profile] = await tx
			.select({ body: tables.schemaModelProfile.body })
			.from(tables.schemaModelProfile)
			.where(
				sql`${tables.schemaModelProfile.modelId}=${input.model.id}::uuid and ${tables.schemaModelProfile.key}=${input.model.profileKey}`,
			);
		if (!profile) throw new TypeError("Relation model profile is not installed");
		validateIndependentProperty(profile.body, input);
	}
	await validateReference(input.subject, tx);
	if (input.value.kind === "reference") await validateReference(input.value.reference, tx);
	await tx
		.insert(family.relation)
		.values({
			id: input.relationId,
			subjectOwner: input.subject.owner,
			subjectId: input.subject.id,
		})
		.onConflictDoNothing();
	const [relation] = await tx
		.select()
		.from(family.relation)
		.where(eq(family.relation.id, input.relationId));
	if (
		!relation ||
		relation.subjectOwner !== input.subject.owner ||
		relation.subjectId !== input.subject.id
	)
		throw new TypeError("Relation identity belongs to another subject");
	await tx
		.insert(family.revision)
		.values({
			id: input.id,
			relationId: input.relationId,
			predicateId: input.predicateId,
			definitionId: input.definitionId,
			modelId: input.model?.id ?? null,
			profileKey: input.model?.profileKey ?? null,
			subjectRevisionId: input.subject.revisionId ?? null,
			parentRevisionId: input.parentRevisionId,
			changeId: input.changeId,
			value: input.value,
			position: input.position,
			digest: hash,
		})
		.onConflictDoNothing();
	const [stored] = await tx.select().from(family.revision).where(eq(family.revision.id, input.id));
	if (!stored || stored.digest !== hash)
		throw new TypeError("Relation revision ID reused with different content");
}

/** @alpha Select or retract an exact assertion revision while retaining conflicting proposals and prior decisions. */
export async function selectRelationRevision(
	tx: SchemaTransaction,
	input: {
		id: string;
		relationId: string;
		revisionId: string | null;
		expectedVersion: number;
		changeId: string;
	},
	family: RelationTables = defaultFamily,
): Promise<number> {
	input = {
		...input,
		id: z.uuid().toLowerCase().parse(input.id),
		relationId: z.uuid().toLowerCase().parse(input.relationId),
		revisionId: z.uuid().toLowerCase().nullable().parse(input.revisionId),
		changeId: z.uuid().toLowerCase().parse(input.changeId),
	};
	z.number()
		.int()
		.min(0)
		.max(Number.MAX_SAFE_INTEGER - 1)
		.parse(input.expectedVersion);
	const [relation] = await tx
		.select()
		.from(family.relation)
		.where(eq(family.relation.id, input.relationId))
		.for("update");
	if (!relation) throw new TypeError("Relation is missing");
	const [retry] = await tx.select().from(family.selection).where(eq(family.selection.id, input.id));
	if (retry) {
		if (
			retry.relationId !== input.relationId ||
			retry.revisionId !== input.revisionId ||
			retry.changeId !== input.changeId ||
			retry.version !== input.expectedVersion + 1
		)
			throw new TypeError("Selection ID reused with different content");
		return retry.version;
	}
	const [latest] = await tx
		.select()
		.from(family.selection)
		.where(eq(family.selection.relationId, input.relationId))
		.orderBy(desc(family.selection.version))
		.limit(1);
	if ((latest?.version ?? 0) !== input.expectedVersion)
		throw new TypeError("Relation selection changed");
	await tx.insert(family.selection).values({
		id: input.id,
		relationId: input.relationId,
		revisionId: input.revisionId,
		changeId: input.changeId,
		version: input.expectedVersion + 1,
	});
	return input.expectedVersion + 1;
}

function validateIndependentProperty(
	profile: CompiledModel["profiles"][number],
	input: RelationRevision,
) {
	if (profile.owner !== input.subject.owner)
		throw new TypeError("Relation profile and logical owner disagree");
	const rule = profile.properties.find((rule) => rule.predicateId === input.predicateId);
	if (!rule || rule.storage.writer !== "semantic.relations")
		throw new TypeError("This property belongs to another native writer");
	if (rule.min !== 0 || rule.max !== null || rule.ordered || rule.uniqueLanguage)
		throw new TypeError("This property requires its aggregate constraint writer");
	if (input.definitionId !== rule.definitionId || !rule.valueKinds.includes(input.value.kind))
		throw new TypeError("Relation value differs from the reviewed model");
	const literal = validateSemanticValue(input.value);
	if (literal.status !== "valid") throw new TypeError(literal.reason);
	if (
		input.value.kind === "literal" &&
		rule.datatypes.length &&
		!rule.datatypes.includes(input.value.datatype)
	)
		throw new TypeError("Relation datatype differs from its model");
	if (
		input.value.kind === "reference" &&
		rule.targetOwners.length &&
		!rule.targetOwners.includes(input.value.reference.owner)
	)
		throw new TypeError("Relation target differs from its model");
}
/** @alpha Validate one independent semantic property and append its exact installed model context. Bounded/ordered sets use their aggregate writer. */
export async function putProfiledRelationRevision(
	tx: SchemaTransaction,
	modelInput: unknown,
	profileKey: string,
	input: RelationRevision,
	validateReference: ReferenceValidator,
	family: RelationTables = defaultFamily,
) {
	input = RelationRevisionSchema.parse(input);
	const model = verifyModel(modelInput),
		profile = model.profiles.find((profile) => profile.key === profileKey);
	if (!profile) throw new TypeError("Unknown relation profile");
	requireModelWriter(model, profileKey, input.predicateId, "semantic.relations");
	validateIndependentProperty(profile, input);
	await putRelationRevision(
		tx,
		{ ...input, model: { id: model.id, profileKey } },
		validateReference,
		family,
	);
}
