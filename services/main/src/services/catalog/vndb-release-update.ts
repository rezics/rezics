import {
	resolveCatalogSourceChildCorrespondence,
	type CatalogSourceChildCorrespondence,
} from "./source-child-correspondence";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import {
	softwareComponentRevision,
	softwareRecordRevision,
} from "@rezics/schema/postgres/software/software";
import { softwareComponentSourceOccurrence } from "@rezics/schema/postgres/software/software-source";
import { softwareSourceComponentBaseline } from "@rezics/schema/postgres/ingestion/source-owned-baseline";
import { CatalogRevisionConflict, loadCatalogIdentity, recordCatalogChange } from "./storage";
import { loadCatalogSourceDocument, type CatalogSourceReceipt } from "./source-observations";
import type { CatalogSourceNativeWriter } from "./source-proposals";
import {
	CatalogSourceNativeChangesSchema,
	type CatalogSourceNativeChange,
} from "./source-applications";
import { compensateVndbSoftwareApplication } from "./vndb-software-compensation";
import {
	SoftwareReleaseDetailsSchema,
	decodeSoftwareReleaseSnapshot,
	reviseSoftwareRelease,
} from "./software";
import {
	decodeSoftwareComponentSnapshot,
	SoftwareComponentValuesSchema,
	type SoftwareComponentKind,
	putSoftwareComponent,
	withdrawSoftwareComponent,
} from "./software-components";
import { VndbCatalogContractSha256, VndbDumpContractSha256 } from "./vndb";
import {
	planVndbRelease,
	planVndbReleaseComponents,
	recordVndbSoftwareScalarOccurrence,
} from "./vndb-release";
import {
	planVndbDumpRelease,
	planVndbDumpReleaseSemantics,
	vndbDumpReleaseSourcePath,
} from "./vndb-dump";
import { planVndbSemantics } from "./vndb-semantics-contracts";
import { reconcileVndbSemanticPlan } from "./vndb-semantics-update";
import { planVndbNativeNames, reconcileVndbNativeNames } from "./vndb-names-update";

/** @internal Receipt bytes must be read outside the transaction; the writer verifies the exact committed snapshot again. */
export type VndbPreparedSnapshot = {
	snapshotId: string;
	receipt: CatalogSourceReceipt;
	bytes: Uint8Array;
};
type Context = Parameters<CatalogSourceNativeWriter>[1] & CatalogSourceChildCorrespondence;

