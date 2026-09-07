import { catalogSourceSupportColumns } from "./source-support";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { BangumiArchiveEpisodeSchema, BangumiEpisodeSchema } from "./bangumi-records";
import {
	BangumiApiContractSha256,
	BangumiArchiveContractSha256,
	resolveBangumiDependency,
} from "./bangumi-adoption";
import { inspectExistingSourceBinding } from "./source-adoption";
import { type CatalogSourceReceipt, recordCatalogSourceDocument } from "./source-observations";
import { acceptCatalogSourceInitialization } from "./source-bindings";
import {
	prepareCatalogSourceChildCorrespondence,
	sealCatalogSourceChildCorrespondence,
} from "./source-child-correspondence";
import {
	addCatalogName,
	appendCatalogFactNodes,
	beginCatalogFact,
	createCatalogIdentity,
	createCatalogRelation,
	loadCatalogIdentity,
	sealCatalogFact,
} from "./storage";
import { catalogValueNodes } from "./value-nodes";

/** Reviewed native sequence meaning, used when the source cannot identify a recording/release/text layer. @internal */
export const BangumiConstituentMappingSchema = z.strictObject({
	owner: z.enum(["music", "publishing", "software"]),
	predicateRevisionId: z.uuid(),
	parentRoleRevisionId: z.uuid(),
	partRoleRevisionId: z.uuid(),
	sequenceDefinitionRevisionId: z.uuid(),
	discDefinitionRevisionId: z.uuid(),
	durationDefinitionRevisionId: z.uuid().optional(),
	lengthDefinitionRevisionId: z.uuid().optional(),
});

/**
 * Native graph sequence for an ambiguously grained source part. It creates neither a recording nor a release.
 * @internal
 * Its logical identity, edited names, governed ordered membership and immutable qualifiers are first-class;
 * source-only episode type, commentary counts and malformed dates remain in the archived observation.
 */
