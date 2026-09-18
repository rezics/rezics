import { and, eq, inArray, sql } from "drizzle-orm";
import { validateModelRecord, verifyModel } from "@rezics/schema/model";
import { referenceValueNativeIdExpression } from "@rezics/schema/postgres/knowledge/reference-value";
import { unitReferenceOwnerExpression } from "@rezics/schema/postgres/shared/unit-reference-columns";
import { z } from "zod";
import { digest, stableJson, termId } from "@rezics/schema/identity";
import {
	descriptionChange,
	descriptionObject,
	descriptionRevision,
	descriptionSelection,
	descriptionStatement,
	descriptionType,
	schemaModelRelease,
	schemaReleaseTerm,
	schemaTerm,
	schemaTermAlias,
	referenceValue,
} from "@rezics/schema/postgres";
import type { DatabaseTransaction } from "../database";

const statement = z
	.strictObject({
		id: z.uuid().toLowerCase(),
		predicateId: z.uuid().toLowerCase(),
		definitionId: z.uuid().toLowerCase(),
		state: z.enum(["literal", "reference", "unknown", "no-value"]),
		datatypeIri: z.string().optional(),
		lexical: z.string().optional(),
		language: z.string().optional(),
		nativeTargetRefId: z.uuid().toLowerCase().optional(),
		descriptionTargetId: z.uuid().toLowerCase().optional(),
		externalIri: z.string().optional(),
		orderKey: z.string().optional(),
	})
	.superRefine((value, ctx) => {
		const literal = [value.datatypeIri, value.lexical, value.language].filter(
			(item) => item !== undefined,
		).length;
		const targets = [value.nativeTargetRefId, value.descriptionTargetId, value.externalIri].filter(
			(item) => item !== undefined,
		).length;
		if (
			value.state === "literal"
				? value.datatypeIri === undefined || value.lexical === undefined || targets !== 0
				: value.state === "reference"
					? targets !== 1 || literal !== 0
					: targets !== 0 || literal !== 0
		)
			ctx.addIssue({ code: "custom", message: "Statement value does not match its state" });
	});
const revision = z.strictObject({
	modelId: z.uuid().toLowerCase(),
	profileKey: z.string(),
	objectId: z.uuid().toLowerCase(),
	revisionId: z.uuid().toLowerCase(),
	parentId: z.uuid().toLowerCase().nullable(),
	changeId: z.uuid().toLowerCase(),
	nonce: z.string().min(1).max(256),
	actorUserId: z.uuid().toLowerCase().nullable(),
	types: z.array(z.uuid().toLowerCase()).min(1).max(64),
	statements: z.array(statement).max(2048),
	summary: z.string().max(8192).nullable(),
});

