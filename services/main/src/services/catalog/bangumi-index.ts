import { createHash } from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { groupingIdentity } from "../database/schema/catalog-identity";
import { BangumiIndexSchema, BangumiIndexSubjectPageSchema } from "./bangumi-records";
import { BangumiApiContractSha256, resolveBangumiDependency } from "./bangumi-adoption";
import {
	createGrouping,
	createGroupingOrderProfile,
	orderGroupingRelation,
	assignGroupingClass,
} from "./grouping";
import { type CatalogSourceReceipt, recordCatalogSourceDocument } from "./source-observations";
import { bindReferencedSourceIdentity } from "./source-references";
import { acceptCatalogSourceInitialization, bindCatalogSourceIdentity } from "./source-bindings";
import { inspectExistingSourceBinding } from "./source-adoption";
import {
	createCatalogRelation,
	ensureCatalogDefinition,
	addCatalogName,
	loadCatalogIdentity,
	recordCatalogChange,
} from "./storage";
import { type CatalogReference } from "./contracts";
import { isFractionalPosition } from "../ordering/position";
import { writeCatalogSourceScalar } from "./source-semantic-values";
import { bindCatalogNameSourceOccurrence } from "./names";

/** Shared collection membership semantics retain the curator's annotation and source date. @internal */
export async function ensureBangumiIndexMemberDefinitions(tx: DatabaseTransaction) {
	const collection = await ensureCatalogDefinition(tx, {
		namespace: "catalog",
		key: "curated_collection_subject",
		kind: "role",
		valueKind: null,
	});
	const member = await ensureCatalogDefinition(tx, {
		namespace: "catalog",
		key: "curated_collection_member",
		kind: "role",
		valueKind: null,
	});
	const comment = await ensureCatalogDefinition(tx, {
		namespace: "catalog.metadata",
		key: "curation-note",
		kind: "property",
		valueKind: "string",
		constraints: { maxLength: 131072 },
	});
	const addedAt = await ensureCatalogDefinition(tx, {
		namespace: "source.metadata",
		key: "membership-added-at",
		kind: "property",
		valueKind: "string",
		constraints: { maxLength: 4096 },
	});
	const predicate = await ensureCatalogDefinition(tx, {
		namespace: "catalog",
		key: "curated_collection_contains",
		kind: "predicate",
		valueKind: null,
		constraints: {
			roles: [
				{
					roleRevisionId: collection.revisionId,
					min: 1,
					max: 1,
					targets: [{ owner: "grouping", shapes: ["grouping"] }],
				},
				{
					roleRevisionId: member.revisionId,
					min: 1,
					max: 1,
					targets: [
						{
							owner: "publishing",
							shapes: ["work", "text_version", "publication", "serialization", "catalog_entry"],
						},
						{ owner: "program", shapes: ["program", "season", "program_version", "episode"] },
						{ owner: "music", shapes: ["work", "recording", "release_group", "release", "track"] },
						{ owner: "software", shapes: ["content", "release"] },
						{ owner: "grouping", shapes: ["grouping"] },
					],
				},
			],
			qualifierRevisionIds: [comment.revisionId, addedAt.revisionId],
		},
	});
	return {
		predicateRevisionId: predicate.revisionId,
		collectionRoleRevisionId: collection.revisionId,
		memberRoleRevisionId: member.revisionId,
		commentDefinitionRevisionId: comment.revisionId,
		addedAtDefinitionRevisionId: addedAt.revisionId,
	};
}

function decode(receipt: CatalogSourceReceipt, bytes: Uint8Array) {
	if (
		bytes.byteLength > 8_000_000 ||
		receipt.key.source !== "bangumi" ||
		receipt.contractSha256 !== BangumiApiContractSha256 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256
	)
		throw new TypeError("Index bytes differ from reviewed source receipt");
	return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
}

