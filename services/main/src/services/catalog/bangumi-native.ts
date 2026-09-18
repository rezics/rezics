import {
	createBangumiRelationNativeWriter,
	prepareBangumiRelationProposalDependencies,
	BangumiNativeRelationFamilies,
} from "./bangumi-relation-native";
import { BangumiRelationMappingSchema } from "./bangumi-relations";
import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "@rezics/schema/postgres/knowledge/facts";
import type { CatalogReference } from "@rezics/schema/contracts/native/catalog";
import {
	prepareBangumiNativeRecord,
	planBangumiNativeNames,
	planBangumiNativeFacts,
	planBangumiProgramProjection,
	type BangumiNativeRecord,
} from "./bangumi-native-plan";
import { resolveBangumiDependency } from "./bangumi-adoption";
import { bindCatalogNameSourceOccurrence } from "./names";
import { addCatalogName, loadCatalogIdentity, recordCatalogChange } from "./storage";
import { applyCatalogSourceNameDelta } from "./source-name-delta";
import { applyCatalogSourceIdentifierDelta } from "./source-identifier-delta";
import { readStructureComponentHead } from "./structure-history";
import { structureSourceComponent } from "./structure-source-contracts";
import {
	bindStructureSourceOccurrence,
	writeCatalogStructureSource,
	compensateCatalogStructureSource,
} from "./structure-source";
import {
	CatalogSourceNativeChangesSchema,
	readCatalogSourceApplication,
	type CatalogSourceNativeChange,
} from "./source-applications";
import { compensateCatalogSourceOwnedChange } from "./source-owned-compensation";
import { loadCatalogSourceDocument, type CatalogSourceReceipt } from "./source-observations";
import type { CatalogSourceNativeWriter } from "./source-proposals";
import { prepareCatalogSourceProposalDependency } from "./source-dependencies";
import { catalogSourceRecordId } from "./source-record-key";
import { applyCatalogSourceFactDelta } from "./source-fact-delta";

type Snapshot = Readonly<{ snapshotId: string; receipt: CatalogSourceReceipt; bytes: Uint8Array }>;
const namespace = "bangumi.name";

/** Admit current and exact previous episode parents separately; old-only targets are withdrawal reads. @internal */
export async function prepareBangumiProposalDependencies(
	tx: DatabaseTransaction,
	actor: string,
	input: Snapshot & { sourceRecordId: string; proposalId: string; before?: Snapshot | null },
) {
	if (BangumiNativeRelationFamilies.some((kind) => kind === input.receipt.key.objectType))
		return prepareBangumiRelationProposalDependencies(tx, actor, {
			sourceRecordId: input.sourceRecordId,
			proposalId: input.proposalId,
			after: input,
			before: input.before ?? null,
		});
	const incoming = prepareBangumiNativeRecord(input.receipt, input.bytes);
	const snapshots: { snapshot: Snapshot; purpose: "incoming" | "previous-for-withdrawal" }[] = [
		{ snapshot: input, purpose: "incoming" },
	];
	if (input.before) snapshots.push({ snapshot: input.before, purpose: "previous-for-withdrawal" });
	const prepared = [];
	for (const { snapshot, purpose } of snapshots) {
		const record = prepareBangumiNativeRecord(snapshot.receipt, snapshot.bytes);
		if (record.kind !== incoming.kind || record.value.id !== incoming.value.id)
			throw new TypeError("Bangumi dependency archives cross source identity");
		const document = await loadCatalogSourceDocument(
			tx,
			input.sourceRecordId,
			snapshot.snapshotId,
			snapshot.receipt,
			snapshot.bytes,
		);
		if (record.kind !== "episode") continue;
		await resolveBangumiDependency(tx, actor, "subject", record.value.subject_id);
		prepared.push(
			await prepareCatalogSourceProposalDependency(tx, actor, {
				sourceRecordId: input.sourceRecordId,
				proposalId: input.proposalId,
				position: prepared.length,
				purpose,
				dependencySourceRecordId: catalogSourceRecordId({
					source: "bangumi",
					objectType: "subject",
					externalId: String(record.value.subject_id),
				}),
				evidence: document.referenceAt("/subject_id"),
			}),
		);
	}
	return prepared;
}

function mapping(record: BangumiNativeRecord) {
	return record.kind === "subject"
		? "bangumi.subject.1"
		: record.kind === "episode"
			? "bangumi.program-episode.1"
			: "bangumi.entity.1";
}
function identifier(record: BangumiNativeRecord) {
	return [{ namespace: `bangumi.${record.kind}`, value: String(record.value.id), path: "/id" }];
}