/** @alpha Append a native description without inventing a provider-specific content table or adopting it implicitly. */
export async function writeSemanticDescription(
	tx: DatabaseTransaction,
	input: z.input<typeof revision>,
) {
	const value = revision.parse(input),
		payload = stableJson(value),
		payloadDigest = digest(payload);
	if (Buffer.byteLength(payload) > 8_388_608)
		throw new RangeError("Description revision exceeds the 8 MiB payload budget");
	const [installed] = await tx
		.select({ body: schemaModelRelease.body })
		.from(schemaModelRelease)
		.where(eq(schemaModelRelease.id, value.modelId));
	if (!installed) throw new TypeError("Application model is not installed");
	const model = verifyModel(installed.body),
		profile = model.profiles.find((profile) => profile.key === value.profileKey);
	if (!profile || profile.identity.table !== "description_object")
		throw new TypeError("This profile requires its native domain writer");
	const releaseIds = model.sourceReleases.map((release) => release.id);
	const termIds = [
		...new Set([...value.types, ...value.statements.map((item) => item.predicateId)]),
	];
	const meanings = await tx
		.select()
		.from(schemaReleaseTerm)
		.where(
			and(
				inArray(schemaReleaseTerm.termId, termIds),
				inArray(schemaReleaseTerm.releaseId, releaseIds),
			),
		);
	const declaredTerms = new Set(meanings.map((meaning) => meaning.termId));
	if (value.types.some((type) => !declaredTerms.has(type)))
		throw new TypeError("Description type is outside the pinned model vocabularies");
	const meaningPairs = new Set(
		meanings.map((meaning) => `${meaning.termId}:${meaning.definitionId}`),
	);
	const referenceIds = [
		...new Set(
			value.statements.flatMap((item) => (item.nativeTargetRefId ? [item.nativeTargetRefId] : [])),
		),
	];
	const references = referenceIds.length
		? await tx
				.select({
					referenceId: referenceValue.id,
					id: referenceValueNativeIdExpression(referenceValue),
					owner: sql<string>`coalesce(${unitReferenceOwnerExpression("target", referenceValue)},case when ${referenceValue.targetDescriptionId} is not null then 'description' when ${referenceValue.targetWikiId} is not null then 'wiki' when ${referenceValue.targetIndexedMediaId} is not null then 'indexed_media' when ${referenceValue.targetVocabularyTermId} is not null then 'vocabulary_term' when ${referenceValue.targetSemanticRelationId} is not null then 'semantic_relation' end)`,
				})
				.from(referenceValue)
				.where(inArray(referenceValue.id, referenceIds))
		: [];
	const referencesById = new Map(references.map((reference) => [reference.referenceId, reference]));
	const statements = [];
	for (const item of value.statements) {
		let semantic: import("@rezics/schema").SemanticValue;
		if (item.state === "literal")
			semantic = {
				kind: "literal",
				datatype: item.datatypeIri!,
				value: item.lexical!,
				...(item.language ? { language: item.language } : {}),
			};
		else if (item.state === "reference") {
			if (item.externalIri) semantic = { kind: "iri", iri: item.externalIri };
			else if (item.descriptionTargetId)
				semantic = {
					kind: "reference",
					reference: { owner: "description", id: item.descriptionTargetId },
				};
			else {
				const reference = referencesById.get(item.nativeTargetRefId!);
				if (!reference) throw new TypeError("Description reference target is unavailable");
				semantic = {
					kind: "reference",
					reference: { owner: reference.owner, id: z.uuid().toLowerCase().parse(reference.id) },
				};
			}
		} else semantic = { kind: item.state };
		if (!meaningPairs.has(`${item.predicateId}:${item.definitionId}`))
			throw new TypeError("Assertion meaning is outside the pinned model vocabulary releases");
		statements.push({
			id: item.id,
			predicateId: item.predicateId,
			definitionId: item.definitionId,
			value: semantic,
			position: item.orderKey ?? null,
		});
	}
	const validation = validateModelRecord(
		model,
		value.profileKey,
		{ subject: { owner: profile.owner, id: value.objectId }, types: value.types, statements },
		"description",
	);
	const [target] = await tx
		.select()
		.from(descriptionObject)
		.where(eq(descriptionObject.id, value.objectId))
		.for("update");
	if (!target || target.state === "erased") throw new TypeError("Description is unavailable");
	const [receipt] = await tx
		.select()
		.from(descriptionChange)
		.where(
			and(eq(descriptionChange.objectId, value.objectId), eq(descriptionChange.nonce, value.nonce)),
		);
	if (receipt) {
		if (receipt.payloadDigest !== payloadDigest)
			throw new TypeError("Description nonce reused with different content");
		return { revisionId: value.revisionId, validation };
	}
	// Datatype IRIs are addressable even when their value spaces are unsupported.
	// This retains an opaque literal without inventing a native interpretation.
	const datatypes = [
		...new Set(value.statements.flatMap((item) => (item.datatypeIri ? [item.datatypeIri] : []))),
	].map((iri) => ({ id: termId(iri), iri, iriHash: digest(iri) }));
	if (datatypes.length) {
		const aliases = await tx
			.select()
			.from(schemaTermAlias)
			.where(
				inArray(
					schemaTermAlias.iriHash,
					datatypes.map((type) => type.iriHash),
				),
			);
		if (
			aliases.some((alias) =>
				datatypes.some((type) => type.iriHash === alias.iriHash && type.id !== alias.termId),
			)
		)
			throw new TypeError("Datatype IRI is an alias; use its canonical term IRI");
		await tx.insert(schemaTerm).values(datatypes).onConflictDoNothing();
		const stored = await tx
			.select()
			.from(schemaTerm)
			.where(
				inArray(
					schemaTerm.id,
					datatypes.map((type) => type.id),
				),
			);
		if (
			stored.length !== datatypes.length ||
			stored.some(
				(row) =>
					!datatypes.some(
						(type) => type.id === row.id && type.iri === row.iri && type.iriHash === row.iriHash,
					),
			)
		)
			throw new TypeError("Datatype identity conflicts with its IRI");
	}
	await tx.insert(descriptionChange).values({
		id: value.changeId,
		objectId: value.objectId,
		actorUserId: value.actorUserId,
		nonce: value.nonce,
		payloadDigest,
		summary: value.summary,
	});
	await tx.insert(descriptionRevision).values({
		objectId: value.objectId,
		id: value.revisionId,
		modelId: value.modelId,
		profileKey: value.profileKey,
		parentId: value.parentId,
		changeId: value.changeId,
	});
	await tx.insert(descriptionType).values(
		[...new Set(value.types)].map((typeId) => ({
			objectId: value.objectId,
			revisionId: value.revisionId,
			typeId,
		})),
	);
	if (value.statements.length)
		await tx.insert(descriptionStatement).values(
			value.statements.map((item) => ({
				objectId: value.objectId,
				revisionId: value.revisionId,
				id: item.id,
				predicateId: item.predicateId,
				definitionId: item.definitionId,
				state: item.state,
				datatypeId: item.datatypeIri ? termId(item.datatypeIri) : null,
				lexical: item.lexical ?? null,
				language: item.language ?? null,
				valueHash:
					item.state === "literal"
						? digest(stableJson([item.datatypeIri, item.lexical, item.language ?? null]))
						: null,
				nativeTargetRefId: item.nativeTargetRefId ?? null,
				descriptionTargetId: item.descriptionTargetId ?? null,
				externalIri: item.externalIri ?? null,
				orderKey: item.orderKey ?? null,
			})),
		);
	return { revisionId: value.revisionId, validation };
}

