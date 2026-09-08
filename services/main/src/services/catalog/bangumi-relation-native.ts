import { createHash } from "node:crypto";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import type { CatalogReference } from "./contracts";
import { BangumiArchiveContractSha256 } from "./bangumi-contracts";
import { BangumiArchiveRelationSchema, bangumiRelationKey } from "./bangumi-records";
import { BangumiRelationMappingSchema, planBangumiArchiveRelation } from "./bangumi-relations";
import { resolveBangumiDependency } from "./bangumi-adoption";
import { inspectExistingSourceBinding } from "./source-adoption";
import { acceptCatalogSourceInitialization } from "./source-bindings";
import {
	prepareCatalogSourceChildCorrespondence,
	sealCatalogSourceChildCorrespondence,
} from "./source-child-correspondence";
import { loadCatalogIdentity, recordCatalogChange } from "./storage";
import {
	recordCatalogSourceDocument,
	loadCatalogSourceDocument,
	type CatalogSourceReceipt,
} from "./source-observations";
import {
	applyCatalogSourceFactDelta,
	type CatalogSourceFactDescriptor,
	type CatalogSourceFactResult,
} from "./source-fact-delta";
import {
	applyCatalogSourceRelationDelta,
	readCatalogSourceRelationDescriptor,
	type CatalogSourceRelationDescriptor,
} from "./source-relation-delta";
import { prepareCatalogSourceProposalDependency } from "./source-dependencies";
import { catalogSourceRecordId } from "./source-record-key";
import {
	readCatalogSourceApplication,
	type CatalogSourceNativeChange,
} from "./source-applications";
import { compensateCatalogSourceOwnedChange } from "./source-owned-compensation";
import type { CatalogSourceNativeWriter } from "./source-proposals";

type Snapshot = { snapshotId: string; receipt: CatalogSourceReceipt; bytes: Uint8Array };
type Mapping = z.output<typeof BangumiRelationMappingSchema>;
type Plan = ReturnType<typeof planBangumiArchiveRelation>;
export const BangumiArchiveRelationMappingVersion = "bangumi.archive-relations.1";
export const BangumiNativeRelationFamilies = [
	"subject-relations",
	"subject-persons",
	"subject-characters",
	"person-characters",
	"person-relations",
] as const;

/** Archive tuples are source record keys, never native identities. @internal */
export function prepareBangumiNativeRelation(receipt: CatalogSourceReceipt, bytes: Uint8Array) {
	if (
		receipt.key.source !== "bangumi" ||
		receipt.contractSha256 !== BangumiArchiveContractSha256 ||
		bytes.byteLength > 512000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256
	)
		throw new TypeError("Bangumi relation differs from its reviewed immutable receipt");
	const raw = z
		.record(z.string(), z.unknown())
		.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
	if ("kind" in raw && raw.kind !== receipt.key.objectType)
		throw new TypeError("Bangumi relation family differs from its source key");
	const plan = planBangumiArchiveRelation(
		BangumiArchiveRelationSchema.parse({ ...raw, kind: receipt.key.objectType }),
	);
	if (receipt.key.externalId !== bangumiRelationKey(plan.row))
		throw new TypeError("Bangumi relation tuple differs from its source key");
	return plan;
}

/** Governed scalar qualifiers belong to the native relation; no provider taxonomy is manufactured. @internal */
export function planBangumiNativeRelationFacts(
	plan: Plan,
	mapping: Mapping,
): CatalogSourceFactDescriptor[] {
	return plan.qualifiers.map((qualifier) => {
		const definitionRevisionId = mapping.qualifiers[qualifier.key];
		if (!definitionRevisionId)
			throw new TypeError(`Missing reviewed relation qualifier: ${qualifier.key}`);
		const identity = qualifier.key,
			path = `/${qualifier.key}`;
		if (typeof qualifier.value === "number")
			return { identity, path, definitionRevisionId, kind: "number", value: qualifier.value };
		if (typeof qualifier.value === "boolean")
			return { identity, path, definitionRevisionId, kind: "boolean", value: qualifier.value };
		return { identity, path, definitionRevisionId, kind: "string", value: qualifier.value };
	});
}

async function descriptor(
	tx: DatabaseTransaction,
	actor: string,
	reference: CatalogReference,
	plan: Plan,
	mapping: Mapping,
	facts: readonly CatalogSourceFactResult[],
): Promise<CatalogSourceRelationDescriptor> {
	const participants = [];
	for (const participant of plan.participants) {
		const roleRevisionId = mapping.roles[participant.role];
		if (!roleRevisionId) throw new TypeError(`Missing reviewed relation role: ${participant.role}`);
		participants.push({
			roleRevisionId,
			target: await resolveBangumiDependency(tx, actor, participant.objectType, participant.id),
		});
	}
	const primary = participants[0]?.target;
	if (!primary || primary.owner !== reference.owner || primary.id !== reference.id)
		throw new TypeError("Bangumi relation owner differs from its native source subject");
	const qualifiers = plan.qualifiers.map((qualifier) => {
		const definitionRevisionId = mapping.qualifiers[qualifier.key],
			fact = facts.find((value) => value.identity === qualifier.key);
		if (!definitionRevisionId || !fact)
			throw new TypeError("Bangumi native relation lacks its exact qualifier fact");
		return { definitionRevisionId, valueFactId: fact.factId };
	});
	return {
		identity: "relation",
		path: "/",
		value: {
			definitionRevisionId: mapping.predicateRevisionId,
			participants,
			qualifiers,
			spoiler: plan.spoiler,
		},
	};
}