/** @internal Three-way field merge retains unrelated native corrections and rejects genuine source/local conflicts. */
export function mergeVndbOwnedValues(before: unknown, after: unknown, current: unknown) {
	const parser = z.record(z.string(), z.unknown());
	const old = parser.parse(before),
		next = parser.parse(after),
		native = parser.parse(current),
		merged = { ...native };
	for (const [key, value] of Object.entries(next)) {
		if (isDeepStrictEqual(old[key], value)) continue;
		if (!isDeepStrictEqual(native[key], old[key]) && !isDeepStrictEqual(native[key], value))
			throw new CatalogRevisionConflict(`VNDB source conflicts with native ${key}`);
		merged[key] = value;
	}
	return merged;
}
function prepare(input: VndbPreparedSnapshot) {
	const snapshotId = z.uuid().parse(input.snapshotId),
		bytes = new Uint8Array(input.bytes),
		receipt = input.receipt;
	if (
		bytes.byteLength > 8_000_000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256 ||
		receipt.key.source !== "vndb" ||
		receipt.key.objectType !== "release"
	)
		throw new TypeError("VNDB release archive differs from its receipt");
	const raw: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	const dump = receipt.contractSha256 === VndbDumpContractSha256 ? planVndbDumpRelease(raw) : null;
	if (!dump && receipt.contractSha256 !== VndbCatalogContractSha256)
		throw new TypeError("Unreviewed VNDB source contract");
	const plan = dump ?? planVndbRelease(raw);
	if (plan.record.id !== receipt.key.externalId)
		throw new TypeError("VNDB release archive has another identity");
	const path = dump
		? (value: string) => vndbDumpReleaseSourcePath(dump.document, value)
		: (value: string) => value;
	return {
		snapshotId,
		receipt,
		bytes,
		record: plan.record,
		details: plan.details,
		dump,
		path,
		semantics: dump ? planVndbDumpReleaseSemantics(dump.document) : planVndbSemantics(plan.record),
	};
}
async function components(
	tx: DatabaseTransaction,
	actor: string,
	prepared: ReturnType<typeof prepare>,
	document: Awaited<ReturnType<typeof loadCatalogSourceDocument>>,
) {
	const planned = await planVndbReleaseComponents(
		tx,
		actor,
		prepared.record,
		document,
		prepared.dump ? (index) => `/vns/${index}/vid` : undefined,
		prepared.path,
	);
	const values: {
		key: string;
		path: string;
		componentId: string;
		value: z.output<typeof SoftwareComponentValuesSchema>;
	}[] = planned.map((item) => ({
		...item,
		value: SoftwareComponentValuesSchema.parse(item.value),
	}));
	const fields = {
		story_sprite: "ani_story_sp",
		story_scene: "ani_story_cg",
		cutscene: "ani_cutscene",
		erotic_sprite: "ani_ero_sp",
		erotic_scene: "ani_ero_cg",
	} as const;
	for (const animation of prepared.dump?.animationContexts ?? [])
		values.push({
			key: `animation/${animation.context}`,
			path: `/release/${fields[animation.context]}`,
			componentId: animation.context,
			value: { kind: "animation", ...animation },
		});
	return values;
}
async function scalarHead(tx: DatabaseTransaction, ownerId: string) {
	const t = softwareRecordRevision;
	const [row] = await tx
		.select()
		.from(t)
		.where(eq(t.ownerId, ownerId))
		.orderBy(desc(t.revision))
		.limit(1);
	return row;
}
async function componentHead(
	tx: DatabaseTransaction,
	ownerId: string,
	kind: SoftwareComponentKind,
	id: string,
) {
	const t = softwareComponentRevision;
	const [row] = await tx
		.select()
		.from(t)
		.where(and(eq(t.releaseId, ownerId), eq(t.kind, kind), eq(t.componentId, id)))
		.orderBy(desc(t.revision))
		.limit(1);
	return row;
}
async function sourceComponent(
	tx: DatabaseTransaction,
	context: Context,
	snapshotId: string,
	kind: SoftwareComponentKind,
	id: string,
) {
	const t = softwareComponentSourceOccurrence;
	const [row] = await tx
		.select()
		.from(t)
		.where(
			and(
				eq(t.sourceRecordId, context.sourceRecordId),
				eq(t.mappingKey, context.mappingKey),
				eq(t.correspondenceRevision, context.correspondenceRevision),
				eq(t.snapshotId, snapshotId),
				eq(t.ownerId, context.reference.id),
				eq(t.component, kind),
				eq(t.componentKey, id),
			),
		)
		.limit(1);
	return row;
}
async function recordComponent(
	tx: DatabaseTransaction,
	context: Context,
	item: {
		componentId: string;
		path: string;
		value: z.output<typeof SoftwareComponentValuesSchema>;
	},
	revision: number,
) {
	const t = softwareComponentSourceOccurrence;
	const existing = await sourceComponent(
		tx,
		context,
		context.snapshotId,
		item.value.kind,
		item.componentId,
	);
	if (existing) return;
	await tx.insert(t).values({
		mappingKey: context.mappingKey,
		correspondenceRevision: context.correspondenceRevision,
		sourceRecordId: context.sourceRecordId,
		snapshotId: context.snapshotId,
		ownerId: context.reference.id,
		component: item.value.kind,
		componentKey: item.componentId,
		revision,
		sourcePath: item.path,
	});
}

