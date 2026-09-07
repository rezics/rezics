import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { VndbCatalogContractSha256, VndbDumpContractSha256 } from "./vndb";
import {
	VndbSupportingRecordSchema,
	planVndbSupportingNames,
	planVndbSupportingSemantics,
	type VndbSupportingRecord,
} from "./vndb-supporting-plans";
import { normalizeVndbSemanticDump } from "./vndb-semantics-dump";
import { remapVndbSemanticPlan } from "./vndb-semantics";
import { vndbProducerShape } from "./vndb-entities";
import type { VndbPreparedSnapshot } from "./vndb-release-update";
import { loadCatalogSourceDocument } from "./source-observations";
import type { CatalogSourceNativeWriter } from "./source-proposals";
import {
	CatalogSourceNativeChangesSchema,
	readCatalogSourceApplication,
	type CatalogSourceNativeChange,
} from "./source-applications";
import { reconcileVndbNativeNames } from "./vndb-names-update";
import { reconcileVndbSemanticPlan } from "./vndb-semantics-update";
import { compensateCatalogSourceOwnedChange } from "./source-owned-compensation";
import {
	CatalogRevisionConflict,
	ensureCatalogDefinition,
	loadCatalogIdentity,
	recordCatalogChange,
} from "./storage";
import { EntityProfileSchema } from "./entity-contracts";
import {
	bindCatalogProfileSourceOccurrence,
	compensateCatalogProfileSourceChange,
	readCatalogProfileHead,
	writeCatalogSourceProfile,
} from "./profile-source";

const entityFamilies = new Set(["staff", "producer", "character"]);
function mappingVersion(record: VndbSupportingRecord) {
	return entityFamilies.has(record.objectType)
		? `vndb.${record.objectType}.2`
		: `vndb.${record.objectType}.semantic.1`;
}
function prepare(input: VndbPreparedSnapshot) {
	const bytes = new Uint8Array(input.bytes),
		snapshotId = z.uuid().parse(input.snapshotId),
		receipt = input.receipt;
	if (
		bytes.byteLength > 8_000_000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256 ||
		receipt.key.source !== "vndb" ||
		![VndbCatalogContractSha256, VndbDumpContractSha256].includes(receipt.contractSha256)
	)
		throw new TypeError("VNDB supporting archive differs from its reviewed receipt");
	const raw = z
		.record(z.string(), z.unknown())
		.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
	const family = z
		.enum(["staff", "producer", "character", "tag", "trait", "quote", "drm", "engine"])
		.parse(receipt.key.objectType);
	if (
		(family === "drm" || family === "engine") &&
		receipt.contractSha256 !== VndbDumpContractSha256
	)
		throw new TypeError("VNDB DRM and engine objects require reviewed public dump evidence");
	let record: VndbSupportingRecord;
	let path = (value: string) => value;
	if (receipt.contractSha256 === VndbDumpContractSha256) {
		if (family === "staff" || family === "producer" || family === "character")
			throw new TypeError("VNDB entity dump requires its reviewed assembled projection");
		const normalized = normalizeVndbSemanticDump(family, raw);
		record = normalized.record;
		path = normalized.sourcePath;
	} else record = VndbSupportingRecordSchema.parse({ ...raw, objectType: family });
	if (String(record.id) !== receipt.key.externalId)
		throw new TypeError("VNDB supporting archive identifies another source object");
	return { bytes, snapshotId, receipt, record, path };
}

