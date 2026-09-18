import { createHash } from "node:crypto";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { runParticipationSavepoint } from "../participation/policy";
import type { CatalogReference } from "@rezics/schema/contracts/native/catalog";
import type { CatalogSourceReceipt } from "./source-observations";
import { recordCatalogSourceDocument, loadCatalogSourceDocument } from "./source-observations";
import { inspectExistingSourceBinding } from "./source-adoption";
import { acceptCatalogSourceInitialization } from "./source-bindings";
import {
	prepareCatalogSourceChildCorrespondence,
	sealCatalogSourceChildCorrespondence,
} from "./source-child-correspondence";
import { VndbDumpContractSha256 } from "./vndb";
import type { VndbPreparedSnapshot } from "./vndb-release-update";
import {
	VndbAnimeSchema,
	VndbAnimeProgramTypes,
	planVndbAnimeNames,
	planVndbAnimeIdentifiers,
	planVndbAnimeSemantics,
	type VndbAnimeRecord,
} from "./vndb-anime-plans";
import { ProgramStructureSchema, createProgramStructure, updateProgramStructure } from "./program";
import {
	createCatalogIdentity,
	loadCatalogIdentity,
	ensureCatalogDefinition,
	recordCatalogChange,
	CatalogRevisionConflict,
} from "./storage";
import { readStructureComponentHead } from "./structure-history";
import { writeCatalogStructureSource, compensateCatalogStructureSource } from "./structure-source";
import { initializeVndbNativeNames, reconcileVndbNativeNames } from "./vndb-names-update";
import { appendVndbSemanticPlan } from "./vndb-semantics";
import { reconcileVndbSemanticPlan } from "./vndb-semantics-update";
import { applyCatalogSourceIdentifierDelta } from "./source-identifier-delta";
import { compensateCatalogSourceOwnedChange } from "./source-owned-compensation";
import {
	CatalogSourceNativeChangesSchema,
	readCatalogSourceApplication,
	type CatalogSourceNativeChange,
} from "./source-applications";
import type { CatalogSourceNativeWriter } from "./source-proposals";

const mappingVersion = "vndb.anime.1";
function prepare(receipt: CatalogSourceReceipt, bytes: Uint8Array) {
	if (
		bytes.byteLength > 8_000_000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256 ||
		receipt.contractSha256 !== VndbDumpContractSha256 ||
		receipt.key.source !== "vndb" ||
		receipt.key.objectType !== "anime"
	)
		throw new TypeError("Anime mirror differs from its reviewed VNDB dump receipt");
	const record = VndbAnimeSchema.parse(
		JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
	);
	if (String(record.id) !== receipt.key.externalId)
		throw new TypeError("Anime mirror source identity differs");
	return record;
}
async function structure(tx: DatabaseTransaction, record: VndbAnimeRecord) {
	const typeRevisionId =
		record.type === null
			? null
			: (
					await ensureCatalogDefinition(tx, {
						namespace: "catalog.program_type",
						key: VndbAnimeProgramTypes[record.type],
						kind: "vocabulary",
						valueKind: null,
						constraints: { targets: [{ owner: "program", shapes: ["program"] }], slots: ["type"] },
					})
				).revisionId;
	return ProgramStructureSchema.parse({ shape: "program", fields: { typeRevisionId } });
}

/**
 * @alpha
 * @remarks Source-import integration for the observed VNDB mirror; materializes an actual native Program without asserting direct AniDB acquisition.
 */
export async function adoptVndbAnime(
	tx: DatabaseTransaction,
	actor: string,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
) {
	const record = prepare(receipt, bytes);
	return runParticipationSavepoint(tx, async (write) => {
		const document = await recordCatalogSourceDocument(write, receipt, bytes);
		const existing = await inspectExistingSourceBinding(write, actor, document, mappingVersion);
		if (existing && existing.status !== "initialize_reference") return existing;
		const value = await structure(write, record),
			names = planVndbAnimeNames(record),
			firstName = names[0];
		let reference: CatalogReference,
			revision: number,
			seed: { id: string; revision: number } | undefined;
		if (existing) {
			reference = existing.reference;
			revision = existing.revision;
			const identity = await loadCatalogIdentity(write, reference, actor, true);
			if (reference.owner !== "program" || identity.shape !== "program")
				throw new TypeError("Anime mirror requires an explicitly reviewed Program target");
			if (!(await readStructureComponentHead(write, reference, "program_work", reference.id)))
				revision = (
					await updateProgramStructure(write, reference, actor, revision, {
						shape: "program",
						fields: {},
					})
				).revision;
		} else if (firstName) {
			const created = await createProgramStructure(write, actor, value, {
				value: firstName.fields.value,
				languageTag: firstName.fields.languageTag ?? null,
			});
			reference = { owner: "program", id: created.id };
			revision = created.revision;
			seed = { id: created.nameId, revision: 1 };
		} else {
			const created = await createCatalogIdentity(
				write,
				{ owner: "program", shape: "program" },
				actor,
			);
			reference = { owner: "program", id: created.id };
			revision = (await updateProgramStructure(write, reference, actor, created.revision, value))
				.revision;
		}
		const scope = await prepareCatalogSourceChildCorrespondence(write, actor, {
			sourceRecordId: document.record.id,
			snapshotId: document.snapshot.id,
			reference,
			mappingVersion,
		});
		revision = (
			await writeCatalogStructureSource(write, reference, actor, revision, {
				sourceRecordId: document.record.id,
				snapshotId: document.snapshot.id,
				previousSnapshotId: null,
				sourcePath: "/",
				sourceValue: value,
				observedFields: ["typeRevisionId"],
			})
		).revision;
		revision = await initializeVndbNativeNames(
			write,
			reference,
			actor,
			revision,
			names,
			document,
			seed,
		);
		revision = (
			await applyCatalogSourceIdentifierDelta(
				write,
				reference,
				actor,
				revision,
				{
					sourceRecordId: document.record.id,
					mappingKey: scope.mappingKey,
					previousSnapshotId: document.snapshot.id,
					snapshotId: document.snapshot.id,
				},
				[],
				planVndbAnimeIdentifiers(record),
			)
		).revision;
		revision = await appendVndbSemanticPlan(
			write,
			reference,
			actor,
			revision,
			planVndbAnimeSemantics(record),
			document,
		);
		if (existing)
			await acceptCatalogSourceInitialization(write, actor, {
				sourceRecordId: document.record.id,
				path: "/",
				snapshotId: document.snapshot.id,
				mappingVersion,
				reference,
				expectedBaselineRevision: existing.revision,
				finalRevision: revision,
			});
		else
			await sealCatalogSourceChildCorrespondence(write, actor, {
				sourceRecordId: document.record.id,
				path: "/",
				snapshotId: document.snapshot.id,
				mappingVersion,
				reference,
			});
		return { status: "created" as const, reference, revision, snapshotId: document.snapshot.id };
	});
}

