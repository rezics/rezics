import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import {
	ContentLanguageChannelValues,
	MaximumContentLanguageSupportEntries,
	MaximumContentLanguageTagLength,
	normalizeContentLanguageSupport,
} from "@rezics/content-language";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import {
	catalogDefinition,
	catalogDefinitionRevision,
	CatalogIdentityTables,
} from "../database/schema/catalog-identity";
import {
	getUnitContentLanguageSupport,
	presentContentLanguageSupport,
	replaceUnitContentLanguageSupport,
} from "../units/content-language-support";
import { CatalogDefinitionInputSchema } from "./contracts";
import {
	CatalogAccessDenied,
	CatalogReferenceNotFound,
	CatalogRevisionConflict,
	loadCatalogIdentity,
	ensureCatalogDefinition,
	beginCatalogFact,
	appendCatalogFactNodes,
	sealCatalogFact,
} from "./storage";
import { catalogValueNodes, CatalogValueNodeSchema } from "./value-nodes";

export const ContentLanguageDeclarationOwnerSchema = z.enum([
	"publishing",
	"music",
	"program",
	"software",
]);
export const ContentLanguageDeclarationReferenceSchema = z.strictObject({
	owner: ContentLanguageDeclarationOwnerSchema,
	id: z.uuid(),
});
export type ContentLanguageDeclarationReference = z.output<
	typeof ContentLanguageDeclarationReferenceSchema
>;
const version = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const ConsumptionLanguagesSchema = z
	.array(
		z.strictObject({
			languageTag: z.string().min(1).max(MaximumContentLanguageTagLength),
			channels: z.array(z.enum(ContentLanguageChannelValues)).min(1).max(4).optional(),
		}),
	)
	.max(MaximumContentLanguageSupportEntries)
	.transform((value) => presentContentLanguageSupport(normalizeContentLanguageSupport(value)));