export async function adoptBangumiConstituent(
	tx: DatabaseTransaction,
	actor: string,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
	format: "api" | "archive",
	mappingInput: z.input<typeof BangumiConstituentMappingSchema>,
) {
	const mapping = BangumiConstituentMappingSchema.parse(mappingInput);
	if (
		receipt.key.source !== "bangumi" ||
		receipt.key.objectType !== "episode" ||
		receipt.contractSha256 !==
			(format === "api" ? BangumiApiContractSha256 : BangumiArchiveContractSha256) ||
		bytes.byteLength > 8_000_000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256
	)
		throw new TypeError("Constituent differs from its reviewed source receipt");
	const raw: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	const episode =
		format === "api" ? BangumiEpisodeSchema.parse(raw) : BangumiArchiveEpisodeSchema.parse(raw);
	if (receipt.key.externalId !== String(episode.id))
		throw new TypeError("Constituent ID differs from its source key");
	const observation = await recordCatalogSourceDocument(tx, receipt, bytes);
	const existing = await inspectExistingSourceBinding(
		tx,
		actor,
		observation,
		"bangumi.constituent.1",
	);
	if (existing && existing.status !== "initialize_reference") return existing;
	const parent = await resolveBangumiDependency(tx, actor, "subject", episode.subject_id);
	if (
		parent.owner !== mapping.owner &&
		!(parent.owner === "grouping" && mapping.owner === "publishing")
	)
		throw new TypeError("Constituent has another native storage owner");
	const parentIdentity = await loadCatalogIdentity(tx, parent, actor, true);
	if (existing) {
		const identity = await loadCatalogIdentity(tx, existing.reference, actor, true);
		if (existing.reference.owner !== mapping.owner || identity.shape !== "catalog_entry")
			throw new TypeError("Constituent requires reviewed native reclassification");
	}
	const part = existing
		? { ...existing.reference, revision: existing.revision }
		: await createCatalogIdentity(tx, { owner: mapping.owner, shape: "catalog_entry" }, actor);
	if (part.owner === parent.owner && part.id === parent.id)
		throw new TypeError("A constituent cannot contain itself");
	await prepareCatalogSourceChildCorrespondence(tx, actor, {
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		reference: part,
		mappingVersion: "bangumi.constituent.1",
	});
	let partRevision = part.revision;
	for (const title of [
		{ value: episode.name, languageTag: null, path: "/name" },
		{ value: episode.name_cn, languageTag: "zh", path: "/name_cn" },
	]) {
		if (!title.value) continue;
		const named = await addCatalogName(tx, part, actor, partRevision, {
			value: title.value,
			languageTag: title.languageTag,
			kind: "source-primary",
		});
		partRevision = named.revision;
		await tx.insert(CatalogFactTables[part.owner].support).values({
			...(await catalogSourceSupportColumns(tx, observation.record.id)),
			ownerId: part.id,
			namedFormId: named.id,
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
			sourcePath: title.path,
		});
	}
	const scalarQualifiers: { definitionRevisionId: string; value: number | string; path: string }[] =
		[
			{
				definitionRevisionId: mapping.sequenceDefinitionRevisionId,
				value: episode.sort,
				path: "/sort",
			},
			{
				definitionRevisionId: mapping.discDefinitionRevisionId,
				value: episode.disc,
				path: "/disc",
			},
		];
	if (mapping.durationDefinitionRevisionId)
		scalarQualifiers.push({
			definitionRevisionId: mapping.durationDefinitionRevisionId,
			value: episode.duration,
			path: "/duration",
		});
	if (
		mapping.lengthDefinitionRevisionId &&
		"duration_seconds" in episode &&
		episode.duration_seconds &&
		episode.duration_seconds <= Math.floor(Number.MAX_SAFE_INTEGER / 1000)
	)
		scalarQualifiers.push({
			definitionRevisionId: mapping.lengthDefinitionRevisionId,
			value: episode.duration_seconds * 1000,
			path: "/duration_seconds",
		});
	let parentRevision = parentIdentity.revision;
	const qualifiers = [];
	for (const qualifier of scalarQualifiers) {
		const fact = await beginCatalogFact(
			tx,
			parent,
			actor,
			parentRevision,
			qualifier.definitionRevisionId,
		);
		const appended = await appendCatalogFactNodes(tx, parent, actor, fact.revision, fact.id, -1, [
			...catalogValueNodes(qualifier.value),
		]);
		parentRevision = (
			await sealCatalogFact(
				tx,
				parent,
				actor,
				appended.revision,
				fact.id,
				appended.lastNodePosition,
			)
		).revision;
		qualifiers.push({ definitionRevisionId: qualifier.definitionRevisionId, valueFactId: fact.id });
		await tx.insert(CatalogFactTables[parent.owner].support).values({
			...(await catalogSourceSupportColumns(tx, observation.record.id)),
			ownerId: parent.id,
			factId: fact.id,
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
			sourcePath: qualifier.path,
		});
	}
	const relation = await createCatalogRelation(tx, parent, actor, parentRevision, {
		definitionRevisionId: mapping.predicateRevisionId,
		participants: [
			{ roleRevisionId: mapping.parentRoleRevisionId, target: parent },
			{ roleRevisionId: mapping.partRoleRevisionId, target: { owner: part.owner, id: part.id } },
		],
		qualifiers,
	});
	await tx.insert(CatalogFactTables[parent.owner].support).values({
		...(await catalogSourceSupportColumns(tx, observation.record.id)),
		ownerId: parent.id,
		relationId: relation.id,
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		sourcePath: "/",
	});
	const binding = {
		sourceRecordId: observation.record.id,
		path: "/",
		snapshotId: observation.snapshot.id,
		reference: { owner: part.owner, id: part.id },
	};
	if (existing)
		await acceptCatalogSourceInitialization(tx, actor, {
			...binding,
			expectedBaselineRevision: existing.revision,
			finalRevision: partRevision,
		});
	else await sealCatalogSourceChildCorrespondence(tx, actor, { ...binding, path: "/" });
	return {
		status: "created" as const,
		reference: { owner: part.owner, id: part.id },
		revision: partRevision,
		parentRevision: relation.revision,
		relationId: relation.id,
		snapshotId: observation.snapshot.id,
	};
}