async function projection(tx: DatabaseTransaction, actor: string, record: BangumiNativeRecord) {
	if (record.kind !== "episode") return planBangumiProgramProjection(record);
	const parent = await resolveBangumiDependency(tx, actor, "subject", record.value.subject_id);
	const identity = await loadCatalogIdentity(tx, parent, actor, false);
	if (parent.owner !== "program" || identity.shape !== "program")
		throw new TypeError("Bangumi episode requires a native Program parent");
	return planBangumiProgramProjection(record, parent.id);
}

/** Initializers bind exact names and structures before sealing their correspondence. @internal */
export async function initializeBangumiNativeOccurrences(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	revision: number,
	input: {
		sourceRecordId: string;
		snapshotId: string;
		receipt: CatalogSourceReceipt;
		bytes: Uint8Array;
	},
) {
	const record = prepareBangumiNativeRecord(input.receipt, input.bytes);
	const names = planBangumiNativeNames(record);
	const f = CatalogFactTables[reference.owner];
	const existing = await tx
		.select({ id: f.name.id, revision: f.name.revision, path: f.support.sourcePath })
		.from(f.support)
		.innerJoin(
			f.name,
			and(eq(f.name.ownerId, f.support.ownerId), eq(f.name.id, f.support.namedFormId)),
		)
		.where(
			and(
				eq(f.support.ownerId, reference.id),
				eq(f.support.sourceRecordId, input.sourceRecordId),
				eq(f.support.snapshotId, input.snapshotId),
				isNotNull(f.support.namedFormId),
			),
		)
		.limit(129);
	if (existing.length > 128 || new Set(existing.map((item) => item.path)).size !== existing.length)
		throw new TypeError("Bangumi initial named-form evidence is ambiguous");
	for (const name of names) {
		const found = existing.find((item) => item.path === name.path);
		const added = found ? null : await addCatalogName(tx, reference, actor, revision, name.value);
		if (added) revision = added.revision;
		const nameId = found?.id ?? added?.id;
		const nameRevision = found?.revision ?? added?.nameRevision;
		if (!nameId || !nameRevision)
			throw new Error("Bangumi named-form initialization returned no identity");
		await bindCatalogNameSourceOccurrence(tx, reference, actor, {
			sourceRecordId: input.sourceRecordId,
			snapshotId: input.snapshotId,
			sourcePath: name.path,
			namespace,
			localKey: `${input.snapshotId}:${name.path}`,
			nameId,
			nameRevision,
		});
	}
	const fixed = await projection(tx, actor, record);
	if (fixed) {
		const head = await readStructureComponentHead(
			tx,
			reference,
			structureSourceComponent("program", fixed.value),
			reference.id,
		);
		if (!head) throw new TypeError("Bangumi initial native structure lacks its exact history");
		await bindStructureSourceOccurrence(tx, reference, actor, {
			sourceRecordId: input.sourceRecordId,
			snapshotId: input.snapshotId,
			sourcePath: "/",
			historyId: head.id,
			sourceValue: fixed.value,
			observedFields: fixed.observedFields,
		});
	}
	const document = await loadCatalogSourceDocument(
		tx,
		input.sourceRecordId,
		input.snapshotId,
		input.receipt,
		input.bytes,
	);
	const facts = await applyCatalogSourceFactDelta(
		tx,
		reference,
		actor,
		revision,
		document,
		null,
		planBangumiNativeFacts(record),
	);
	return { revision: facts.revision };
}

