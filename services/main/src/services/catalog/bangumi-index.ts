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
		await tx
			.insert(CatalogFactTables.grouping.support)
			.values({
				ownerId: identity.id,
				namedFormId: named.id,
				sourceRecordId: observation.record.id,
				snapshotId: observation.snapshot.id,
				sourcePath: "/title",
			});
	}
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
	},
) {
	const value = z
		.object({
			entryIndex: z.number().int().min(0).max(99),
			profileId: z.uuid(),
			position: z.string().refine(isFractionalPosition),
			predicateRevisionId: z.uuid(),
			collectionRoleRevisionId: z.uuid(),
			memberRoleRevisionId: z.uuid(),
		})
		.parse(input);
	if (reference.owner !== "grouping" || input.receipt.key.objectType !== "index_subjects")
		throw new TypeError("Expected index member collection");
	const page = BangumiIndexSubjectPageSchema.parse(decode(input.receipt, input.bytes));
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
	const relation = await createCatalogRelation(tx, reference, actor, expectedRevision, {
		definitionRevisionId: value.predicateRevisionId,
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