export const ContentLanguageDeclarationPutSchema = z.strictObject({
	expectedRevision: version.positive(),
	expectedHeadVersion: version,
	value: ConsumptionLanguagesSchema,
});
export const ContentLanguageDeclarationSchema = z.strictObject({
	revision: version.positive(),
	headVersion: version,
	canEdit: z.boolean(),
	value: ConsumptionLanguagesSchema,
});
export const ContentLanguageDeclarationMutationSchema = z.strictObject({
	revision: version.positive(),
	headVersion: version,
	changed: z.boolean(),
	value: ConsumptionLanguagesSchema,
});
export const ContentLanguageDeclarationRestoreSchema = z.strictObject({
	expectedRevision: version.positive(),
	expectedHeadVersion: version.positive(),
	restoreHeadVersion: version.positive(),
});
export const ContentLanguageDeclarationHistoryQuerySchema = z.strictObject({
	afterVersion: z.coerce.number().int().min(0).default(0),
	limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const ContentLanguageDeclarationHistorySchema = z.strictObject({
	items: z.array(
		z.strictObject({
			version: version.positive(),
			createdAt: z.string().datetime(),
			state: z.enum(["active", "disputed", "withdrawn", "superseded"]),
		}),
	),
	nextVersion: version.nullable(),
});
export const ContentLanguageDeclarationHistoryValueSchema = z.strictObject({
	version: version.positive(),
	value: ConsumptionLanguagesSchema,
});

const definition = CatalogDefinitionInputSchema.parse({
	namespace: "catalog",
	key: "content_consumption_languages",
	kind: "property",
	valueKind: "array",
	constraints: {
		rules: [
			{ position: 0, parent: null, memberKey: null, kind: "array" },
			{ position: 1, parent: 0, memberKey: null, kind: "object" },
			{
				position: 2,
				parent: 1,
				memberKey: "languageTag",
				kind: "string",
				minLength: 1,
				maxLength: MaximumContentLanguageTagLength,
			},
			{ position: 3, parent: 1, memberKey: "channels", kind: "array" },
			{
				position: 4,
				parent: 3,
				memberKey: null,
				kind: "string",
				allowedValues: [...ContentLanguageChannelValues],
			},
		],
	},
});
export const MaximumLanguageDeclarationNodes = 449;
/** Internal, domain-separated identity; clients never choose the semantic slot. */
export function contentLanguageDeclarationSemanticId(
	reference: ContentLanguageDeclarationReference,
) {
	const checked = ContentLanguageDeclarationReferenceSchema.parse(reference);
	const hash = createHash("sha256")
		.update(`rezics.catalog.content_consumption_languages.1\0${checked.owner}\0${checked.id}`)
		.digest()
		.subarray(0, 16);
	hash[6] = (hash[6]! & 0x0f) | 0x80;
	hash[8] = (hash[8]! & 0x3f) | 0x80;
	const hex = hash.toString("hex");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Reconstructs only the governed declaration grammar, with no general object deserialization. */
export function declarationFromValueNodes(input: readonly unknown[]) {
	const nodes = z
		.array(CatalogValueNodeSchema)
		.min(1)
		.max(MaximumLanguageDeclarationNodes)
		.parse(input);
	const entries = new Map<number, { languageTag?: string; channels?: string[] }>();
	const channels = new Map<number, string[]>();
	for (const [position, node] of nodes.entries()) {
		if (node.position !== position)
			throw new TypeError("Language declaration value is not contiguous");
		if (position === 0) {
			if (node.kind !== "array") throw new TypeError("Language declaration root is not an array");
			continue;
		}
		if (node.parentPosition === 0 && node.kind === "object" && node.parentKind === "array") {
			entries.set(position, {});
			continue;
		}
		const parent = node.parentPosition === null ? undefined : entries.get(node.parentPosition);
		if (
			parent &&
			node.memberKey === "languageTag" &&
			node.kind === "string" &&
			node.textValue !== null
		) {
			if (parent.languageTag !== undefined) throw new TypeError("Duplicate language tag");
			parent.languageTag = node.textValue;
			continue;
		}
		if (parent && node.memberKey === "channels" && node.kind === "array") {
			if (parent.channels) throw new TypeError("Duplicate channel declaration");
			parent.channels = [];
			channels.set(position, parent.channels);
			continue;
		}
		const list = node.parentPosition === null ? undefined : channels.get(node.parentPosition);
		if (list && node.parentKind === "array" && node.kind === "string" && node.textValue !== null) {
			list.push(node.textValue);
			continue;
		}
		throw new TypeError("Unexpected language declaration node");
	}
	const raw = [...entries.values()];
	const value = ConsumptionLanguagesSchema.parse(raw);
	if (!isDeepStrictEqual(raw, value))
		throw new TypeError("Language declaration requires an explicit policy migration");
	return value;
}
async function factValue(
	tx: DatabaseTransaction,
	reference: ContentLanguageDeclarationReference,
	factId: string,
) {
	const { fact, valueNode: node } = CatalogFactTables[reference.owner];
	const [target] = await tx
		.select({
			namespace: catalogDefinition.namespace,
			key: catalogDefinition.key,
			kind: catalogDefinition.kind,
			valueKind: catalogDefinitionRevision.valueKind,
			constraints: catalogDefinitionRevision.constraints,
			semanticId: fact.semanticId,
			last: fact.lastNodePosition,
			sealed: fact.sealedAt,
		})
		.from(fact)
		.innerJoin(
			catalogDefinitionRevision,
			eq(catalogDefinitionRevision.id, fact.definitionRevisionId),
		)
		.innerJoin(catalogDefinition, eq(catalogDefinition.id, catalogDefinitionRevision.definitionId))
		.where(and(eq(fact.ownerId, reference.id), eq(fact.id, factId)))
		.limit(1);
	if (
		!target ||
		!target.sealed ||
		target.semanticId !== contentLanguageDeclarationSemanticId(reference) ||
		target.namespace !== definition.namespace ||
		target.key !== definition.key ||
		target.kind !== "property" ||
		target.valueKind !== "array" ||
		!isDeepStrictEqual(target.constraints, definition.constraints) ||
		target.last >= MaximumLanguageDeclarationNodes
	)
		throw new CatalogReferenceNotFound("Native language declaration has another governed meaning");
	const nodes = await tx
		.select({
			position: node.position,
			parentPosition: node.parentPosition,
			parentKind: node.parentKind,
			memberKey: node.memberKey,
			kind: node.kind,
			textValue: node.textValue,
			numberValue: node.numberValue,
			booleanValue: node.booleanValue,
		})
		.from(node)
		.where(and(eq(node.ownerId, reference.id), eq(node.factId, factId)))
		.orderBy(node.position)
		.limit(MaximumLanguageDeclarationNodes + 1);
	return declarationFromValueNodes(nodes);
}
async function current(tx: DatabaseTransaction, reference: ContentLanguageDeclarationReference) {
	const { semanticHead: head, semanticRevision: revision } = CatalogFactTables[reference.owner];
	const [row] = await tx
		.select({ version: head.version, factId: revision.factId, state: revision.state })
		.from(head)
		.innerJoin(
			revision,
			and(
				eq(revision.ownerId, head.ownerId),
				eq(revision.semanticId, head.semanticId),
				eq(revision.version, head.version),
			),
		)
		.where(
			and(
				eq(head.ownerId, reference.id),
				eq(head.semanticId, contentLanguageDeclarationSemanticId(reference)),
			),
		)
		.limit(1);
	if (!row) return { version: 0, value: [] };
	if (!row.factId || row.state !== "active")
		throw new CatalogReferenceNotFound("Language declaration is not active");
	return { version: row.version, value: await factValue(tx, reference, row.factId) };
}
/** Native journal is authoritative; the shared row is only its atomic discovery projection. */
async function readableIdentity(
	tx: DatabaseTransaction,
	reference: ContentLanguageDeclarationReference,
	actor: string | null,
) {
	await loadCatalogIdentity(tx, reference, actor, false);
	const table = CatalogIdentityTables[reference.owner];
	await tx
		.select({ id: table.id })
		.from(table)
		.where(eq(table.id, reference.id))
		.limit(1)
		.for("share");
	return loadCatalogIdentity(tx, reference, actor, false);
}
export async function readCatalogContentLanguageSupport(
	tx: DatabaseTransaction,
	input: ContentLanguageDeclarationReference,
	actor: string | null,
) {
	const reference = ContentLanguageDeclarationReferenceSchema.parse(input);
	const identity = await readableIdentity(tx, reference, actor);
	const head = await current(tx, reference);
	const projection = await getUnitContentLanguageSupport(reference.id, tx);
	if (!isDeepStrictEqual(projection, head.value))
		throw new Error("Language declaration projection is inconsistent with its native journal");
	let canEdit = false;
	if (actor)
		try {
			await loadCatalogIdentity(tx, reference, actor, true, "share");
			canEdit = true;
		} catch (error) {
			if (!(error instanceof CatalogAccessDenied)) throw error;
		}
	return ContentLanguageDeclarationSchema.parse({
		revision: identity.revision,
		headVersion: head.version,
		canEdit,
		value: head.value,
	});
}
export async function replaceCatalogContentLanguageSupport(
	tx: DatabaseTransaction,
	input: ContentLanguageDeclarationReference,
	actor: string,
	body: z.input<typeof ContentLanguageDeclarationPutSchema>,
	forceNewRevision = false,
) {
	const reference = ContentLanguageDeclarationReferenceSchema.parse(input),
		value = ContentLanguageDeclarationPutSchema.parse(body);
	const identity = await loadCatalogIdentity(tx, reference, actor, true);
	const head = await current(tx, reference);
	if (identity.revision !== value.expectedRevision || head.version !== value.expectedHeadVersion)
		throw new CatalogRevisionConflict("Language declaration revision changed");
	if (!isDeepStrictEqual(await getUnitContentLanguageSupport(reference.id, tx), head.value))
		throw new Error("Language declaration projection is inconsistent with its native journal");
	if (!forceNewRevision && isDeepStrictEqual(head.value, value.value))
		return {
			revision: identity.revision,
			headVersion: head.version,
			changed: false,
			value: head.value,
		};
	const meaning = await ensureCatalogDefinition(tx, definition);
	const semanticId = contentLanguageDeclarationSemanticId(reference);
	const fact = await beginCatalogFact(
		tx,
		reference,
		actor,
		identity.revision,
		meaning.revisionId,
		head.version
			? { semanticId, expectedHeadVersion: head.version }
			: { initialSemanticId: semanticId, expectedHeadVersion: 0 },
	);
	const nodes = [...catalogValueNodes(value.value)];
	if (nodes.length > MaximumLanguageDeclarationNodes)
		throw new RangeError("Language declaration exceeds its value-node bound");
	const appended = await appendCatalogFactNodes(
		tx,
		reference,
		actor,
		fact.revision,
		fact.id,
		-1,
		nodes,
	);
	const sealed = await sealCatalogFact(
		tx,
		reference,
		actor,
		appended.revision,
		fact.id,
		appended.lastNodePosition,
	);
	await replaceUnitContentLanguageSupport(tx, reference.id, reference.owner, value.value);
	return ContentLanguageDeclarationMutationSchema.parse({
		revision: sealed.revision,
		headVersion: sealed.headVersion,
		changed: true,
		value: value.value,
	});
}
export async function readCatalogContentLanguageHistoryValue(
	tx: DatabaseTransaction,
	input: ContentLanguageDeclarationReference,
	actor: string,
	targetVersion: number,
) {
	const reference = ContentLanguageDeclarationReferenceSchema.parse(input);
	await loadCatalogIdentity(tx, reference, actor, true, "share");
	version.positive().parse(targetVersion);
	const history = CatalogFactTables[reference.owner].semanticRevision;
	const [row] = await tx
		.select({ factId: history.factId, state: history.state })
		.from(history)
		.where(
			and(
				eq(history.ownerId, reference.id),
				eq(history.semanticId, contentLanguageDeclarationSemanticId(reference)),
				eq(history.version, targetVersion),
			),
		)
		.limit(1);
	if (!row?.factId || row.state !== "active")
		throw new CatalogReferenceNotFound("No restorable native language declaration");
	return { version: targetVersion, value: await factValue(tx, reference, row.factId) };
}
export async function listCatalogContentLanguageHistory(
	tx: DatabaseTransaction,
	input: ContentLanguageDeclarationReference,
	actor: string,
	query: z.input<typeof ContentLanguageDeclarationHistoryQuerySchema>,
) {
	const reference = ContentLanguageDeclarationReferenceSchema.parse(input),
		page = ContentLanguageDeclarationHistoryQuerySchema.parse(query);
	await loadCatalogIdentity(tx, reference, actor, true, "share");
	const history = CatalogFactTables[reference.owner].semanticRevision;
	const rows = await tx
		.select({ version: history.version, createdAt: history.createdAt, state: history.state })
		.from(history)
		.where(
			and(
				eq(history.ownerId, reference.id),
				eq(history.semanticId, contentLanguageDeclarationSemanticId(reference)),
				gt(history.version, page.afterVersion),
			),
		)
		.orderBy(history.version)
		.limit(page.limit + 1);
	const items = rows
		.slice(0, page.limit)
		.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
	return { items, nextVersion: rows.length > page.limit ? (items.at(-1)?.version ?? null) : null };
}
export async function restoreCatalogContentLanguageSupport(
	tx: DatabaseTransaction,
	reference: ContentLanguageDeclarationReference,
	actor: string,
	input: z.input<typeof ContentLanguageDeclarationRestoreSchema>,
) {
	const body = ContentLanguageDeclarationRestoreSchema.parse(input);
	await loadCatalogIdentity(tx, reference, actor, true);
	const target = await readCatalogContentLanguageHistoryValue(
		tx,
		reference,
		actor,
		body.restoreHeadVersion,
	);
	return replaceCatalogContentLanguageSupport(
		tx,
		reference,
		actor,
		{
			expectedRevision: body.expectedRevision,
			expectedHeadVersion: body.expectedHeadVersion,
			value: target.value,
		},
		true,
	);
}
