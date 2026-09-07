import { catalogSourceSupportColumns } from "./source-support";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { catalogSourceRecord } from "../database/schema/catalog-source";
import { entityIdentity } from "../database/schema/catalog-identity";
import { type CatalogReference } from "./contracts";
import {
	BangumiArchiveCharacterSchema,
	BangumiArchiveEpisodeSchema,
	BangumiArchivePersonSchema,
	BangumiCharacterSchema,
	BangumiEpisodeSchema,
	BangumiPersonSchema,
	planBangumiEpisode,
	parseBangumiWiki,
	selectBangumiRevisionWiki,
	validateBangumiRevisionContext,
} from "./bangumi-records";
import { bangumiDate, BangumiSubjectContractSha256, BangumiWikiEntrySchema } from "./bangumi";
import { createEntity, initializeEntityProfile } from "./entities";
import {
	createProgramStructure,
	updateProgramStructure,
	type ProgramStructureSchema,
} from "./program";
import {
	addCatalogName,
	appendCatalogFactNodes,
	beginCatalogFact,
	loadCatalogIdentity,
	recordCatalogChange,
	sealCatalogFact,
} from "./storage";
import { getSourceBoundReference, inspectExistingSourceBinding } from "./source-adoption";
import { acceptCatalogSourceInitialization } from "./source-bindings";
import {
	prepareCatalogSourceChildCorrespondence,
	sealCatalogSourceChildCorrespondence,
} from "./source-child-correspondence";
import { type CatalogSourceReceipt, recordCatalogSourceDocument } from "./source-observations";
import { catalogValueNodes } from "./value-nodes";

/** Exact pinned contracts; live wire corrections are covered by bangumi-records tests. @internal */
export const BangumiApiContractSha256 =
	"e415ffb14fefb7df2833c7afe789107297217ed624668f1c63fbfb0a361df807";
export const BangumiArchiveContractSha256 =
	"f2a0867917012cda97ec1f80cb5cae6ef7752e2e716d9dbce1ce57c2f9b33884";

function decode(receipt: CatalogSourceReceipt, bytes: Uint8Array, contract: string) {
	if (
		bytes.byteLength > 8_000_000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256 ||
		receipt.contractSha256 !== contract ||
		receipt.key.source !== "bangumi"
	)
		throw new TypeError("Bangumi input differs from its immutable reviewed source receipt");
	return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
}

/** Resolves already adopted dependencies without making a provider ID into a native identity. @internal */
export async function resolveBangumiDependency(
	tx: DatabaseTransaction,
	actor: string,
	objectType: string,
	externalId: number,
) {
	const [record] = await tx
		.select({ id: catalogSourceRecord.id })
		.from(catalogSourceRecord)
		.where(
			and(
				eq(catalogSourceRecord.source, "bangumi"),
				eq(catalogSourceRecord.objectType, objectType),
				eq(catalogSourceRecord.externalId, String(externalId)),
			),
		)
		.limit(1);
	const reference = record ? await getSourceBoundReference(tx, record.id, actor) : null;
	if (!reference) throw new Error(`Bangumi ${objectType} ${externalId} must be adopted first`);
	return reference;
}

async function finish(
	tx: DatabaseTransaction,
	actor: string,
	receipt: CatalogSourceReceipt,
	observation: Awaited<ReturnType<typeof recordCatalogSourceDocument>>,
	identity: CatalogReference & { revision: number },
	names: readonly { value: string; languageTag: string | null; path: string }[],
	baselineRevision?: number,
) {
	let revision = identity.revision;
	const tables = CatalogFactTables[identity.owner];
	for (const name of names) {
		if (!name.value) continue;
		const created = await addCatalogName(tx, identity, actor, revision, {
			value: name.value,
			languageTag: name.languageTag,
			kind: "source-translated",
		});
		revision = created.revision;
		await tx.insert(tables.support).values({
			...(await catalogSourceSupportColumns(tx, observation.record.id)),
			ownerId: identity.id,
			namedFormId: created.id,
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
			sourcePath: name.path,
		});
	}
	const [identifier] = await tx
		.insert(tables.identifier)
		.values({
			ownerId: identity.id,
			namespace: `bangumi.${receipt.key.objectType}`,
			value: receipt.key.externalId,
			normalizedValue: receipt.key.externalId,
		})
		.returning({ id: tables.identifier.id, identifierRevision: tables.identifier.revision });
	if (!identifier) throw new Error("Source identifier insertion returned no row");
	await tx.insert(tables.support).values({
		...(await catalogSourceSupportColumns(tx, observation.record.id)),
		ownerId: identity.id,
		identifierId: identifier.id,
		identifierRevision: identifier.identifierRevision,
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		sourcePath: "/id",
	});
	const binding = {
		mappingVersion:
			receipt.key.objectType === "episode" ? "bangumi.program-episode.1" : "bangumi.entity.1",
		sourceRecordId: observation.record.id,
		path: "/",
		snapshotId: observation.snapshot.id,
		reference: { owner: identity.owner, id: identity.id },
	};
	if (baselineRevision === undefined)
		await sealCatalogSourceChildCorrespondence(tx, actor, { ...binding, path: "/" });
	else
		await acceptCatalogSourceInitialization(tx, actor, {
			...binding,
			expectedBaselineRevision: baselineRevision,
			finalRevision: revision,
		});
	return {
		status: "created" as const,
		reference: { owner: identity.owner, id: identity.id },
		revision,
		snapshotId: observation.snapshot.id,
	};
}

