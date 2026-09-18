import { and, eq, gt, isNull, or } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import {
	publishingInstallment,
	publishingPublication,
	publishingPublicationText,
	publishingPublicationWork,
	publishingSerialization,
	publishingTextVersion,
	publishingTextWork,
	publishingWork,
} from "@rezics/schema/postgres/publishing/publishing";
import { isFractionalPosition } from "@rezics/schema/contracts/native/positions";
import { CatalogPartialDateSchema, type CatalogReference } from "@rezics/schema/contracts/native/catalog";
import { assertCatalogDefinitionTarget } from "./definitions";
import {
	addCatalogName,
	assertReadableTargets,
	createCatalogIdentity,
	loadCatalogIdentity,
	recordCatalogChange,
} from "./storage";

const title = z.strictObject({
	languageTag: z.string().nullable(),
	value: z.string().min(1).max(131_072),
});
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

import { PublishingStructureSchema } from "@rezics/schema/contracts/native/structures";
export { PublishingStructureSchema };

/** Native corrections do not overwrite a source snapshot or invent a missing parent layer. @internal */
export async function updatePublishingStructure(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: z.input<typeof PublishingStructureSchema>,
) {
	if (reference.owner !== "publishing") throw new TypeError("Expected publishing owner");
	const value = PublishingStructureSchema.parse(input);
	await requirePublishing(tx, reference.id, actor, value.shape);
	if (value.shape === "text_version" && value.fields.methodRevisionId)
		await assertCatalogDefinitionTarget(
			tx,
			value.fields.methodRevisionId,
			"vocabulary",
			{ owner: "publishing", shape: "text_version" },
			"method",
		);
	if (value.shape === "serialization" && value.fields.statusRevisionId)
		await assertCatalogDefinitionTarget(
			tx,
			value.fields.statusRevisionId,
			"vocabulary",
			{ owner: "publishing", shape: "serialization" },
			"status",
		);
	if (value.shape === "serialization" && value.fields.textVersionId)
		await requirePublishing(tx, value.fields.textVersionId, actor, "text_version");
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedRevision,
		"publishing.structure.replace",
	);
	switch (value.shape) {
		case "work":
			await tx
				.insert(publishingWork)
				.values({ id: reference.id })
				.onConflictDoUpdate({ target: publishingWork.id, set: { id: reference.id } });
			break;
		case "text_version":
			await tx
				.insert(publishingTextVersion)
				.values({ id: reference.id, ...value.fields })
				.onConflictDoUpdate({ target: publishingTextVersion.id, set: value.fields });
			break;
		case "publication":
			await tx
				.insert(publishingPublication)
				.values({ id: reference.id, ...value.fields })
				.onConflictDoUpdate({ target: publishingPublication.id, set: value.fields });
			break;
		case "serialization":
			await tx
				.insert(publishingSerialization)
				.values({ id: reference.id, ...value.fields })
				.onConflictDoUpdate({ target: publishingSerialization.id, set: value.fields });
			break;
	}
	return { revision };
}

async function requirePublishing(
	tx: DatabaseTransaction,
	id: string,
	actor: string | null,
	shape: string,
) {
	const identity = await loadCatalogIdentity(tx, { owner: "publishing", id }, actor, false);
	if (identity.shape !== shape) throw new TypeError(`Expected publishing ${shape}`);
	return identity;
}

