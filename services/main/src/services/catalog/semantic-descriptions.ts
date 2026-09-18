import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { digest, stableJson, termId } from "@rezics/schema/identity";
import {
	descriptionChange,
	descriptionObject,
	descriptionRevision,
	descriptionSelection,
	descriptionStatement,
	descriptionType,
} from "@rezics/schema/postgres";
import type { DatabaseTransaction } from "../database";

const statement = z
	.strictObject({
		id: z.uuid(),
		predicateId: z.uuid(),
		state: z.enum(["literal", "reference", "unknown", "no-value"]),
		datatypeIri: z.string().optional(),
		lexical: z.string().optional(),
		language: z.string().optional(),
		nativeTargetRefId: z.uuid().optional(),
		descriptionTargetId: z.uuid().optional(),
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
	objectId: z.uuid(),
	revisionId: z.uuid(),
	parentId: z.uuid().nullable(),
	changeId: z.uuid(),
	nonce: z.string().min(1).max(256),
	actorUserId: z.uuid().nullable(),
	types: z.array(z.uuid()).min(1).max(64),
	statements: z.array(statement).max(2048),
	summary: z.string().max(8192).nullable(),
});

/** @alpha Append a native description without inventing a provider-specific content table or adopting it implicitly. */
export async function writeSemanticDescription(
	tx: DatabaseTransaction,
	input: z.input<typeof revision>,
) {
	const value = revision.parse(input),
		payloadDigest = digest(stableJson(value));
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
		return value.revisionId;
	}
	await tx
		.insert(descriptionChange)
		.values({
			id: value.changeId,
			objectId: value.objectId,
			actorUserId: value.actorUserId,
			nonce: value.nonce,
			payloadDigest,
			summary: value.summary,
		});
	await tx
		.insert(descriptionRevision)
		.values({
			objectId: value.objectId,
			id: value.revisionId,
			parentId: value.parentId,
			changeId: value.changeId,
		});
	await tx
		.insert(descriptionType)
		.values(
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
	return value.revisionId;
}

/** @alpha Adoption uses the object's local authority row and an expected selection version. */
export async function selectSemanticDescription(
	tx: DatabaseTransaction,
	input: { objectId: string; revisionId: string; expectedVersion: number; changeId: string },
) {
	z.uuid().parse(input.objectId);
	z.uuid().parse(input.revisionId);
	z.uuid().parse(input.changeId);
	z.number().int().nonnegative().parse(input.expectedVersion);
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
	await tx
		.insert(descriptionSelection)
		.values(next)
		.onConflictDoUpdate({ target: descriptionSelection.objectId, set: next });
	return next;
}