/** Imports a public curated collection and its attributed external creator without granting Auth authority. @internal */
export async function adoptBangumiIndex(
	tx: DatabaseTransaction,
	actor: string,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
) {
	const index = BangumiIndexSchema.parse(decode(receipt, bytes));
	if (receipt.key.objectType !== "index" || receipt.key.externalId !== String(index.id))
		throw new TypeError("Index identity differs from source key");
	const observation = await recordCatalogSourceDocument(tx, receipt, bytes);
	const existing = await inspectExistingSourceBinding(tx, actor, observation, "bangumi.index.1");
	if (existing && existing.status !== "initialize_reference") return existing;
	const classification = await ensureCatalogDefinition(tx, {
		namespace: "catalog",
		key: "curated_collection",
		kind: "class",
		valueKind: null,
		constraints: { targets: [{ owner: "grouping", shapes: ["grouping"] }] },
	});
	if (existing) {
		const current = await loadCatalogIdentity(tx, existing.reference, actor, true);
		if (existing.reference.owner !== "grouping" || current.shape !== "grouping")
			throw new TypeError("Index requires reviewed native reclassification");
	}
	const identity = existing
		? { ...existing.reference, revision: existing.revision }
		: await createGrouping(tx, actor, {
				name: { languageTag: null, value: index.title },
				classes: [classification.revisionId],
			});
	let primaryNameId = "nameId" in identity ? identity.nameId : null;
	if (existing) {
		identity.revision = (
			await assignGroupingClass(tx, identity, actor, identity.revision, classification.revisionId)
		).revision;
		const named = await addCatalogName(tx, identity, actor, identity.revision, {
			languageTag: null,
			value: index.title,
			kind: "source-primary",
		});
		identity.revision = named.revision;
		primaryNameId = named.id;
	}
	if (!primaryNameId) throw new Error("Index primary name was not created");
	await tx.insert(CatalogFactTables.grouping.support).values({
		ownerId: identity.id,
		namedFormId: primaryNameId,
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		sourcePath: "/title",
	});
	await bindCatalogNameSourceOccurrence(tx, identity, actor, {
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		namespace: "bangumi.index.title",
		localKey: "primary",
		nameId: primaryNameId,
		nameRevision: 1,
		sourcePath: "/title",
	});
	if (index.nsfw) {
		identity.revision = await recordCatalogChange(
			tx,
			identity,
			actor,
			identity.revision,
			"grouping.content-rating.initialize",
		);
		await tx
			.update(groupingIdentity)
			.set({ contentRating: "r18" })
			.where(eq(groupingIdentity.id, identity.id));
	}
	if (index.desc) {
		const definition = await ensureCatalogDefinition(tx, {
			namespace: "catalog.metadata",
			key: "curation-description",
			kind: "property",
			valueKind: "string",
			constraints: { maxLength: 131072 },
		});
		identity.revision = (
			await writeCatalogSourceScalar(tx, identity, actor, identity.revision, {
				definitionRevisionId: definition.revisionId,
				value: index.desc,
				sourceRecordId: observation.record.id,
				snapshotId: observation.snapshot.id,
				sourcePath: "/desc",
			})
		).revision;
	}
	for (const item of [
		{ key: "comment-count", value: index.stat.comments, path: "/stat/comments" },
		{ key: "collection-count", value: index.stat.collects, path: "/stat/collects" },
		{ key: "member-count", value: index.total, path: "/total" },
	] as const) {
		const definition = await ensureCatalogDefinition(tx, {
			namespace: "source.statistics",
			key: item.key,
			kind: "property",
			valueKind: "number",
			constraints: { integer: true, minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
		});
		identity.revision = (
			await writeCatalogSourceScalar(tx, identity, actor, identity.revision, {
				definitionRevisionId: definition.revisionId,
				value: item.value,
				sourceRecordId: observation.record.id,
				snapshotId: observation.snapshot.id,
				sourcePath: item.path,
			})
		).revision;
	}
	for (const item of [
		{ key: "created-at", value: index.created_at, path: "/created_at" },
		{ key: "updated-at", value: index.updated_at, path: "/updated_at" },
	] as const) {
		const definition = await ensureCatalogDefinition(tx, {
			namespace: "source.metadata",
			key: item.key,
			kind: "property",
			valueKind: "string",
			constraints: { maxLength: 4096 },
		});
		identity.revision = (
			await writeCatalogSourceScalar(tx, identity, actor, identity.revision, {
				definitionRevisionId: definition.revisionId,
				value: item.value,
				sourceRecordId: observation.record.id,
				snapshotId: observation.snapshot.id,
				sourcePath: item.path,
			})
		).revision;
	}
	const sourceBan = await ensureCatalogDefinition(tx, {
		namespace: "source.metadata",
		key: "restricted",
		kind: "property",
		valueKind: "boolean",
	});
	identity.revision = (
		await writeCatalogSourceScalar(tx, identity, actor, identity.revision, {
			definitionRevisionId: sourceBan.revisionId,
			value: index.ban,
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
			sourcePath: "/ban",
		})
	).revision;
	const curator = await bindReferencedSourceIdentity(tx, actor, {
		source: "bangumi",
		objectType: "curator",
		externalId: index.creator.username,
		owner: "entity",
		shape: "unresolved",
		name: index.creator.nickname || index.creator.username,
		evidence: observation.referenceAt("/creator/username"),
	});
	const collectionRole = await ensureCatalogDefinition(tx, {
		namespace: "catalog",
		key: "curated_collection_subject",
		kind: "role",
		valueKind: null,
	});
	const curatorRole = await ensureCatalogDefinition(tx, {
		namespace: "catalog",
		key: "curator",
		kind: "role",
		valueKind: null,
	});
	const predicate = await ensureCatalogDefinition(tx, {
		namespace: "catalog",
		key: "curated_by",
		kind: "predicate",
		valueKind: null,
		constraints: {
			roles: [
				{
					roleRevisionId: collectionRole.revisionId,
					min: 1,
					max: 1,
					targets: [{ owner: "grouping", shapes: ["grouping"] }],
				},
				{
					roleRevisionId: curatorRole.revisionId,
					min: 1,
					max: 1,
					targets: [
						{ owner: "entity", shapes: ["unresolved", "person", "organization", "collective"] },
					],
				},
			],
		},
	});
	const relation = await createCatalogRelation(tx, identity, actor, identity.revision, {
		definitionRevisionId: predicate.revisionId,
		participants: [
			{
				roleRevisionId: collectionRole.revisionId,
				target: { owner: identity.owner, id: identity.id },
			},
			{ roleRevisionId: curatorRole.revisionId, target: { owner: curator.owner, id: curator.id } },
		],
	});
	await tx.insert(CatalogFactTables.grouping.support).values({
		ownerId: identity.id,
		relationId: relation.id,
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		sourcePath: "/creator",
	});
	const order = await createGroupingOrderProfile(tx, identity, actor, relation.revision, "default");
	const binding = {
		mappingVersion: "bangumi.index.1",
		sourceRecordId: observation.record.id,
		path: "/",
		snapshotId: observation.snapshot.id,
		reference: { owner: identity.owner, id: identity.id },
	};
	if (existing)
		await acceptCatalogSourceInitialization(tx, actor, {
			...binding,
			expectedBaselineRevision: existing.revision,
			finalRevision: order.revision,
		});
	else await bindCatalogSourceIdentity(tx, actor, binding);
	return {
		status: "created" as const,
		reference: { owner: identity.owner, id: identity.id },
		revision: order.revision,
		orderProfileId: order.id,
		snapshotId: observation.snapshot.id,
	};
}

/** Adopts one explicitly ordered index member, using its endpoint page as immutable evidence. @internal */
export async function adoptBangumiIndexMember(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: {
		receipt: CatalogSourceReceipt;
		bytes: Uint8Array;
		entryIndex: number;
		profileId: string;
		position: string;
		predicateRevisionId: string;
		collectionRoleRevisionId: string;
		memberRoleRevisionId: string;
		commentDefinitionRevisionId?: string;
		addedAtDefinitionRevisionId?: string;
	},
) {
	const value = z
		.object({
			entryIndex: z.number().int().min(0).max(49),
			profileId: z.uuid(),
			position: z.string().refine(isFractionalPosition),
			predicateRevisionId: z.uuid(),
			collectionRoleRevisionId: z.uuid(),
			memberRoleRevisionId: z.uuid(),
			commentDefinitionRevisionId: z.uuid().optional(),
			addedAtDefinitionRevisionId: z.uuid().optional(),
		})
		.parse(input);
	if (reference.owner !== "grouping" || input.receipt.key.objectType !== "index_subjects")
		throw new TypeError("Expected index member collection");
	const page = BangumiIndexSubjectPageSchema.parse(decode(input.receipt, input.bytes));
	const scope = z
		.string()
		.regex(/^([1-9][0-9]*):(0|[1-9][0-9]*)$/u)
		.parse(input.receipt.key.externalId)
		.split(":");
	if (String(page.offset) !== scope[1])
		throw new TypeError("Index page offset differs from its source identity");
	const entry = page.data[value.entryIndex];
	if (!entry) throw new RangeError("Index page entry is absent");
	const indexId = z.coerce
		.number()
		.int()
		.positive()
		.parse(input.receipt.key.externalId.split(":")[0]);
	const index = await resolveBangumiDependency(tx, actor, "index", indexId);
	if (index.owner !== reference.owner || index.id !== reference.id)
		throw new TypeError("Index page belongs to another collection");
	const observation = await recordCatalogSourceDocument(tx, input.receipt, input.bytes);
	const member = await resolveBangumiDependency(tx, actor, "subject", entry.id);
	if (member.owner === reference.owner && member.id === reference.id)
		throw new TypeError("An index cannot contain itself");
	let revision = expectedRevision;
	const qualifiers: { definitionRevisionId: string; valueFactId: string }[] = [];
	if (entry.comment) {
		if (!value.commentDefinitionRevisionId)
			throw new TypeError(
				"A nonempty index member comment requires its governed native annotation definition",
			);
		const note = await writeCatalogSourceScalar(tx, reference, actor, revision, {
			definitionRevisionId: value.commentDefinitionRevisionId,
			value: entry.comment,
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
			sourcePath: `/data/${value.entryIndex}/comment`,
		});
		revision = note.revision;
		qualifiers.push({
			definitionRevisionId: value.commentDefinitionRevisionId,
			valueFactId: note.id,
		});
	}
	if (entry.added_at) {
		if (!value.addedAtDefinitionRevisionId)
			throw new TypeError("Index member source time requires its governed native definition");
		const added = await writeCatalogSourceScalar(tx, reference, actor, revision, {
			definitionRevisionId: value.addedAtDefinitionRevisionId,
			value: entry.added_at,
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
			sourcePath: `/data/${value.entryIndex}/added_at`,
		});
		revision = added.revision;
		qualifiers.push({
			definitionRevisionId: value.addedAtDefinitionRevisionId,
			valueFactId: added.id,
		});
	}
	const relation = await createCatalogRelation(tx, reference, actor, revision, {
		definitionRevisionId: value.predicateRevisionId,
		qualifiers,
		participants: [
			{
				roleRevisionId: value.collectionRoleRevisionId,
				target: { owner: reference.owner, id: reference.id },
			},
			{ roleRevisionId: value.memberRoleRevisionId, target: member },
		],
	});
	await tx.insert(CatalogFactTables.grouping.support).values({
		ownerId: reference.id,
		relationId: relation.id,
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		sourcePath: `/data/${value.entryIndex}`,
	});
	const ordered = await orderGroupingRelation(tx, reference, actor, relation.revision, {
		profileId: value.profileId,
		relationId: relation.id,
		position: value.position,
		sourcePosition: String(page.offset + value.entryIndex),
	});
	return { id: relation.id, revision: ordered.revision };
}