/** A serialization can exist before its exact text version is identified. @internal */
export async function createSerialization(
	tx: DatabaseTransaction,
	actor: string,
	input: {
		name: z.input<typeof title>;
		textVersionId?: string | null;
		statusRevisionId?: string | null;
	},
) {
	const value = z
		.strictObject({
			name: title,
			textVersionId: z.uuid().nullable().default(null),
			statusRevisionId: z.uuid().nullable().default(null),
		})
		.parse(input);
	if (value.textVersionId) await requirePublishing(tx, value.textVersionId, actor, "text_version");
	if (value.statusRevisionId)
		await assertCatalogDefinitionTarget(
			tx,
			value.statusRevisionId,
			"vocabulary",
			{ owner: "publishing", shape: "serialization" },
			"status",
		);
	const identity = await createCatalogIdentity(
		tx,
		{ owner: "publishing", shape: "serialization" },
		actor,
	);
	await tx.insert(publishingSerialization).values({
		id: identity.id,
		textVersionId: value.textVersionId,
		statusRevisionId: value.statusRevisionId,
	});
	const named = await addCatalogName(tx, identity, actor, identity.revision, {
		...value.name,
		kind: "primary",
	});
	return { ...identity, revision: named.revision };
}

export const PublishingCoverageSchema = z.discriminatedUnion("kind", [
	z.strictObject({
		kind: z.literal("text_work"),
		targetId: z.uuid(),
		position: count,
		coverageText: z.string().max(131_072).nullable().default(null),
	}),
	z.strictObject({
		kind: z.literal("publication_text"),
		targetId: z.uuid(),
		position: count,
		coverageText: z.string().max(131_072).nullable().default(null),
	}),
	z.strictObject({
		kind: z.literal("publication_work"),
		targetId: z.uuid(),
		position: count,
		coverageText: z.string().max(131_072).nullable().default(null),
	}),
]);

/** Records known coverage without inventing an intermediate Work or text-version layer. @internal */
export async function putPublishingCoverage(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: z.input<typeof PublishingCoverageSchema>,
) {
	const value = PublishingCoverageSchema.parse(input);
	if (reference.owner !== "publishing") throw new TypeError("Expected publishing owner");
	await requirePublishing(
		tx,
		reference.id,
		actor,
		value.kind === "text_work" ? "text_version" : "publication",
	);
	await requirePublishing(
		tx,
		value.targetId,
		actor,
		value.kind === "publication_text" ? "text_version" : "work",
	);
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedRevision,
		"publishing.coverage.put",
	);
	const fields = { position: value.position, coverageText: value.coverageText };
	if (value.kind === "text_work")
		await tx
			.insert(publishingTextWork)
			.values({ textVersionId: reference.id, workId: value.targetId, ...fields })
			.onConflictDoUpdate({
				target: [publishingTextWork.textVersionId, publishingTextWork.workId],
				set: fields,
			});
	else if (value.kind === "publication_text")
		await tx
			.insert(publishingPublicationText)
			.values({ publicationId: reference.id, textVersionId: value.targetId, ...fields })
			.onConflictDoUpdate({
				target: [publishingPublicationText.publicationId, publishingPublicationText.textVersionId],
				set: fields,
			});
	else
		await tx
			.insert(publishingPublicationWork)
			.values({ publicationId: reference.id, workId: value.targetId, ...fields })
			.onConflictDoUpdate({
				target: [publishingPublicationWork.publicationId, publishingPublicationWork.workId],
				set: fields,
			});
	return { revision };
}

/** Remove one known coverage edge under the owning resource's revision. @internal */
export async function removePublishingCoverage(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	kind: z.output<typeof PublishingCoverageSchema>["kind"],
	targetId: string,
) {
	z.uuid().parse(targetId);
	if (reference.owner !== "publishing") throw new TypeError("Expected publishing owner");
	await requirePublishing(
		tx,
		reference.id,
		actor,
		kind === "text_work" ? "text_version" : "publication",
	);
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedRevision,
		"publishing.coverage.remove",
	);
	if (kind === "text_work")
		await tx
			.delete(publishingTextWork)
			.where(
				and(
					eq(publishingTextWork.textVersionId, reference.id),
					eq(publishingTextWork.workId, targetId),
				),
			);
	else if (kind === "publication_text")
		await tx
			.delete(publishingPublicationText)
			.where(
				and(
					eq(publishingPublicationText.publicationId, reference.id),
					eq(publishingPublicationText.textVersionId, targetId),
				),
			);
	else if (kind === "publication_work")
		await tx
			.delete(publishingPublicationWork)
			.where(
				and(
					eq(publishingPublicationWork.publicationId, reference.id),
					eq(publishingPublicationWork.workId, targetId),
				),
			);
	else throw new TypeError("Unknown publishing coverage kind");
	return { revision };
}