/** @alpha Reviewed supporting-object updates share the initial native plans and exact compensation journal. */
export function createVndbSupportingNativeWriter(input: {
	before: VndbPreparedSnapshot | null;
	after: VndbPreparedSnapshot;
}): CatalogSourceNativeWriter {
	const before = input.before ? prepare(input.before) : null,
		after = prepare(input.after);
	if (
		before &&
		(before.record.objectType !== after.record.objectType || before.record.id !== after.record.id)
	)
		throw new TypeError("VNDB supporting delta crosses source identities");
	if (before && before.receipt.contractSha256 !== after.receipt.contractSha256)
		throw new TypeError("VNDB source-surface transition requires explicit field observation scope");
	const owner = entityFamilies.has(after.record.objectType)
		? "entity"
		: after.record.objectType === "engine"
			? "software"
			: "reference";
	const shape =
		after.record.objectType === "staff"
			? "person"
			: after.record.objectType === "producer"
				? vndbProducerShape(after.record.type)
				: after.record.objectType === "character"
					? "character"
					: after.record.objectType === "engine"
						? "engine"
						: after.record.objectType === "drm"
							? "access-mechanism"
							: after.record.objectType === "quote"
								? "quotation"
								: "concept";
	return async (tx, context) => {
		if (
			context.mappingVersion !== mappingVersion(after.record) ||
			context.snapshotId !== after.snapshotId ||
			context.reference.owner !== owner
		)
			throw new TypeError("VNDB supporting writer differs from its prepared mapping");
		const native = await loadCatalogIdentity(tx, context.reference, context.actor, true);
		if (native.shape !== shape)
			throw new TypeError(
				"VNDB classification requires an explicitly reviewed native target rebind",
			);
		const document = await loadCatalogSourceDocument(
			tx,
			context.sourceRecordId,
			after.snapshotId,
			after.receipt,
			after.bytes,
		);
		const previousDocument = before
			? await loadCatalogSourceDocument(
					tx,
					context.sourceRecordId,
					before.snapshotId,
					before.receipt,
					before.bytes,
				)
			: document;
		const changes: CatalogSourceNativeChange[] = [];
		let revision = context.expectedRevision;
		if (context.action === "withdraw") {
			const applied = await readCatalogSourceApplication(tx, context.actor, {
				sourceRecordId: context.sourceRecordId,
				proposalId: context.proposalId,
				action: "apply",
			});
			if (!applied || applied.application.previousSnapshotId !== (before?.snapshotId ?? null))
				throw new Error("VNDB compensation preparation lacks its exact original baseline");
			for (const change of [...applied.changes].reverse()) {
				if (change.ownerId !== context.reference.id)
					throw new TypeError("VNDB supporting compensation cannot mutate another native owner");
				if (change.kind === "catalog-profile")
					changes.push(await compensateCatalogProfileSourceChange(tx, context.actor, change));
				else if (
					change.kind === "catalog-semantic" ||
					change.kind === "catalog-name" ||
					change.kind === "catalog-name-authority"
				)
					changes.push(await compensateCatalogSourceOwnedChange(tx, context.actor, change));
				else throw new TypeError("VNDB supporting journal contains another native change family");
			}
			revision = (await loadCatalogIdentity(tx, context.reference, context.actor, true)).revision;
		} else {
			if (context.previousSnapshotId !== (before?.snapshotId ?? null))
				throw new CatalogRevisionConflict("VNDB supporting baseline changed after preparation");
			// A reduced selection cannot turn unobserved values into source deletions.
			if (before)
				for (const [field, value] of Object.entries(before.record)) {
					if (value !== undefined && !Object.hasOwn(after.record, field))
						throw new TypeError(`VNDB supporting update omitted observed ${field}`);
				}
			if (after.record.objectType === "staff" && after.record.gender !== undefined) {
				const gender = async (value: "m" | "f" | null | undefined) =>
					value == null
						? null
						: (
								await ensureCatalogDefinition(tx, {
									namespace: "catalog.gender",
									key: value === "m" ? "male" : "female",
									kind: "vocabulary",
									valueKind: null,
								})
							).revisionId;
				const expectedGender = await gender(
						before?.record.objectType === "staff" ? before.record.gender : null,
					),
					desiredGender = await gender(after.record.gender);
				const head = await readCatalogProfileHead(tx, context.reference, context.actor);
				const current =
					head && !head.removed
						? EntityProfileSchema.parse(head.snapshot)
						: EntityProfileSchema.parse({});
				if (
					expectedGender !== desiredGender &&
					current.genderRevisionId !== expectedGender &&
					current.genderRevisionId !== desiredGender
				)
					throw new CatalogRevisionConflict(
						"VNDB staff gender conflicts with an independent native edit",
					);
				const desired = {
					...current,
					genderRevisionId:
						expectedGender === desiredGender ? current.genderRevisionId : desiredGender,
				};
				if (!head || head.removed || !isDeepStrictEqual(current, desired)) {
					const written = await writeCatalogSourceProfile(
						tx,
						context.reference,
						context.actor,
						revision,
						{
							expectedProfileRevision: head?.revision ?? null,
							profile: desired,
							sourceRecordId: context.sourceRecordId,
							snapshotId: after.snapshotId,
							sourcePath: after.path("/gender"),
						},
					);
					revision = written.revision;
					changes.push(written.change);
				} else
					await bindCatalogProfileSourceOccurrence(tx, context.reference, context.actor, {
						sourceRecordId: context.sourceRecordId,
						snapshotId: after.snapshotId,
						sourcePath: after.path("/gender"),
						revision: head.revision,
					});
			}
			const names = await reconcileVndbNativeNames(
				tx,
				context.reference,
				context.actor,
				revision,
				context.mappingKey,
				{
					plan: before
						? planVndbSupportingNames(before.record).map((item) => ({
								...item,
								path: before.path(item.path),
							}))
						: [],
					document: previousDocument,
				},
				{
					plan: planVndbSupportingNames(after.record).map((item) => ({
						...item,
						path: after.path(item.path),
					})),
					document,
				},
			);
			revision = names.revision;
			changes.push(...names.changes);
			const semantic = await reconcileVndbSemanticPlan(
				tx,
				context.reference,
				context.actor,
				revision,
				context.mappingKey,
				{
					plan: before
						? remapVndbSemanticPlan(planVndbSupportingSemantics(before.record), before.path)
						: { facts: [], relations: [] },
					document: previousDocument,
				},
				{
					plan: remapVndbSemanticPlan(planVndbSupportingSemantics(after.record), after.path),
					document,
				},
			);
			revision = semantic.revision;
			changes.push(...semantic.changes);
		}
		revision = await recordCatalogChange(
			tx,
			context.reference,
			context.actor,
			revision,
			`source.vndb.${after.record.objectType}.${context.action}`,
		);
		return { revision, changes: CatalogSourceNativeChangesSchema.parse(changes) };
	};
}