async function apply(
	tx: DatabaseTransaction,
	actor: string,
	reference: CatalogReference,
	revision: number,
	mapping: Mapping,
	next: { snapshot: Snapshot; plan: Plan },
	old: { snapshot: Snapshot; plan: Plan } | null,
	sourceRecordId: string,
	mappingKey: string,
) {
	const document = await loadCatalogSourceDocument(
		tx,
		sourceRecordId,
		next.snapshot.snapshotId,
		next.snapshot.receipt,
		next.snapshot.bytes,
	);
	const before = old
		? await readCatalogSourceRelationDescriptor(tx, reference, actor, {
				sourceRecordId,
				snapshotId: old.snapshot.snapshotId,
				identity: "relation",
				path: "/",
			})
		: null;
	if (old && !before)
		throw new TypeError("Previous Bangumi relation lacks its exact native occurrence");
	const facts = await applyCatalogSourceFactDelta(
		tx,
		reference,
		actor,
		revision,
		document,
		old
			? {
					snapshotId: old.snapshot.snapshotId,
					mappingKey,
					descriptors: planBangumiNativeRelationFacts(old.plan, mapping),
				}
			: null,
		planBangumiNativeRelationFacts(next.plan, mapping),
	);
	const incoming = await descriptor(tx, actor, reference, next.plan, mapping, facts.facts);
	if (
		before &&
		(before.value.participants.length !== incoming.value.participants.length ||
			before.value.participants.some(
				(value, position) =>
					value.roleRevisionId !== incoming.value.participants[position]?.roleRevisionId,
			))
	)
		throw new TypeError(
			"Bangumi relation role interpretation changed without reviewed correspondence",
		);
	const relations = await applyCatalogSourceRelationDelta(
		tx,
		reference,
		actor,
		facts.revision,
		document,
		old && before
			? { snapshotId: old.snapshot.snapshotId, mappingKey, descriptors: [before] }
			: null,
		[incoming],
	);
	return {
		revision: relations.revision,
		changes: [...facts.changes, ...relations.changes],
		relations: relations.relations,
	};
}

/** Initial adoption and reviewed refresh share native fact/relation journals on the source subject. @internal */
export async function initializeBangumiNativeRelation(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
	mappingInput: z.input<typeof BangumiRelationMappingSchema>,
) {
	const plan = prepareBangumiNativeRelation(receipt, bytes),
		mapping = BangumiRelationMappingSchema.parse(mappingInput);
	const document = await recordCatalogSourceDocument(tx, receipt, bytes);
	const existing = await inspectExistingSourceBinding(
		tx,
		actor,
		document,
		BangumiArchiveRelationMappingVersion,
	);
	if (
		existing &&
		(existing.reference.owner !== reference.owner || existing.reference.id !== reference.id)
	)
		throw new TypeError("Bangumi relation correspondence points to another native subject");
	if (existing && existing.status !== "initialize_reference") return existing;
	const owner = await loadCatalogIdentity(tx, reference, actor, true);
	if (owner.revision !== expectedRevision)
		throw new TypeError("Bangumi relation owner revision changed");
	const scope = await prepareCatalogSourceChildCorrespondence(tx, actor, {
		sourceRecordId: document.record.id,
		snapshotId: document.snapshot.id,
		reference,
		mappingVersion: BangumiArchiveRelationMappingVersion,
	});
	const result = await apply(
		tx,
		actor,
		reference,
		expectedRevision,
		mapping,
		{ snapshot: { receipt, bytes, snapshotId: document.snapshot.id }, plan },
		null,
		document.record.id,
		scope.mappingKey,
	);
	const binding = {
		sourceRecordId: document.record.id,
		snapshotId: document.snapshot.id,
		reference,
		mappingVersion: BangumiArchiveRelationMappingVersion,
		path: "/" as const,
	};
	if (existing)
		await acceptCatalogSourceInitialization(tx, actor, {
			...binding,
			expectedBaselineRevision: existing.revision,
			finalRevision: result.revision,
		});
	else await sealCatalogSourceChildCorrespondence(tx, actor, binding);
	const relation = result.relations[0];
	if (!relation) throw new Error("Bangumi native relation initialization returned no identity");
	return {
		status: "created" as const,
		reference,
		revision: result.revision,
		snapshotId: document.snapshot.id,
		id: relation.relationId,
		semanticId: relation.semanticId,
	};
}