/** Coverage exports have an explicit owner-local order and never scan across publications. @internal */
export async function listPublishingCoverage(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	input: {
		kind: z.output<typeof PublishingCoverageSchema>["kind"];
		after?: { position: number; id: string };
		limit?: number;
	},
) {
	if (reference.owner !== "publishing") throw new TypeError("Expected publishing owner");
	const page = z
		.strictObject({
			kind: z.enum(["text_work", "publication_text", "publication_work"]),
			after: z.strictObject({ position: count, id: z.uuid() }).optional(),
			limit: z.number().int().min(1).max(100).default(50),
		})
		.parse(input);
	await requirePublishing(
		tx,
		reference.id,
		actor,
		page.kind === "text_work" ? "text_version" : "publication",
	);
	const table =
		page.kind === "text_work"
			? publishingTextWork
			: page.kind === "publication_text"
				? publishingPublicationText
				: publishingPublicationWork;
	const owner = "publicationId" in table ? table.publicationId : table.textVersionId;
	const target = "workId" in table ? table.workId : table.textVersionId;
	const rows = await tx
		.select({ targetId: target, position: table.position, coverageText: table.coverageText })
		.from(table)
		.where(
			and(
				eq(owner, reference.id),
				page.after
					? or(
							gt(table.position, page.after.position),
							and(eq(table.position, page.after.position), gt(target, page.after.id)),
						)
					: undefined,
			),
		)
		.orderBy(table.position, target)
		.limit(page.limit);
	await assertReadableTargets(
		tx,
		rows.map((row) => ({ owner: "publishing", id: row.targetId })),
		actor,
	);
	const last = rows.at(-1);
	return {
		items: rows,
		nextCursor:
			rows.length === page.limit && last ? { position: last.position, id: last.targetId } : null,
	};
}

/** A leaf can be removed without expanding the write into an entire serial tree. @internal */
export async function removePublishingInstallment(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	id: string,
) {
	z.uuid().parse(id);
	if (reference.owner !== "publishing") throw new TypeError("Expected publishing owner");
	await requirePublishing(tx, reference.id, actor, "serialization");
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedRevision,
		"publishing.installment.remove",
	);
	await tx
		.delete(publishingInstallment)
		.where(
			and(
				eq(publishingInstallment.serializationId, reference.id),
				eq(publishingInstallment.id, id),
			),
		);
	return { revision };
}

/** Ordered serial parts retain labels separately from their placement. @internal */
export const PublishingInstallmentSchema = z.strictObject({
	id: z.uuid().optional(),
	parentId: z.uuid().nullable().default(null),
	position: z.string().refine(isFractionalPosition),
	label: z.string().max(131_072).nullable().default(null),
	kindRevisionId: z.uuid(),
	date: CatalogPartialDateSchema.default({ year: null, month: null, day: null }),
	dateText: z.string().max(4096).nullable().default(null),
});