/** API and Archive entity rows share the native entity command; birthdays remain source evidence. @internal */
export async function adoptBangumiEntity(
	tx: DatabaseTransaction,
	actor: string,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
	format: "api" | "archive",
) {
	if (!["person", "character"].includes(receipt.key.objectType))
		throw new TypeError("Expected Bangumi person or character record");
	const raw = decode(
		receipt,
		bytes,
		format === "api" ? BangumiApiContractSha256 : BangumiArchiveContractSha256,
	);
	const person = receipt.key.objectType === "person";
	const record = person
		? format === "api"
			? BangumiPersonSchema.parse(raw)
			: BangumiArchivePersonSchema.parse(raw)
		: format === "api"
			? BangumiCharacterSchema.parse(raw)
			: BangumiArchiveCharacterSchema.parse(raw);
	if (receipt.key.externalId !== String(record.id))
		throw new TypeError("Bangumi entity identity differs from its source key");
	const observation = await recordCatalogSourceDocument(tx, receipt, bytes);
	const existing = await inspectExistingSourceBinding(tx, actor, observation, "bangumi.entity.1");
	if (existing && existing.status !== "initialize_reference") return existing;
	const type = "type" in record ? record.type : record.role;
	const shape = !person
		? "character"
		: type === 1
			? "person"
			: type === 2
				? "organization"
				: type === 3
					? "collective"
					: "unresolved";
	if (!record.name) throw new TypeError("An unnamed source entity requires reviewed native naming");
	if (existing) {
		const current = await loadCatalogIdentity(tx, existing.reference, actor, true);
		if (existing.reference.owner !== "entity" || current.shape !== shape)
			throw new TypeError("Bangumi entity requires reviewed native reclassification");
		await prepareCatalogSourceChildCorrespondence(tx, actor, {
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
			reference: existing.reference,
			mappingVersion: "bangumi.entity.1",
		});
		const initialized = await initializeEntityProfile(
			tx,
			existing.reference,
			actor,
			existing.revision,
			{},
		);
		const named = await addCatalogName(tx, existing.reference, actor, initialized.revision, {
			languageTag: null,
			value: record.name,
			kind: "source-primary",
		});
		let revision = named.revision;
		if ("nsfw" in record && record.nsfw) {
			revision = await recordCatalogChange(
				tx,
				existing.reference,
				actor,
				revision,
				"entity.content-rating.initialize",
			);
			await tx
				.update(entityIdentity)
				.set({ contentRating: "r18" })
				.where(eq(entityIdentity.id, existing.reference.id));
		}
		await tx.insert(CatalogFactTables.entity.support).values({
			...(await catalogSourceSupportColumns(tx, observation.record.id)),
			ownerId: existing.reference.id,
			namedFormId: named.id,
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
			sourcePath: "/name",
		});
		return finish(
			tx,
			actor,
			receipt,
			observation,
			{ ...existing.reference, revision },
			[],
			existing.revision,
		);
	}
	const identity = await createEntity(tx, actor, {
		shape,
		name: { languageTag: null, value: record.name },
	});
	await prepareCatalogSourceChildCorrespondence(tx, actor, {
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		reference: identity,
		mappingVersion: "bangumi.entity.1",
	});
	if ("nsfw" in record && record.nsfw) {
		identity.revision = await recordCatalogChange(
			tx,
			identity,
			actor,
			identity.revision,
			"entity.content-rating.initialize",
		);
		await tx
			.update(entityIdentity)
			.set({ contentRating: "r18" })
			.where(eq(entityIdentity.id, identity.id));
	}
	await tx.insert(CatalogFactTables.entity.support).values({
		...(await catalogSourceSupportColumns(tx, observation.record.id)),
		ownerId: identity.id,
		namedFormId: identity.nameId,
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		sourcePath: "/name",
	});
	return finish(tx, actor, receipt, observation, identity, []);
}