/** Only exact archived endpoint references receive scoped reads; preparing relations never creates foreign identities. @internal */
export async function prepareBangumiRelationProposalDependencies(
	tx: DatabaseTransaction,
	actor: string,
	input: { sourceRecordId: string; proposalId: string; after: Snapshot; before: Snapshot | null },
) {
	const archives: { snapshot: Snapshot; purpose: "incoming" | "previous-for-withdrawal" }[] = [
		{ snapshot: input.after, purpose: "incoming" },
	];
	if (input.before) archives.push({ snapshot: input.before, purpose: "previous-for-withdrawal" });
	const prepared = [];
	for (const archive of archives) {
		if (
			archive.snapshot.receipt.key.objectType !== input.after.receipt.key.objectType ||
			archive.snapshot.receipt.key.externalId !== input.after.receipt.key.externalId
		)
			throw new TypeError("Bangumi relation dependency archives cross source identity");
		const plan = prepareBangumiNativeRelation(archive.snapshot.receipt, archive.snapshot.bytes);
		const document = await loadCatalogSourceDocument(
			tx,
			input.sourceRecordId,
			archive.snapshot.snapshotId,
			archive.snapshot.receipt,
			archive.snapshot.bytes,
		);
		for (const participant of plan.participants) {
			await resolveBangumiDependency(tx, actor, participant.objectType, participant.id);
			const path = `/${participant.role}_id`;
			prepared.push(
				await prepareCatalogSourceProposalDependency(tx, actor, {
					sourceRecordId: input.sourceRecordId,
					proposalId: input.proposalId,
					position: prepared.length,
					purpose: archive.purpose,
					dependencySourceRecordId: catalogSourceRecordId({
						source: "bangumi",
						objectType: participant.objectType,
						externalId: String(participant.id),
					}),
					evidence: document.referenceAt(path),
				}),
			);
		}
	}
	return prepared;
}

/** Native archive relationship replacement is compensated from the recorded apply journal, never remapped. @internal */
export function createBangumiRelationNativeWriter(input: {
	after: Snapshot;
	before: Snapshot | null;
	mapping: z.input<typeof BangumiRelationMappingSchema>;
}): CatalogSourceNativeWriter {
	const prepare = (snapshot: Snapshot) => {
		z.uuid().parse(snapshot.snapshotId);
		const copied = { ...snapshot, bytes: new Uint8Array(snapshot.bytes) };
		return { snapshot: copied, plan: prepareBangumiNativeRelation(copied.receipt, copied.bytes) };
	};
	const after = prepare(input.after),
		before = input.before ? prepare(input.before) : null,
		mapping = BangumiRelationMappingSchema.parse(input.mapping);
	if (
		before &&
		(before.snapshot.receipt.key.objectType !== after.snapshot.receipt.key.objectType ||
			before.snapshot.receipt.key.externalId !== after.snapshot.receipt.key.externalId)
	)
		throw new TypeError("Bangumi relation archives cross source identity");
	return async (tx, context) => {
		if (
			context.mappingVersion !== BangumiArchiveRelationMappingVersion ||
			context.snapshotId !== after.snapshot.snapshotId
		)
			throw new TypeError("Bangumi relation callback differs from its exact proposal");
		await loadCatalogSourceDocument(
			tx,
			context.sourceRecordId,
			after.snapshot.snapshotId,
			after.snapshot.receipt,
			after.snapshot.bytes,
		);
		if (before)
			await loadCatalogSourceDocument(
				tx,
				context.sourceRecordId,
				before.snapshot.snapshotId,
				before.snapshot.receipt,
				before.snapshot.bytes,
			);
		let revision = context.expectedRevision;
		const changes: CatalogSourceNativeChange[] = [];
		if (context.action === "withdraw") {
			const applied = await readCatalogSourceApplication(tx, context.actor, {
				sourceRecordId: context.sourceRecordId,
				proposalId: context.proposalId,
				action: "apply",
			});
			if (
				!applied ||
				applied.application.previousSnapshotId !== (before?.snapshot.snapshotId ?? null)
			)
				throw new TypeError("Bangumi relation compensation lacks its exact source baseline");
			for (const change of [...applied.changes].reverse()) {
				if (
					change.kind !== "catalog-semantic" ||
					change.owner !== context.reference.owner ||
					change.ownerId !== context.reference.id
				)
					throw new TypeError("Bangumi relation compensation journal crosses native owners");
				changes.push(await compensateCatalogSourceOwnedChange(tx, context.actor, change));
			}
			revision = (await loadCatalogIdentity(tx, context.reference, context.actor, true)).revision;
		} else {
			if (context.previousSnapshotId !== (before?.snapshot.snapshotId ?? null))
				throw new TypeError("Bangumi relation prepared source baseline changed");
			const result = await apply(
				tx,
				context.actor,
				context.reference,
				revision,
				mapping,
				after,
				before,
				context.sourceRecordId,
				context.mappingKey,
			);
			revision = result.revision;
			changes.push(...result.changes);
		}
		revision = await recordCatalogChange(
			tx,
			context.reference,
			context.actor,
			revision,
			`source.bangumi.relation.${context.action}`,
		);
		return { revision, changes };
	};
}