/** @alpha @remarks Genuine archived release update and exact compensation callbacks use canonical native writers. */
export function createVndbReleaseNativeWriter(input: {
	before: VndbPreparedSnapshot | null;
	after: VndbPreparedSnapshot;
}): CatalogSourceNativeWriter {
	const before = input.before ? prepare(input.before) : null,
		after = prepare(input.after);
	if (before && before.receipt.contractSha256 !== after.receipt.contractSha256)
		throw new TypeError(
			"VNDB source-surface transition requires a reviewed combined API/dump projection",
		);
	if (before && before.record.id !== after.record.id)
		throw new TypeError("VNDB delta crosses release identities");
	return async (tx, inputContext) => {
		const scope = await resolveCatalogSourceChildCorrespondence(tx, inputContext.sourceRecordId);
		if (scope.mappingKey !== inputContext.mappingKey) throw new Error("VNDB root mapping differs");
		const context = { ...inputContext, ...scope };
		if (
			context.mappingVersion !== "vndb.release.2" ||
			context.snapshotId !== after.snapshotId ||
			context.reference.owner !== "software"
		)
			throw new TypeError("VNDB release writer context differs from its prepared source");
		const native = await loadCatalogIdentity(tx, context.reference, context.actor, true);
		if (native.shape !== "release")
			throw new TypeError("VNDB release requires native release identity");
		if (context.action === "withdraw")
			return compensateVndbSoftwareApplication(tx, context, "release");
		if (context.previousSnapshotId !== (before?.snapshotId ?? null))
			throw new CatalogRevisionConflict("VNDB source baseline changed after preparation");
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
		if (before)
			for (const field of [
				"title",
				"languages",
				"platforms",
				"media",
				"vns",
				"producers",
				"images",
				"extlinks",
				"patch",
				"freeware",
				"uncensored",
				"has_ero",
				"minage",
				"resolution",
				"engine",
				"voiced",
				"notes",
				"gtin",
				"catalog",
				"released",
				"official",
			] as const)
				if (before.record[field] !== undefined && after.record[field] === undefined)
					throw new TypeError(`VNDB update omitted previously observed ${field}`);
		const changes: CatalogSourceNativeChange[] = [];
		let revision = context.expectedRevision;
		const currentScalar = await scalarHead(tx, context.reference.id);
		const current = currentScalar
			? decodeSoftwareReleaseSnapshot(currentScalar.value)
			: SoftwareReleaseDetailsSchema.parse({});
		const merged = SoftwareReleaseDetailsSchema.parse(
			mergeVndbOwnedValues(
				before?.details ?? SoftwareReleaseDetailsSchema.parse({}),
				after.details,
				current,
			),
		);
		if (!currentScalar || !isDeepStrictEqual(merged, current)) {
			const updated = await reviseSoftwareRelease(
				tx,
				context.reference,
				context.actor,
				revision,
				merged,
			);
			revision = updated.revision;
			changes.push({
				kind: "software-record",
				ownerId: context.reference.id,
				beforeRevision: currentScalar?.revision ?? null,
				afterRevision: revision,
			});
		}
		await recordVndbSoftwareScalarOccurrence(tx, document, context.reference.id, after.path("/"), {
			sourceShape: "release",
			sourceValue: after.details,
		});
		const oldComponents = before
			? await components(tx, context.actor, before, previousDocument)
			: [];
		const nextComponents = await components(tx, context.actor, after, document);
		const oldMap = new Map(oldComponents.map((item) => [item.key, item])),
			nextMap = new Map(nextComponents.map((item) => [item.key, item]));
		for (const item of nextComponents) {
			const old = oldMap.get(item.key),
				kind = item.value.kind;
			const origin =
				old && before
					? await sourceComponent(tx, context, before.snapshotId, kind, old.componentId)
					: undefined;
			if (old && !origin)
				throw new Error("VNDB release component has no exact previous source occurrence");
			const head = await componentHead(tx, context.reference.id, kind, item.componentId);
			if (old && head?.operation !== "put")
				throw new CatalogRevisionConflict("VNDB release component was independently withdrawn");
			if (
				old &&
				isDeepStrictEqual(
					SoftwareComponentValuesSchema.parse(old.value),
					SoftwareComponentValuesSchema.parse(item.value),
				)
			) {
				if (!origin) throw new Error("Source occurrence is missing");
				await recordComponent(tx, context, item, origin.revision);
				continue;
			}
			if (!old && head) {
				const t = softwareSourceComponentBaseline;
				const [baseline] = await tx
					.select()
					.from(t)
					.where(
						and(
							eq(t.sourceRecordId, context.sourceRecordId),
							eq(t.mappingKey, context.mappingKey),
							eq(t.correspondenceRevision, context.correspondenceRevision),
							eq(t.ownerId, context.reference.id),
							eq(t.component, kind),
							eq(t.componentKey, item.componentId),
						),
					)
					.limit(1);
				if (!baseline || !baseline.absent || baseline.currentRevision !== head.revision)
					throw new CatalogRevisionConflict(
						"VNDB release component reappearance conflicts with native ownership",
					);
			}
			const value =
				old && head
					? SoftwareComponentValuesSchema.parse(
							mergeVndbOwnedValues(
								SoftwareComponentValuesSchema.parse(old.value),
								SoftwareComponentValuesSchema.parse(item.value),
								decodeSoftwareComponentSnapshot(kind, head.value),
							),
						)
					: item.value;
			const put = await putSoftwareComponent(
				tx,
				context.reference,
				context.actor,
				revision,
				item.componentId,
				head?.revision ?? null,
				value,
			);
			revision = put.revision;
			if (put.componentRevision !== (head?.revision ?? null))
				changes.push({
					kind: "software-component",
					ownerId: context.reference.id,
					component: kind,
					componentKey: item.componentId,
					beforeRevision: head?.revision ?? null,
					afterRevision: put.componentRevision,
				});
			await recordComponent(tx, context, item, put.componentRevision);
		}
		for (const item of oldComponents) {
			if (nextMap.has(item.key)) continue;
			const origin = before
				? await sourceComponent(tx, context, before.snapshotId, item.value.kind, item.componentId)
				: undefined;
			if (!origin) throw new Error("Removed release component has no source evidence");
			const t = softwareSourceComponentBaseline;
			const [baseline] = await tx
				.select()
				.from(t)
				.where(
					and(
						eq(t.sourceRecordId, context.sourceRecordId),
						eq(t.mappingKey, context.mappingKey),
						eq(t.correspondenceRevision, context.correspondenceRevision),
						eq(t.ownerId, context.reference.id),
						eq(t.component, item.value.kind),
						eq(t.componentKey, item.componentId),
					),
				)
				.limit(1);
			const expected =
				baseline?.sourceRevision === origin.revision ? baseline.currentRevision : origin.revision;
			const current = await componentHead(
				tx,
				context.reference.id,
				item.value.kind,
				item.componentId,
			);
			if (
				!current ||
				current.operation !== "put" ||
				!isDeepStrictEqual(
					SoftwareComponentValuesSchema.parse(item.value),
					decodeSoftwareComponentSnapshot(item.value.kind, current.value),
				)
			)
				throw new CatalogRevisionConflict(
					"Removing VNDB occurrence would erase independent native component values",
				);
			const removed = await withdrawSoftwareComponent(
				tx,
				context.reference,
				context.actor,
				revision,
				item.value.kind,
				item.componentId,
				expected,
			);
			revision = removed.revision;
			changes.push({
				kind: "software-component",
				ownerId: context.reference.id,
				component: item.value.kind,
				componentKey: item.componentId,
				beforeRevision: expected,
				afterRevision: removed.componentRevision,
			});
		}
		const names = await reconcileVndbNativeNames(
			tx,
			context.reference,
			context.actor,
			revision,
			context.mappingKey,
			{
				plan: before ? planVndbNativeNames(before.record, "release", before.path) : [],
				document: previousDocument,
			},
			{ plan: planVndbNativeNames(after.record, "release", after.path), document },
		);
		revision = names.revision;
		changes.push(...names.changes);
		const semantics = await reconcileVndbSemanticPlan(
			tx,
			context.reference,
			context.actor,
			revision,
			context.mappingKey,
			{ plan: before?.semantics ?? { facts: [], relations: [] }, document: previousDocument },
			{ plan: after.semantics, document },
		);
		revision = semantics.revision;
		changes.push(...semantics.changes);
		revision = await recordCatalogChange(
			tx,
			context.reference,
			context.actor,
			revision,
			"source.vndb.release.apply",
		);
		return { revision, changes: CatalogSourceNativeChangesSchema.parse(changes) };
	};
}