/** Program episodes retain decimal sort, display duration, precise parsed duration and partial dates. @internal */
export async function adoptBangumiProgramEpisode(
	tx: DatabaseTransaction,
	actor: string,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
	format: "api" | "archive",
) {
	if (receipt.key.objectType !== "episode") throw new TypeError("Expected Bangumi episode record");
	const raw = decode(
		receipt,
		bytes,
		format === "api" ? BangumiApiContractSha256 : BangumiArchiveContractSha256,
	);
	const record =
		format === "api" ? BangumiEpisodeSchema.parse(raw) : BangumiArchiveEpisodeSchema.parse(raw);
	if (receipt.key.externalId !== String(record.id))
		throw new TypeError("Bangumi episode identity differs from its source key");
	const observation = await recordCatalogSourceDocument(tx, receipt, bytes);
	const existing = await inspectExistingSourceBinding(
		tx,
		actor,
		observation,
		"bangumi.program-episode.1",
	);
	if (existing && existing.status !== "initialize_reference") return existing;
	const parent = await resolveBangumiDependency(tx, actor, "subject", record.subject_id);
	const owner = await loadCatalogIdentity(tx, parent, actor, false);
	if (parent.owner !== "program" || owner.shape !== "program")
		throw new TypeError("This subject requires its native non-program constituent mapping");
	const date = bangumiDate(record.airdate);
	const structure: z.input<typeof ProgramStructureSchema> = {
		shape: "episode",
		fields: {
			programId: parent.id,
			sortNumber: record.sort,
			episodeNumber: "ep" in record ? record.ep : null,
			discNumber: record.disc >= 0 ? record.disc : null,
			durationText: record.duration,
			lengthMilliseconds: format === "api" ? planBangumiEpisode(raw).lengthMilliseconds : null,
			date: date ?? undefined,
			dateText: record.airdate,
		},
	};
	const title = { languageTag: null, value: record.name || record.name_cn || String(record.sort) };
	let identity;
	if (existing) {
		const updated = await updateProgramStructure(
			tx,
			existing.reference,
			actor,
			existing.revision,
			structure,
		);
		const named = await addCatalogName(tx, existing.reference, actor, updated.revision, {
			...title,
			kind: "source-primary",
		});
		identity = { ...existing.reference, revision: named.revision, nameId: named.id };
	} else identity = await createProgramStructure(tx, actor, structure, title);
	await prepareCatalogSourceChildCorrespondence(tx, actor, {
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		reference: identity,
		mappingVersion: "bangumi.program-episode.1",
	});
	await tx.insert(CatalogFactTables.program.support).values({
		...(await catalogSourceSupportColumns(tx, observation.record.id)),
		ownerId: identity.id,
		namedFormId: identity.nameId,
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		sourcePath: record.name ? "/name" : record.name_cn ? "/name_cn" : "/sort",
	});
	return finish(
		tx,
		actor,
		receipt,
		observation,
		identity,
		record.name && record.name_cn
			? [{ value: record.name_cn, languageTag: "zh", path: "/name_cn" }]
			: [],
		existing?.revision,
	);
}

/**
 * Adopts exactly one reviewed wiki value into a governed native property.
 * @internal
 * Raw/source statistics are never automatically promoted into local facts. The
 * caller selects a registered definition; storage validates its value kind and constraints.
 */