/** @alpha Adoption uses the object's local authority row and an expected selection version. */
export async function selectSemanticDescription(
	tx: DatabaseTransaction,
	input: { objectId: string; revisionId: string; expectedVersion: number; changeId: string },
) {
	z.uuid().toLowerCase().parse(input.objectId);
	z.uuid().toLowerCase().parse(input.revisionId);
	z.uuid().toLowerCase().parse(input.changeId);
	z.number()
		.int()
		.nonnegative()
		.max(Number.MAX_SAFE_INTEGER - 1)
		.parse(input.expectedVersion);
	const [target] = await tx
		.select()
		.from(descriptionObject)
		.where(eq(descriptionObject.id, input.objectId))
		.for("update");
	if (!target || target.state === "erased") throw new TypeError("Description is unavailable");
	const [selected] = await tx
		.select()
		.from(descriptionRevision)
		.where(
			and(
				eq(descriptionRevision.objectId, input.objectId),
				eq(descriptionRevision.id, input.revisionId),
			),
		)
		.for("share");
	if (!selected || selected.payloadState !== "available")
		throw new TypeError("Description revision is unavailable");
	const [current] = await tx
		.select()
		.from(descriptionSelection)
		.where(eq(descriptionSelection.objectId, input.objectId));
	if ((current?.version ?? 0) !== input.expectedVersion)
		throw new TypeError("Description selection changed");
	const next = {
		objectId: input.objectId,
		revisionId: input.revisionId,
		version: input.expectedVersion + 1,
		changeId: input.changeId,
	};
	if (current)
		await tx
			.update(descriptionSelection)
			.set(next)
			.where(eq(descriptionSelection.objectId, input.objectId));
	else await tx.insert(descriptionSelection).values(next);
	return next;
}

/** @alpha Read an exact description revision with the model that interpreted it; caller owns disclosure policy. */
export async function readSemanticDescription(
	tx: DatabaseTransaction,
	objectId: string,
	revisionId: string,
) {
	objectId = z.uuid().toLowerCase().parse(objectId);
	revisionId = z.uuid().toLowerCase().parse(revisionId);
	const [revision] = await tx
		.select()
		.from(descriptionRevision)
		.where(and(eq(descriptionRevision.objectId, objectId), eq(descriptionRevision.id, revisionId)));
	if (!revision || revision.payloadState !== "available") return null;
	const [owner] = await tx
		.select({ state: descriptionObject.state })
		.from(descriptionObject)
		.where(eq(descriptionObject.id, objectId));
	if (!owner || owner.state === "erased") return null;
	const [model] = await tx
		.select({ body: schemaModelRelease.body })
		.from(schemaModelRelease)
		.where(eq(schemaModelRelease.id, revision.modelId));
	if (!model) throw new TypeError("Pinned model is unavailable");
	const types = await tx
		.select({ id: descriptionType.typeId })
		.from(descriptionType)
		.where(and(eq(descriptionType.objectId, objectId), eq(descriptionType.revisionId, revisionId)));
	const statements = await tx
		.select({ statement: descriptionStatement, datatypeIri: schemaTerm.iri })
		.from(descriptionStatement)
		.leftJoin(schemaTerm, eq(schemaTerm.id, descriptionStatement.datatypeId))
		.where(
			and(
				eq(descriptionStatement.objectId, objectId),
				eq(descriptionStatement.revisionId, revisionId),
			),
		)
		.orderBy(sql`${descriptionStatement.orderKey}::numeric nulls last`, descriptionStatement.id)
		.limit(2049);
	if (statements.length > 2048)
		throw new RangeError("Description read exceeds its statement budget");
	return {
		revision,
		model: verifyModel(model.body),
		types: types.map((type) => type.id),
		statements: statements.map((row) => ({ ...row.statement, datatypeIri: row.datatypeIri })),
	};
}
