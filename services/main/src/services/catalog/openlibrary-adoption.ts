import { runParticipationSavepoint } from "../participation/policy";
import type { DatabaseTransaction } from "../database";
import type { CatalogReference } from "@rezics/schema/contracts/native/catalog";
import {
	OpenLibraryContractSha256,
	OpenLibraryMappingVersion,
	type OpenLibraryDocument,
} from "./openlibrary";
import {
	recordCatalogSourceDocument,
	loadCatalogSourceDocument,
	type CatalogSourceReceipt,
} from "./source-observations";
import { inspectExistingSourceBinding } from "./source-adoption";
import {
	prepareCatalogSourceChildCorrespondence,
	sealCatalogSourceChildCorrespondence,
} from "./source-child-correspondence";
import { acceptCatalogSourceInitialization } from "./source-bindings";
import {
	createCatalogIdentity,
	loadCatalogIdentity,
	recordCatalogChange,
	CatalogRevisionConflict,
} from "./storage";
import { initializeEntityProfile } from "./entities";
import { PublishingStructureSchema, updatePublishingStructure } from "./publishing";
import { writeCatalogStructureSource, compensateCatalogStructureSource } from "./structure-source";
import {
	readChildSourceOccurrences,
	writeCatalogChildSource,
	compensateCatalogChildSource,
} from "./child-source";
import { ChildSourceComponents } from "./child-source-contracts";
import { applyCatalogSourceNameDelta } from "./source-name-delta";
import { applyCatalogSourceIdentifierDelta } from "./source-identifier-delta";
import { applyCatalogSourceFactDelta } from "./source-fact-delta";
import {
	applyCatalogSourceRelationDelta,
	readCatalogSourceRelationDescriptor,
	type CatalogSourceRelationDescriptor,
} from "./source-relation-delta";
import { compensateCatalogSourceOwnedChange } from "./source-owned-compensation";
import {
	CatalogSourceNativeChangesSchema,
	readCatalogSourceApplication,
	type CatalogSourceNativeChange,
} from "./source-applications";
import type { CatalogSourceNativeWriter } from "./source-proposals";
import {
	openLibraryNames,
	openLibraryIdentifiers,
	openLibraryContributors,
} from "./openlibrary-plans";
import {
	prepareOpenLibraryArchive,
	resolveOpenLibraryReferences,
	openLibraryFactPlan,
	openLibraryRelationPlan,
	openLibraryChildPlan,
	contributionPath,
	type OpenLibraryArchive,
	type OpenLibraryObservedDocument,
} from "./openlibrary-runtime";

