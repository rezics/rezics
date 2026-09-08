import { isDeepStrictEqual } from "node:util";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { runParticipationSavepoint } from "../participation/policy";
import { CatalogChildSourceTables } from "../database/schema/catalog-child-source";
import { CatalogStructureHistoryTables } from "../database/schema/catalog-structure-history";
import { catalogSourceBindingRevision } from "../database/schema/catalog-source";
import type { CatalogReference } from "./contracts";
import { loadCatalogIdentity, CatalogRevisionConflict } from "./storage";
import { resolveCatalogSourceChildCorrespondence } from "./source-child-correspondence";
import { readStructureComponentHead, restoreStructureComponent } from "./structure-history";
import {
	putPublishingComponent,
	removePublishingComponent,
	publishingComponentRevisionValue,
} from "./publishing-components";
import { putProgramOccurrence, removeProgramOccurrence } from "./program";
import {
	ChildSourceOwnerSchema,
	ChildSourceComponentSchema,
	ChildSourceComponents,
	NativeChildValueSchema,
	prepareChildSourceProjection,
	validateChildSourceProjection,
	mergeChildSourceProjection,
	type NativeChildValue,
	type ChildSourceComponent,
	type CatalogChildSourceChange,
} from "./child-source-contracts";

function currentValue(
	component: ChildSourceComponent,
	row: Record<string, unknown>,
): NativeChildValue {
	return component === "program_episode_occurrence"
		? NativeChildValueSchema.parse({
				kind: "episode_occurrence",
				episodeId: row.episode_id,
				position: row.position,
				sourceNumber: row.source_number,
			})
		: publishingComponentRevisionValue(component, row);
}
async function put(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	revision: number,
	key: string,
	value: NativeChildValue,
) {
	if (value.kind === "episode_occurrence")
		return putProgramOccurrence(tx, reference, actor, revision, {
			id: key,
			episodeId: value.episodeId,
			position: value.position,
			sourceNumber: value.sourceNumber,
		});
	return putPublishingComponent(tx, reference, actor, revision, key, value);
}
async function remove(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	revision: number,
	key: string,
	component: ChildSourceComponent,
) {
	if (component === "program_episode_occurrence")
		return removeProgramOccurrence(tx, reference, actor, revision, key);
	const kind =
		component === "publishing_text_work"
			? "text_work"
			: component === "publishing_publication_text"
				? "publication_text"
				: component === "publishing_publication_work"
					? "publication_work"
					: component === "publishing_publication_facet"
						? "facet"
						: component === "publishing_release_event"
							? "event"
							: "installment";
	return removePublishingComponent(tx, reference, actor, revision, kind, key);
}
/** @internal Immutable child evidence carries pure observed values independently of accepted human overrides. */
export async function bindChildSourceOccurrence(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	input: {
		sourceRecordId: string;
		snapshotId: string;
		sourcePath: string;
		componentKey: string;
		historyId: string;
		sourceValue: unknown;
		observedFields: unknown;
	},
) {
	const owner = ChildSourceOwnerSchema.parse(reference.owner),
		projection = prepareChildSourceProjection(owner, input.sourceValue, input.observedFields),
		component = ChildSourceComponents[projection.value.kind];
	z.uuid().parse(input.componentKey);
	z.uuid().parse(input.historyId);
	z.string().startsWith("/").max(512).parse(input.sourcePath);
	await loadCatalogIdentity(tx, reference, actor, true);
	const scope = await resolveCatalogSourceChildCorrespondence(tx, input.sourceRecordId),
		table = CatalogChildSourceTables[owner].occurrence;
	const [root] = await tx
		.select({ owner: catalogSourceBindingRevision.owner })
		.from(catalogSourceBindingRevision)
		.where(
			and(
				eq(catalogSourceBindingRevision.sourceRecordId, input.sourceRecordId),
				eq(catalogSourceBindingRevision.mappingKey, scope.mappingKey),
				eq(catalogSourceBindingRevision.revision, scope.correspondenceRevision),
			),
		)
		.limit(1);
	if (!root) throw new TypeError("Child source root epoch is absent");
	const history = CatalogStructureHistoryTables[owner].history;
	const [native] = await tx
		.select()
		.from(history)
		.where(
			and(
				eq(history.ownerId, reference.id),
				eq(history.id, input.historyId),
				eq(history.component, component),
				eq(history.componentKey, input.componentKey),
			),
		)
		.limit(1);
	if (!native || native.operation === "DELETE")
		throw new TypeError("Child source requires exact extant native history");
	await tx
		.insert(table)
		.values({
			...scope,
			mappingOwner: root.owner,
			sourceRecordId: input.sourceRecordId,
			snapshotId: input.snapshotId,
			sourcePath: input.sourcePath,
			ownerId: reference.id,
			component,
			componentKey: input.componentKey,
			historyId: input.historyId,
			sourceValue: projection.value,
			observedFields: projection.observedFields,
		})
		.onConflictDoNothing();
	const [existing] = await tx
		.select()
		.from(table)
		.where(
			and(
				eq(table.sourceRecordId, input.sourceRecordId),
				eq(table.mappingKey, scope.mappingKey),
				eq(table.correspondenceRevision, scope.correspondenceRevision),
				eq(table.snapshotId, input.snapshotId),
				eq(table.ownerId, reference.id),
				eq(table.component, component),
				eq(table.componentKey, input.componentKey),
			),
		)
		.limit(1);
	if (
		!existing ||
		existing.sourcePath !== input.sourcePath ||
		!isDeepStrictEqual(existing.sourceValue, projection.value) ||
		!isDeepStrictEqual(existing.observedFields, projection.observedFields)
	)
		throw new CatalogRevisionConflict(
			"Source child snapshot already has another immutable interpretation",
		);
	return existing;
}
/** @internal The prior source interpretation is read from root-owned archived evidence, without loading previous private targets. */
export async function readChildSourceOccurrences(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	sourceRecordId: string,
	snapshotId: string,
) {
	await loadCatalogIdentity(tx, reference, actor, true);
	const owner = ChildSourceOwnerSchema.parse(reference.owner),
		scope = await resolveCatalogSourceChildCorrespondence(tx, sourceRecordId),
		table = CatalogChildSourceTables[owner].occurrence;
	const rows = await tx
		.select()
		.from(table)
		.where(
			and(
				eq(table.sourceRecordId, sourceRecordId),
				eq(table.mappingKey, scope.mappingKey),
				eq(table.correspondenceRevision, scope.correspondenceRevision),
				eq(table.snapshotId, snapshotId),
				eq(table.ownerId, reference.id),
			),
		)
		.limit(129);
	if (rows.length > 128)
		throw new RangeError("Source child collection requires staged application");
	return rows.map((row) => ({
		...row,
		projection: validateChildSourceProjection(owner, row.sourceValue, row.observedFields),
	}));
}
/** @internal New source rows cannot take over an unrelated existing child; changed fields use a three-way merge. */
export async function writeCatalogChildSource(
	outer: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: {
		sourceRecordId: string;
		previousSnapshotId: string | null;
		snapshotId: string;
		sourcePath: string;
		component: ChildSourceComponent;
		componentKey: string;
		sourceValue: unknown | null;
		observedFields: unknown;
	},
) {
	return runParticipationSavepoint(outer, async (tx) => {
		const owner = ChildSourceOwnerSchema.parse(reference.owner),
			component = ChildSourceComponentSchema.parse(input.component),
			key = z.uuid().parse(input.componentKey);
		if (!component.startsWith(`${owner}_`))
			throw new TypeError("Source child owner and component differ");
		const identity = await loadCatalogIdentity(tx, reference, actor, true);
		if (identity.revision !== expectedRevision)
			throw new CatalogRevisionConflict("Publishing source owner revision changed");
		const scope = await resolveCatalogSourceChildCorrespondence(tx, input.sourceRecordId),
			{ occurrence, baseline } = CatalogChildSourceTables[owner];
		const [prior] =
			input.previousSnapshotId === null
				? []
				: await tx
						.select()
						.from(occurrence)
						.where(
							and(
								eq(occurrence.sourceRecordId, input.sourceRecordId),
								eq(occurrence.mappingKey, scope.mappingKey),
								eq(occurrence.correspondenceRevision, scope.correspondenceRevision),
								eq(occurrence.snapshotId, input.previousSnapshotId),
								eq(occurrence.ownerId, reference.id),
								eq(occurrence.component, component),
								eq(occurrence.componentKey, key),
							),
						)
						.limit(1);
		const [frontier] = await tx
			.select()
			.from(baseline)
			.where(
				and(
					eq(baseline.sourceRecordId, input.sourceRecordId),
					eq(baseline.mappingKey, scope.mappingKey),
					eq(baseline.correspondenceRevision, scope.correspondenceRevision),
					eq(baseline.ownerId, reference.id),
					eq(baseline.component, component),
					eq(baseline.componentKey, key),
				),
			)
			.limit(1);
		const head = await readStructureComponentHead(tx, reference, component, key),
			current = head && head.operation !== "DELETE" ? currentValue(component, head.value) : null;
		let revision = expectedRevision;
		const changes: CatalogChildSourceChange[] = [];
		if (input.sourceValue === null) {
			if (!prior) throw new TypeError("Removed source child has no previous immutable occurrence");
			const expected = frontier?.currentHistoryId ?? prior.historyId;
			if (!head || head.id !== expected)
				throw new CatalogRevisionConflict(
					"Source child removal conflicts with a later native edit",
				);
			if (current) {
				const pure = validateChildSourceProjection(owner, prior.sourceValue, prior.observedFields);
				const { kind: currentKind, ...currentFields } = current;
				if (currentKind !== pure.value.kind || !isDeepStrictEqual(currentFields, pure.value.fields))
					throw new CatalogRevisionConflict(
						"Source child removal would erase independent native fields",
					);
				revision = (await remove(tx, reference, actor, revision, key, component)).revision;
				const after = await readStructureComponentHead(tx, reference, component, key);
				if (!after || after.operation !== "DELETE")
					throw new Error("Source child removal did not publish its tombstone history");
				changes.push({
					kind: "catalog-child",
					owner,
					ownerId: reference.id,
					component,
					componentKey: key,
					beforeRevisionId: head.id,
					afterRevisionId: after.id,
				});
			}
			return { revision, changes };
		}
		const desired = prepareChildSourceProjection(owner, input.sourceValue, input.observedFields);
		if (ChildSourceComponents[desired.value.kind] !== component)
			throw new TypeError("Source child projection differs from its component");
		const before = prior
			? validateChildSourceProjection(owner, prior.sourceValue, prior.observedFields)
			: null;
		if (
			!prior &&
			head &&
			(head.operation !== "DELETE" || !frontier?.absent || frontier.currentHistoryId !== head.id)
		)
			throw new CatalogRevisionConflict(
				"Existing native child requires an explicit source correspondence",
			);
		const value = mergeChildSourceProjection(owner, before, desired, current);
		if (!isDeepStrictEqual(current, value)) {
			revision = (await put(tx, reference, actor, revision, key, value)).revision;
			const after = await readStructureComponentHead(tx, reference, component, key);
			if (!after || (head && after.componentSequence <= head.componentSequence))
				throw new Error("Source child writer did not advance history");
			changes.push({
				kind: "catalog-child",
				owner,
				ownerId: reference.id,
				component,
				componentKey: key,
				beforeRevisionId: head?.id ?? null,
				afterRevisionId: after.id,
			});
		}
		const final = await readStructureComponentHead(tx, reference, component, key);
		if (!final) throw new Error("Source child history disappeared");
		await bindChildSourceOccurrence(tx, reference, actor, {
			sourceRecordId: input.sourceRecordId,
			snapshotId: input.snapshotId,
			sourcePath: input.sourcePath,
			componentKey: key,
			historyId: final.id,
			sourceValue: input.sourceValue,
			observedFields: input.observedFields,
		});
		return { revision, changes };
	});
}
/** @internal Compensation restores exact prior state or removes an introduced child, refusing later same-child edits. */
export async function compensateCatalogChildSource(
	tx: DatabaseTransaction,
	actor: string,
	change: CatalogChildSourceChange,
): Promise<CatalogChildSourceChange> {
	const reference = { owner: change.owner, id: change.ownerId },
		identity = await loadCatalogIdentity(tx, reference, actor, true);
	const head = await readStructureComponentHead(
		tx,
		reference,
		change.component,
		change.componentKey,
	);
	if (!head || head.id !== change.afterRevisionId)
		throw new CatalogRevisionConflict("Source child changed after application");
	if (change.beforeRevisionId !== null) {
		const restored = await restoreStructureComponent(tx, reference, actor, identity.revision, {
			component: change.component,
			componentKey: change.componentKey,
			expectedHistoryId: change.afterRevisionId,
			historyId: change.beforeRevisionId,
		});
		return {
			...change,
			beforeRevisionId: restored.beforeHistoryId,
			afterRevisionId: restored.afterHistoryId,
		};
	}
	await remove(tx, reference, actor, identity.revision, change.componentKey, change.component);
	const after = await readStructureComponentHead(
		tx,
		reference,
		change.component,
		change.componentKey,
	);
	if (!after || after.operation !== "DELETE")
		throw new Error("Introduced source child did not publish compensation history");
	return { ...change, beforeRevisionId: head.id, afterRevisionId: after.id };
}