/** All tree edits serialize on the serialization revision; depth is bounded to 64. @internal */
export async function putPublishingInstallment(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: z.input<typeof PublishingInstallmentSchema>,
) {
	const value = PublishingInstallmentSchema.parse(input);
	if (reference.owner !== "publishing") throw new TypeError("Expected publishing owner");
	await requirePublishing(tx, reference.id, actor, "serialization");
	await assertCatalogDefinitionTarget(
		tx,
		value.kindRevisionId,
		"vocabulary",
		{ owner: "publishing", shape: "serialization" },
		"installment-kind",
	);
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedRevision,
		"publishing.installment.put",
	);
	let parentId = value.parentId;
	const visited = new Set(value.id ? [value.id] : []);
	for (let depth = 0; parentId !== null; depth++) {
		if (depth >= 64 || visited.has(parentId))
			throw new TypeError("Installment hierarchy contains a cycle or exceeds 64 levels");
		visited.add(parentId);
		const [parent] = await tx
			.select({ parentId: publishingInstallment.parentId })
			.from(publishingInstallment)
			.where(
				and(
					eq(publishingInstallment.serializationId, reference.id),
					eq(publishingInstallment.id, parentId),
				),
			)
			.limit(1);
		if (!parent) throw new TypeError("Installment parent is outside this serialization");
		parentId = parent.parentId;
	}
	// Reparenting a subtree could increase descendant depth without visiting those descendants.
	// Keep non-leaf reparenting explicit until a bounded subtree maintenance command is provided.
	if (value.id) {
		const [old] = await tx
			.select()
			.from(publishingInstallment)
			.where(
				and(
					eq(publishingInstallment.serializationId, reference.id),
					eq(publishingInstallment.id, value.id),
				),
			)
			.limit(1);
		if (old && old.parentId !== value.parentId) {
			const [child] = await tx
				.select({ id: publishingInstallment.id })
				.from(publishingInstallment)
				.where(
					and(
						eq(publishingInstallment.serializationId, reference.id),
						eq(publishingInstallment.parentId, value.id),
					),
				)
				.limit(1);
			if (child) throw new TypeError("Move leaf installments before reparenting their ancestor");
		}
	}
	const { date, id, ...rest } = value;
	const fields = { ...rest, dateYear: date.year, dateMonth: date.month, dateDay: date.day };
	const [row] = await tx
		.insert(publishingInstallment)
		.values({ serializationId: reference.id, id, ...fields })
		.onConflictDoUpdate({
			target: [publishingInstallment.serializationId, publishingInstallment.id],
			set: fields,
		})
		.returning({ id: publishingInstallment.id });
	if (!row) throw new Error("Installment insertion returned no row");
	return { id: row.id, revision };
}

/** A sibling keyset is bounded independently of a serialization's total size. @internal */
export async function listPublishingInstallments(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	input: {
		parentId?: string | null;
		after?: { position: string; id: string };
		limit?: number;
	} = {},
) {
	if (reference.owner !== "publishing") throw new TypeError("Expected publishing owner");
	await requirePublishing(tx, reference.id, actor, "serialization");
	const page = z
		.strictObject({
			parentId: z.uuid().nullable().default(null),
			after: z
				.strictObject({ position: z.string().refine(isFractionalPosition), id: z.uuid() })
				.optional(),
			limit: z.number().int().min(1).max(100).default(50),
		})
		.parse(input);
	const row = publishingInstallment;
	return tx
		.select()
		.from(row)
		.where(
			and(
				eq(row.serializationId, reference.id),
				page.parentId ? eq(row.parentId, page.parentId) : isNull(row.parentId),
				page.after
					? or(
							gt(row.position, page.after.position),
							and(eq(row.position, page.after.position), gt(row.id, page.after.id)),
						)
					: undefined,
			),
		)
		.orderBy(row.position, row.id)
		.limit(page.limit);
}

/** Owner-local structural export requires visibility of each disclosed target. @internal */
export async function readPublishingStructure(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
) {
	if (reference.owner !== "publishing") throw new TypeError("Expected publishing owner");
	const identity = await loadCatalogIdentity(tx, reference, actor, false);
	const table =
		identity.shape === "work"
			? publishingWork
			: identity.shape === "text_version"
				? publishingTextVersion
				: identity.shape === "publication"
					? publishingPublication
					: identity.shape === "serialization"
						? publishingSerialization
						: null;
	if (!table) return { identity, record: null };
	const [record] = await tx.select().from(table).where(eq(table.id, reference.id)).limit(1);
	if (!record) throw new Error("Publishing structural row is missing");
	if ("textVersionId" in record && record.textVersionId)
		await assertReadableTargets(tx, [{ owner: "publishing", id: record.textVersionId }], actor);
	return { identity, record };
}