export async function adoptBangumiWikiValue(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: {
		receipt: CatalogSourceReceipt;
		bytes: Uint8Array;
		entryIndex: number;
		definitionRevisionId: string;
		semanticId?: string;
		expectedHeadVersion?: number;
		revisionTarget?: {
			objectType: "subject" | "person" | "character";
			externalId: number;
			memberRevisionId?: string;
		};
		revisionContext?: { receipt: CatalogSourceReceipt; bytes: Uint8Array; entryIndex: number };
	},
) {
	z.number().int().min(0).parse(input.entryIndex);
	z.uuid().parse(input.definitionRevisionId);
	const revisionTarget = z
		.strictObject({
			objectType: z.enum(["subject", "person", "character"]),
			externalId: z.number().int().positive(),
			memberRevisionId: z.string().regex(/^\d+$/u).optional(),
		})
		.optional()
		.parse(input.revisionTarget);
	if (
		![
			BangumiApiContractSha256,
			BangumiArchiveContractSha256,
			BangumiSubjectContractSha256,
		].includes(input.receipt.contractSha256)
	)
		throw new TypeError("Unreviewed Bangumi wiki contract");
	const raw = decode(input.receipt, input.bytes, input.receipt.contractSha256);
	let entries: z.output<typeof BangumiWikiEntrySchema>[];
	let sourcePath: string;
	let membership: { receipt: CatalogSourceReceipt; bytes: Uint8Array; path: string } | undefined;
	if (revisionTarget) {
		const selected = selectBangumiRevisionWiki(raw, revisionTarget.memberRevisionId);
		if (
			input.receipt.key.objectType !== `${revisionTarget.objectType}_revision` ||
			input.receipt.key.externalId !== String(selected.revision.id)
		)
			throw new TypeError("Revision receipt does not identify the selected global revision");
		if (!input.revisionContext)
			throw new TypeError(
				"Historical wiki adoption requires archived revision membership evidence",
			);
		membership = {
			...input.revisionContext,
			path: validateBangumiRevisionContext({
				key: input.revisionContext.receipt.key,
				page: decode(
					input.revisionContext.receipt,
					input.revisionContext.bytes,
					BangumiApiContractSha256,
				),
				entryIndex: input.revisionContext.entryIndex,
				objectType: revisionTarget.objectType,
				externalId: revisionTarget.externalId,
				revisionId: selected.revision.id,
			}),
		};
		if (selected.status !== "available" || selected.wiki.status !== "parsed")
			throw new TypeError("Selected revision does not expose a parsed wiki");
		entries = selected.wiki.entries;
		sourcePath = selected.path;
	} else {
		if (!["subject", "person", "character"].includes(input.receipt.key.objectType))
			throw new TypeError("Expected public catalog wiki record");
		const document = z
			.object({ infobox: z.union([z.string(), z.array(BangumiWikiEntrySchema)]) })
			.parse(raw);
		if (typeof document.infobox === "string") {
			const parsed = parseBangumiWiki(document.infobox);
			if (parsed.status !== "parsed")
				throw new TypeError("Wiki requires parser review before native adoption");
			entries = parsed.entries;
			sourcePath = "/infobox";
		} else {
			entries = document.infobox;
			sourcePath = `/infobox/${input.entryIndex}/value`;
		}
	}
	const entry = entries[input.entryIndex];
	if (!entry) throw new RangeError("Wiki entry does not exist");
	const observation = await recordCatalogSourceDocument(tx, input.receipt, input.bytes);
	const membershipObservation = membership
		? await recordCatalogSourceDocument(tx, membership.receipt, membership.bytes)
		: null;
	const bound = revisionTarget
		? await resolveBangumiDependency(
				tx,
				actor,
				revisionTarget.objectType,
				revisionTarget.externalId,
			)
		: await getSourceBoundReference(tx, observation.record.id, actor);
	if (!bound || bound.owner !== reference.owner || bound.id !== reference.id)
		throw new TypeError("Wiki record is not bound to the edited identity");
	const fact = await beginCatalogFact(
		tx,
		reference,
		actor,
		expectedRevision,
		input.definitionRevisionId,
		{ semanticId: input.semanticId, expectedHeadVersion: input.expectedHeadVersion },
	);
	let revision = fact.revision;
	let last = -1;
	let batch = [];
	let size = 0;
	for (const node of catalogValueNodes(entry.value)) {
		const bytes = Buffer.byteLength(JSON.stringify(node), "utf8");
		if (bytes > 500_000) throw new RangeError("Wiki scalar exceeds native command budget");
		if (batch.length && (batch.length === 128 || size + bytes > 500_000)) {
			const appended = await appendCatalogFactNodes(
				tx,
				reference,
				actor,
				revision,
				fact.id,
				last,
				batch,
			);
			revision = appended.revision;
			last = appended.lastNodePosition;
			batch = [];
			size = 0;
		}
		batch.push(node);
		size += bytes;
	}
	if (batch.length) {
		const appended = await appendCatalogFactNodes(
			tx,
			reference,
			actor,
			revision,
			fact.id,
			last,
			batch,
		);
		revision = appended.revision;
		last = appended.lastNodePosition;
	}
	const sealed = await sealCatalogFact(tx, reference, actor, revision, fact.id, last);
	await tx.insert(CatalogFactTables[reference.owner].support).values({
		ownerId: reference.id,
		factId: fact.id,
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		sourcePath,
	});
	if (membership && membershipObservation)
		await tx.insert(CatalogFactTables[reference.owner].support).values({
			ownerId: reference.id,
			factId: fact.id,
			sourceRecordId: membershipObservation.record.id,
			snapshotId: membershipObservation.snapshot.id,
			sourcePath: membership.path,
		});
	return { id: fact.id, ...sealed };
}