/**
 * @alpha
 * @remarks Reviewed proposal services use this native callback for source-owned Program fields, names, identifiers and year evidence.
 */
export function createVndbAnimeNativeWriter(input: {
	before: VndbPreparedSnapshot | null;
	after: VndbPreparedSnapshot;
}): CatalogSourceNativeWriter {
	const before = input.before
		? { ...input.before, record: prepare(input.before.receipt, input.before.bytes) }
		: null;
	const after = { ...input.after, record: prepare(input.after.receipt, input.after.bytes) };
	z.uuid().parse(after.snapshotId);
	if (before) z.uuid().parse(before.snapshotId);
	if (before && before.record.id !== after.record.id)
		throw new TypeError("Anime mirror update crosses source identities");
	return async (tx, context) => {
		if (
			context.mappingVersion !== mappingVersion ||
			context.reference.owner !== "program" ||
			context.snapshotId !== after.snapshotId
		)
			throw new TypeError("Anime mirror writer differs from its exact source proposal");
		const identity = await loadCatalogIdentity(tx, context.reference, context.actor, true);
		if (identity.shape !== "program")
			throw new TypeError("Anime mirror native target has another shape");
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
			const application = await readCatalogSourceApplication(tx, context.actor, {
				sourceRecordId: context.sourceRecordId,
				proposalId: context.proposalId,
				action: "apply",
			});
			if (
				!application ||
				application.application.previousSnapshotId !== (before?.snapshotId ?? null)
			)
				throw new TypeError("Anime mirror compensation lacks its original source baseline");
			for (const change of [...application.changes].reverse()) {
				if (
					!("owner" in change) ||
					change.owner !== "program" ||
					change.ownerId !== context.reference.id
				)
					throw new TypeError("Anime mirror compensation cannot mutate another native target");
				if (change.kind === "catalog-structure")
					changes.push(await compensateCatalogStructureSource(tx, context.actor, change));
				else if (
					change.kind === "catalog-name" ||
					change.kind === "catalog-name-authority" ||
					change.kind === "catalog-identifier" ||
					change.kind === "catalog-semantic"
				)
					changes.push(await compensateCatalogSourceOwnedChange(tx, context.actor, change));
				else throw new TypeError("Anime mirror journal contains another component family");
			}
			revision = (await loadCatalogIdentity(tx, context.reference, context.actor, true)).revision;
		} else {
			if (context.previousSnapshotId !== (before?.snapshotId ?? null))
				throw new CatalogRevisionConflict("Anime source baseline changed after preparation");
			const fixed = await writeCatalogStructureSource(
				tx,
				context.reference,
				context.actor,
				revision,
				{
					sourceRecordId: context.sourceRecordId,
					snapshotId: after.snapshotId,
					previousSnapshotId: before?.snapshotId ?? null,
					sourcePath: "/",
					sourceValue: await structure(tx, after.record),
					observedFields: ["typeRevisionId"],
				},
			);
			revision = fixed.revision;
			changes.push(...fixed.changes);
			const names = await reconcileVndbNativeNames(
				tx,
				context.reference,
				context.actor,
				revision,
				context.mappingKey,
				{ plan: before ? planVndbAnimeNames(before.record) : [], document: previousDocument },
				{ plan: planVndbAnimeNames(after.record), document },
			);
			revision = names.revision;
			changes.push(...names.changes);
			const identifiers = await applyCatalogSourceIdentifierDelta(
				tx,
				context.reference,
				context.actor,
				revision,
				{
					sourceRecordId: context.sourceRecordId,
					mappingKey: context.mappingKey,
					previousSnapshotId: previousDocument.snapshot.id,
					snapshotId: after.snapshotId,
				},
				before ? planVndbAnimeIdentifiers(before.record) : [],
				planVndbAnimeIdentifiers(after.record),
			);
			revision = identifiers.revision;
			changes.push(...identifiers.changes);
			const semantic = await reconcileVndbSemanticPlan(
				tx,
				context.reference,
				context.actor,
				revision,
				context.mappingKey,
				{
					plan: before ? planVndbAnimeSemantics(before.record) : { facts: [], relations: [] },
					document: previousDocument,
				},
				{ plan: planVndbAnimeSemantics(after.record), document },
			);
			revision = semantic.revision;
			changes.push(...semantic.changes);
		}
		revision = await recordCatalogChange(
			tx,
			context.reference,
			context.actor,
			revision,
			`source.vndb.anime.${context.action}`,
		);
		return { revision, changes: CatalogSourceNativeChangesSchema.parse(changes) };
	};
}