function expectedTarget(record: OpenLibraryDocument) {
	return record.kind === "author"
		? { owner: "entity" as const, shape: "unresolved" }
		: { owner: "publishing" as const, shape: record.kind === "work" ? "work" : "publication" };
}
async function applySnapshot(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	revision: number,
	mappingKey: string,
	previous: { record: OpenLibraryDocument; document: OpenLibraryObservedDocument } | null,
	incoming: { record: OpenLibraryDocument; document: OpenLibraryObservedDocument },
	mode: "intake" | "prepared",
) {
	const targets = await resolveOpenLibraryReferences(
		tx,
		actor,
		incoming.document,
		incoming.record,
		mode,
	);
	const names = openLibraryNames(incoming.record),
		identifiers = openLibraryIdentifiers(incoming.record),
		facts = await openLibraryFactPlan(tx, incoming.record),
		children = await openLibraryChildPlan(
			tx,
			incoming.document.record.id,
			incoming.record,
			targets,
		),
		contributors = openLibraryContributors(incoming.record);
	if (
		names.length + identifiers.length + facts.length + children.length + contributors.length >
		120
	)
		throw new RangeError("OpenLibrary record requires staged native application");
	const previousChildren =
		previous && reference.owner === "publishing"
			? await readChildSourceOccurrences(
					tx,
					reference,
					actor,
					previous.document.record.id,
					previous.document.snapshot.id,
				)
			: [];
	const previousFacts = previous ? await openLibraryFactPlan(tx, previous.record) : [];
	const previousRelations: CatalogSourceRelationDescriptor[] = [];
	if (previous)
		for (const contributor of openLibraryContributors(previous.record)) {
			const value = await readCatalogSourceRelationDescriptor(tx, reference, actor, {
				sourceRecordId: previous.document.record.id,
				snapshotId: previous.document.snapshot.id,
				identity: contributor.identity,
				path: contributionPath(contributor),
			});
			if (!value)
				throw new TypeError("OpenLibrary contributor lacks its exact previous native occurrence");
			previousRelations.push(value);
		}
	const changes: CatalogSourceNativeChange[] = [];
	if (incoming.record.kind !== "author") {
		const sourceValue = PublishingStructureSchema.parse(
			incoming.record.kind === "work"
				? { shape: "work", fields: {} }
				: {
						shape: "publication",
						fields: {
							pageCount: incoming.record.record.number_of_pages ?? null,
							paginationText: incoming.record.record.pagination ?? null,
						},
					},
		);
		const written = await writeCatalogStructureSource(tx, reference, actor, revision, {
			sourceRecordId: incoming.document.record.id,
			previousSnapshotId: previous?.document.snapshot.id ?? null,
			snapshotId: incoming.document.snapshot.id,
			sourcePath: "/",
			sourceValue,
			observedFields: incoming.record.kind === "work" ? [] : ["pageCount", "paginationText"],
		});
		revision = written.revision;
		changes.push(...written.changes);
	}
	const named = await applyCatalogSourceNameDelta(
		tx,
		reference,
		actor,
		revision,
		{
			sourceRecordId: incoming.document.record.id,
			mappingKey,
			previousSnapshotId: previous?.document.snapshot.id ?? null,
			snapshotId: incoming.document.snapshot.id,
		},
		{ namespace: "openlibrary.names.2", names },
	);
	revision = named.revision;
	changes.push(...named.changes);
	const identified = await applyCatalogSourceIdentifierDelta(
		tx,
		reference,
		actor,
		revision,
		{
			sourceRecordId: incoming.document.record.id,
			mappingKey,
			previousSnapshotId: previous?.document.snapshot.id ?? incoming.document.snapshot.id,
			snapshotId: incoming.document.snapshot.id,
		},
		previous ? openLibraryIdentifiers(previous.record) : [],
		identifiers,
	);
	revision = identified.revision;
	changes.push(...identified.changes);
	const values = await applyCatalogSourceFactDelta(
		tx,
		reference,
		actor,
		revision,
		incoming.document,
		previous
			? { snapshotId: previous.document.snapshot.id, mappingKey, descriptors: previousFacts }
			: null,
		facts,
	);
	revision = values.revision;
	changes.push(...values.changes);
	const relations = await openLibraryRelationPlan(
		tx,
		reference,
		incoming.record,
		targets,
		values.facts,
	);
	const linked = await applyCatalogSourceRelationDelta(
		tx,
		reference,
		actor,
		revision,
		incoming.document,
		previous
			? { snapshotId: previous.document.snapshot.id, mappingKey, descriptors: previousRelations }
			: null,
		relations,
	);
	revision = linked.revision;
	changes.push(...linked.changes);
	const incomingKeys = new Set(
		children.map((child) => `${ChildSourceComponents[child.value.kind]}/${child.key}`),
	);
	for (const prior of previousChildren)
		if (!incomingKeys.has(`${prior.component}/${prior.componentKey}`)) {
			const removed = await writeCatalogChildSource(tx, reference, actor, revision, {
				sourceRecordId: incoming.document.record.id,
				previousSnapshotId: previous?.document.snapshot.id ?? null,
				snapshotId: incoming.document.snapshot.id,
				sourcePath: prior.sourcePath,
				component: prior.component,
				componentKey: prior.componentKey,
				sourceValue: null,
				observedFields: [],
			});
			revision = removed.revision;
			changes.push(...removed.changes);
		}
	for (const child of children) {
		const written = await writeCatalogChildSource(tx, reference, actor, revision, {
			sourceRecordId: incoming.document.record.id,
			previousSnapshotId: previous?.document.snapshot.id ?? null,
			snapshotId: incoming.document.snapshot.id,
			sourcePath: child.path,
			component: ChildSourceComponents[child.value.kind],
			componentKey: child.key,
			sourceValue: child.value,
			observedFields: child.observedFields,
		});
		revision = written.revision;
		changes.push(...written.changes);
	}
	return { revision, changes: CatalogSourceNativeChangesSchema.parse(changes) };
}
/** @alpha @remarks Own snapshots initialize real native structures; foreign references have separate pristine baselines and never invent text versions. */
export async function adoptOpenLibraryRecord(
	tx: DatabaseTransaction,
	actor: string,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
) {
	const record = prepareOpenLibraryArchive({ receipt, bytes });
	return runParticipationSavepoint(tx, async (write) => {
		const document = await recordCatalogSourceDocument(write, receipt, bytes),
			existing = await inspectExistingSourceBinding(
				write,
				actor,
				document,
				OpenLibraryMappingVersion,
			);
		if (existing && existing.status !== "initialize_reference") return existing;
		const target = expectedTarget(record);
		const created = existing
			? existing.reference
			: await createCatalogIdentity(write, target, actor);
		const reference: CatalogReference = { owner: created.owner, id: created.id };
		const identity = await loadCatalogIdentity(write, reference, actor, true);
		if (
			reference.owner !== target.owner ||
			(target.owner === "publishing" && identity.shape !== target.shape)
		)
			throw new TypeError("OpenLibrary record requires a reviewed native grain");
		let revision = identity.revision;
		if (!existing)
			revision = (
				record.kind === "author"
					? await initializeEntityProfile(write, reference, actor, revision, {})
					: await updatePublishingStructure(
							write,
							reference,
							actor,
							revision,
							record.kind === "work"
								? { shape: "work", fields: {} }
								: { shape: "publication", fields: {} },
						)
			).revision;
		const scope = await prepareCatalogSourceChildCorrespondence(write, actor, {
			sourceRecordId: document.record.id,
			snapshotId: document.snapshot.id,
			reference,
			mappingVersion: OpenLibraryMappingVersion,
		});
		revision = (
			await applySnapshot(
				write,
				reference,
				actor,
				revision,
				scope.mappingKey,
				null,
				{ record, document },
				"intake",
			)
		).revision;
		if (existing)
			await acceptCatalogSourceInitialization(write, actor, {
				sourceRecordId: document.record.id,
				path: "/",
				snapshotId: document.snapshot.id,
				mappingVersion: OpenLibraryMappingVersion,
				reference,
				expectedBaselineRevision: existing.revision,
				finalRevision: revision,
			});
		else
			await sealCatalogSourceChildCorrespondence(write, actor, {
				sourceRecordId: document.record.id,
				path: "/",
				snapshotId: document.snapshot.id,
				mappingVersion: OpenLibraryMappingVersion,
				reference,
			});
		return { status: "created" as const, reference, revision, snapshotId: document.snapshot.id };
	});
}
/** @alpha @remarks Reviewed refresh/withdrawal performs real exact native writes, with archived bytes, immutable source epochs and no foreign-target writes. */
export function createOpenLibraryNativeWriter(input: {
	before: OpenLibraryArchive | null;
	after: OpenLibraryArchive;
}): CatalogSourceNativeWriter {
	const before = input.before
			? { ...input.before, record: prepareOpenLibraryArchive(input.before) }
			: null,
		after = { ...input.after, record: prepareOpenLibraryArchive(input.after) };
	if (
		before &&
		(before.record.kind !== after.record.kind ||
			before.record.record.key !== after.record.record.key)
	)
		throw new TypeError("OpenLibrary update crosses source identities or bibliographic grain");
	return async (outer, context) =>
		runParticipationSavepoint(outer, async (tx) => {
			const target = expectedTarget(after.record);
			if (
				context.mappingVersion !== OpenLibraryMappingVersion ||
				context.reference.owner !== target.owner ||
				after.receipt.contractSha256 !== OpenLibraryContractSha256
			)
				throw new TypeError("OpenLibrary callback differs from its reviewed source proposal");
			const native = await loadCatalogIdentity(tx, context.reference, context.actor, true);
			if (target.owner === "publishing" && native.shape !== target.shape)
				throw new TypeError("OpenLibrary native subtype changed without reviewed reclassification");
			const document = await loadCatalogSourceDocument(
				tx,
				context.sourceRecordId,
				context.snapshotId,
				after.receipt,
				after.bytes,
			);
			let revision = context.expectedRevision;
			const changes: CatalogSourceNativeChange[] = [];
			if (context.action === "withdraw") {
				const application = await readCatalogSourceApplication(tx, context.actor, {
					sourceRecordId: context.sourceRecordId,
					proposalId: context.proposalId,
					action: "apply",
				});
				if (!application || Boolean(application.application.previousSnapshotId) !== Boolean(before))
					throw new TypeError("OpenLibrary withdrawal lacks its original archive baseline");
				if (before && application.application.previousSnapshotId)
					await loadCatalogSourceDocument(
						tx,
						context.sourceRecordId,
						application.application.previousSnapshotId,
						before.receipt,
						before.bytes,
					);
				for (const change of [...application.changes].reverse()) {
					if (
						!("owner" in change) ||
						change.owner !== context.reference.owner ||
						change.ownerId !== context.reference.id
					)
						throw new TypeError("OpenLibrary withdrawal cannot mutate a foreign native target");
					if (change.kind === "catalog-structure")
						changes.push(await compensateCatalogStructureSource(tx, context.actor, change));
					else if (change.kind === "catalog-child")
						changes.push(await compensateCatalogChildSource(tx, context.actor, change));
					else if (
						change.kind === "catalog-name" ||
						change.kind === "catalog-name-authority" ||
						change.kind === "catalog-identifier" ||
						change.kind === "catalog-semantic"
					)
						changes.push(await compensateCatalogSourceOwnedChange(tx, context.actor, change));
					else
						throw new TypeError("OpenLibrary application contains another native component family");
				}
				revision = (await loadCatalogIdentity(tx, context.reference, context.actor, true)).revision;
			} else {
				if (Boolean(context.previousSnapshotId) !== Boolean(before))
					throw new CatalogRevisionConflict(
						"OpenLibrary source baseline changed after preparation",
					);
				const previous =
					before && context.previousSnapshotId
						? {
								record: before.record,
								document: await loadCatalogSourceDocument(
									tx,
									context.sourceRecordId,
									context.previousSnapshotId,
									before.receipt,
									before.bytes,
								),
							}
						: null;
				const result = await applySnapshot(
					tx,
					context.reference,
					context.actor,
					revision,
					context.mappingKey,
					previous,
					{ record: after.record, document },
					"prepared",
				);
				revision = result.revision;
				changes.push(...result.changes);
			}
			revision = await recordCatalogChange(
				tx,
				context.reference,
				context.actor,
				revision,
				`source.openlibrary.${after.record.kind}.${context.action}`,
			);
			return { revision, changes: CatalogSourceNativeChangesSchema.parse(changes) };
		});
}