/** Applies archived evidence through native component journals; compensation never remaps live source data. @internal */
export function createBangumiNativeWriter(input: {
	before: Snapshot | null;
	after: Snapshot;
	relationMapping?: z.input<typeof BangumiRelationMappingSchema>;
}): CatalogSourceNativeWriter {
	if (BangumiNativeRelationFamilies.some((kind) => kind === input.after.receipt.key.objectType)) {
		if (!input.relationMapping)
			throw new TypeError(
				"Bangumi relations require reviewed native predicate, role and qualifier definitions",
			);
		return createBangumiRelationNativeWriter({
			after: input.after,
			before: input.before,
			mapping: input.relationMapping,
		});
	}
	const prepare = (snapshot: Snapshot) => {
		z.uuid().parse(snapshot.snapshotId);
		const bytes = new Uint8Array(snapshot.bytes);
		return { ...snapshot, bytes, record: prepareBangumiNativeRecord(snapshot.receipt, bytes) };
	};
	const after = prepare(input.after),
		before = input.before ? prepare(input.before) : null;
	if (
		before &&
		(before.record.kind !== after.record.kind || before.record.value.id !== after.record.value.id)
	)
		throw new TypeError("Bangumi update crosses source identities");
	return async (tx, context) => {
		if (context.mappingVersion !== mapping(after.record) || context.snapshotId !== after.snapshotId)
			throw new TypeError("Bangumi callback differs from its exact proposal");
		const document = await loadCatalogSourceDocument(
			tx,
			context.sourceRecordId,
			after.snapshotId,
			after.receipt,
			after.bytes,
		);
		if (before)
			await loadCatalogSourceDocument(
				tx,
				context.sourceRecordId,
				before.snapshotId,
				before.receipt,
				before.bytes,
			);
		const current = await loadCatalogIdentity(tx, context.reference, context.actor, true);
		const expectedOwner =
			after.record.kind === "person" || after.record.kind === "character"
				? "entity"
				: after.record.kind === "episode"
					? "program"
					: after.record.value.type === 1
						? after.record.value.series
							? "grouping"
							: "publishing"
						: after.record.value.type === 3
							? "music"
							: after.record.value.type === 4
								? "software"
								: "program";
		const expectedShape =
			after.record.kind === "person"
				? after.record.value.type === 1
					? "person"
					: after.record.value.type === 2
						? "organization"
						: after.record.value.type === 3
							? "collective"
							: "unresolved"
				: after.record.kind === "character"
					? "character"
					: after.record.kind === "episode"
						? "episode"
						: expectedOwner === "program"
							? "program"
							: expectedOwner === "software"
								? "content"
								: expectedOwner === "grouping"
									? "grouping"
									: "catalog_entry";
		if (context.reference.owner !== expectedOwner || current.shape !== expectedShape)
			throw new TypeError("Bangumi native grain changed and requires reviewed correspondence");
		let revision = context.expectedRevision;
		const changes: CatalogSourceNativeChange[] = [];
		if (context.action === "withdraw") {
			const applied = await readCatalogSourceApplication(tx, context.actor, {
				sourceRecordId: context.sourceRecordId,
				proposalId: context.proposalId,
				action: "apply",
			});
			if (!applied || applied.application.previousSnapshotId !== (before?.snapshotId ?? null))
				throw new TypeError("Bangumi compensation lacks its exact applied source baseline");
			for (const change of [...applied.changes].reverse()) {
				if (
					!("owner" in change) ||
					change.owner !== context.reference.owner ||
					change.ownerId !== context.reference.id
				)
					throw new TypeError("Bangumi compensation journal crosses native targets");
				if (change.kind === "catalog-structure")
					changes.push(await compensateCatalogStructureSource(tx, context.actor, change));
				else if (
					change.kind === "catalog-name" ||
					change.kind === "catalog-name-authority" ||
					change.kind === "catalog-identifier" ||
					change.kind === "catalog-semantic"
				)
					changes.push(await compensateCatalogSourceOwnedChange(tx, context.actor, change));
				else throw new TypeError("Bangumi compensation journal contains another component family");
			}
			revision = (await loadCatalogIdentity(tx, context.reference, context.actor, true)).revision;
		} else {
			if (context.previousSnapshotId !== (before?.snapshotId ?? null))
				throw new TypeError("Bangumi prepared source baseline changed");
			const fixed = await projection(tx, context.actor, after.record);
			if (fixed) {
				const result = await writeCatalogStructureSource(
					tx,
					context.reference,
					context.actor,
					revision,
					{
						sourceRecordId: context.sourceRecordId,
						snapshotId: after.snapshotId,
						previousSnapshotId: before?.snapshotId ?? null,
						sourcePath: "/",
						sourceValue: fixed.value,
						observedFields: fixed.observedFields,
					},
				);
				revision = result.revision;
				changes.push(...result.changes);
			}
			const source = {
				sourceRecordId: context.sourceRecordId,
				mappingKey: context.mappingKey,
				snapshotId: after.snapshotId,
				previousSnapshotId: before?.snapshotId ?? null,
			};
			const names = await applyCatalogSourceNameDelta(
				tx,
				context.reference,
				context.actor,
				revision,
				source,
				{ namespace, names: planBangumiNativeNames(after.record) },
			);
			revision = names.revision;
			changes.push(...names.changes);
			const ids = await applyCatalogSourceIdentifierDelta(
				tx,
				context.reference,
				context.actor,
				revision,
				{ ...source, previousSnapshotId: before?.snapshotId ?? after.snapshotId },
				before ? identifier(before.record) : [],
				identifier(after.record),
			);
			revision = ids.revision;
			changes.push(...ids.changes);
			const facts = await applyCatalogSourceFactDelta(
				tx,
				context.reference,
				context.actor,
				revision,
				document,
				before
					? {
							snapshotId: before.snapshotId,
							mappingKey: context.mappingKey,
							descriptors: planBangumiNativeFacts(before.record),
						}
					: null,
				planBangumiNativeFacts(after.record),
			);
			revision = facts.revision;
			changes.push(...facts.changes);
		}
		revision = await recordCatalogChange(
			tx,
			context.reference,
			context.actor,
			revision,
			`source.bangumi.${after.record.kind}.${context.action}`,
		);
		return { revision, changes: CatalogSourceNativeChangesSchema.parse(changes) };
	};
}
