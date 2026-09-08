import { isDeepStrictEqual } from "node:util";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { runParticipationSavepoint } from "../participation/policy";
import { CatalogStructureSourceTables } from "../database/schema/catalog-structure-source";
import { CatalogStructureHistoryTables } from "../database/schema/catalog-structure-history";
import {
	catalogSourceBindingRevision,
	catalogSourceAdoptionProposal,
} from "../database/schema/catalog-source";
import { catalogSourceApplication } from "../database/schema/catalog-source-application";
import { catalogSourceApplicationScopes } from "./source-application-scopes";
import type { CatalogReference } from "./contracts";
import { resolveCatalogSourceChildCorrespondence } from "./source-child-correspondence";
import { CatalogRevisionConflict, loadCatalogIdentity } from "./storage";
import { ProgramStructureSchema, updateProgramStructure } from "./program";
import { PublishingStructureSchema, updatePublishingStructure } from "./publishing";
import {
	programStructureRevisionValue,
	publishingStructureRevisionValue,
	readStructureComponentHead,
	restoreStructureComponent,
} from "./structure-history";
import {
	prepareStructureSourceProjection,
	structureSourceComponent,
	StructureSourceOwnerSchema,
	type StructureSourceOwner,
	type StructureSourceProjection,
	type CatalogStructureSourceChange,
} from "./structure-source-contracts";

const evidenceSchema = z.strictObject({
	sourceRecordId: z.uuid(),
	snapshotId: z.uuid(),
	sourcePath: z.string().startsWith("/").max(512),
	historyId: z.uuid(),
});
function nativeValue(
	owner: StructureSourceOwner,
	component: string,
	value: Record<string, unknown>,
) {
	return owner === "program"
		? programStructureRevisionValue(component, value)
		: publishingStructureRevisionValue(component, value);
}

/** @internal Three-way observed-field merge preserves independent native fields and detects source/local conflicts. */
export function mergeStructureSourceProjection(
	owner: StructureSourceOwner,
	before: StructureSourceProjection | null,
	after: StructureSourceProjection,
	currentInput: unknown,
) {
	before = before
		? prepareStructureSourceProjection(owner, before.value, before.observedFields)
		: null;
	after = prepareStructureSourceProjection(owner, after.value, after.observedFields);
	const current =
		owner === "program"
			? ProgramStructureSchema.parse(currentInput)
			: PublishingStructureSchema.parse(currentInput);
	if (current.shape !== after.value.shape || (before && before.value.shape !== current.shape))
		throw new TypeError("Structure source projection changes native shape");
	if (before?.observedFields.some((key) => !after.observedFields.includes(key)))
		throw new TypeError(
			"Narrower structure observation requires an explicit combined source projection",
		);
	const old = z
		.record(z.string(), z.unknown())
		.parse((before ?? prepareStructureSourceProjection(owner, after.value, [])).value.fields);
	const desired = z.record(z.string(), z.unknown()).parse(after.value.fields);
	const fields: Record<string, unknown> = { ...current.fields };
	for (const key of after.observedFields) {
		if (isDeepStrictEqual(old[key], desired[key])) continue;
		if (!isDeepStrictEqual(fields[key], old[key]) && !isDeepStrictEqual(fields[key], desired[key]))
			throw new CatalogRevisionConflict(`Structure source conflicts with native ${key}`);
		fields[key] = desired[key];
	}
	return owner === "program"
		? ProgramStructureSchema.parse({ shape: current.shape, fields })
		: PublishingStructureSchema.parse({ shape: current.shape, fields });
}

/** @internal One immutable source interpretation is independent of native human overrides. */
export async function bindStructureSourceOccurrence(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	input: z.input<typeof evidenceSchema> & { sourceValue: unknown; observedFields: unknown },
) {
	const owner = StructureSourceOwnerSchema.parse(reference.owner);
	const evidence = evidenceSchema.parse({
		sourceRecordId: input.sourceRecordId,
		snapshotId: input.snapshotId,
		sourcePath: input.sourcePath,
		historyId: input.historyId,
	});
	const projection = prepareStructureSourceProjection(
		owner,
		input.sourceValue,
		input.observedFields,
	);
	const component = structureSourceComponent(owner, projection.value);
	await loadCatalogIdentity(tx, reference, actor, true);
	const scope = await resolveCatalogSourceChildCorrespondence(tx, evidence.sourceRecordId);
	const [root] = await tx
		.select({ owner: catalogSourceBindingRevision.owner })
		.from(catalogSourceBindingRevision)
		.where(
			and(
				eq(catalogSourceBindingRevision.sourceRecordId, evidence.sourceRecordId),
				eq(catalogSourceBindingRevision.mappingKey, scope.mappingKey),
				eq(catalogSourceBindingRevision.revision, scope.correspondenceRevision),
			),
		)
		.limit(1);
	if (!root) throw new TypeError("Structure source root epoch is missing");
	const history = CatalogStructureHistoryTables[owner].history;
	const [native] = await tx
		.select()
		.from(history)
		.where(
			and(
				eq(history.ownerId, reference.id),
				eq(history.id, evidence.historyId),
				eq(history.component, component),
				eq(history.componentKey, reference.id),
			),
		)
		.limit(1);
	if (!native || native.operation === "DELETE")
		throw new TypeError("Structure source history differs from its native component");
	const table = CatalogStructureSourceTables[owner].occurrence;
	await tx
		.insert(table)
		.values({
			...evidence,
			...scope,
			mappingOwner: root.owner,
			ownerId: reference.id,
			component,
			componentKey: reference.id,
			sourceValue: projection.value,
			observedFields: projection.observedFields,
		})
		.onConflictDoNothing();
	const [existing] = await tx
		.select()
		.from(table)
		.where(
			and(
				eq(table.sourceRecordId, evidence.sourceRecordId),
				eq(table.mappingKey, scope.mappingKey),
				eq(table.correspondenceRevision, scope.correspondenceRevision),
				eq(table.snapshotId, evidence.snapshotId),
				eq(table.ownerId, reference.id),
				eq(table.component, component),
				eq(table.componentKey, reference.id),
			),
		)
		.limit(1);
	if (
		!existing ||
		existing.sourcePath !== evidence.sourcePath ||
		!isDeepStrictEqual(existing.sourceValue, projection.value) ||
		!isDeepStrictEqual(existing.observedFields, projection.observedFields)
	)
		throw new CatalogRevisionConflict(
			"Source structure snapshot already has another immutable interpretation",
		);
	return existing;
}

/** @internal Updates an initialized native structure with exact child history, retaining pure source fields separately. */
export async function writeCatalogStructureSource(
	databaseTx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: {
		sourceRecordId: string;
		snapshotId: string;
		previousSnapshotId: string | null;
		sourcePath: string;
		sourceValue: unknown;
		observedFields: unknown;
	},
) {
	return runParticipationSavepoint(databaseTx, async (tx) => {
		z.uuid().parse(input.sourceRecordId);
		z.uuid().parse(input.snapshotId);
		z.uuid().nullable().parse(input.previousSnapshotId);
		z.string().startsWith("/").max(512).parse(input.sourcePath);
		const owner = StructureSourceOwnerSchema.parse(reference.owner);
		const value = prepareStructureSourceProjection(owner, input.sourceValue, input.observedFields);
		const component = structureSourceComponent(owner, value.value);
		const identity = await loadCatalogIdentity(tx, reference, actor, true);
		if (identity.revision !== expectedRevision)
			throw new CatalogRevisionConflict("Native structure owner revision changed");
		const head = await readStructureComponentHead(tx, reference, component, reference.id);
		if (!head || head.operation === "DELETE")
			throw new TypeError("Native structure must be initialized before applying source fields");
		const scope = await resolveCatalogSourceChildCorrespondence(tx, input.sourceRecordId);
		const table = CatalogStructureSourceTables[owner].occurrence;
		const [prior] =
			input.previousSnapshotId === null
				? []
				: await tx
						.select()
						.from(table)
						.where(
							and(
								eq(table.sourceRecordId, input.sourceRecordId),
								eq(table.mappingKey, scope.mappingKey),
								eq(table.correspondenceRevision, scope.correspondenceRevision),
								eq(table.snapshotId, input.previousSnapshotId),
								eq(table.ownerId, reference.id),
								eq(table.component, component),
								eq(table.componentKey, reference.id),
							),
						)
						.limit(1);
		if (input.previousSnapshotId !== null && !prior)
			throw new TypeError(
				"Previous structure source interpretation is missing from its exact epoch",
			);
		const before = prior
			? prepareStructureSourceProjection(owner, prior.sourceValue, prior.observedFields)
			: null;
		if (
			prior &&
			before &&
			(!isDeepStrictEqual(prior.sourceValue, before.value) ||
				!isDeepStrictEqual(prior.observedFields, before.observedFields))
		)
			throw new TypeError("Persisted structure source interpretation is not canonical");
		const current = nativeValue(owner, component, head.value);
		const desired = mergeStructureSourceProjection(owner, before, value, current);
		let revision = expectedRevision;
		const changes: CatalogStructureSourceChange[] = [];
		if (!isDeepStrictEqual(current, desired)) {
			const checked = await readStructureComponentHead(tx, reference, component, reference.id);
			if (checked?.id !== head.id)
				throw new CatalogRevisionConflict("Native structure child history changed");
			revision = (
				await (owner === "program"
					? updateProgramStructure(
							tx,
							reference,
							actor,
							revision,
							ProgramStructureSchema.parse(desired),
						)
					: updatePublishingStructure(
							tx,
							reference,
							actor,
							revision,
							PublishingStructureSchema.parse(desired),
						))
			).revision;
			const after = await readStructureComponentHead(tx, reference, component, reference.id);
			if (!after || after.componentSequence <= head.componentSequence)
				throw new Error("Native structure writer did not advance its component history");
			changes.push({
				kind: "catalog-structure",
				owner,
				ownerId: reference.id,
				component,
				componentKey: reference.id,
				beforeRevisionId: head.id,
				afterRevisionId: after.id,
			});
		}
		const currentHead = await readStructureComponentHead(tx, reference, component, reference.id);
		if (!currentHead) throw new Error("Native structure head disappeared");
		await bindStructureSourceOccurrence(tx, reference, actor, {
			sourceRecordId: input.sourceRecordId,
			snapshotId: input.snapshotId,
			sourcePath: input.sourcePath,
			historyId: currentHead.id,
			sourceValue: value.value,
			observedFields: value.observedFields,
		});
		return { revision, changes };
	});
}

/** @internal Exact compensation refuses any later edit to the same fixed native structure. */
export async function compensateCatalogStructureSource(
	tx: DatabaseTransaction,
	actor: string,
	change: CatalogStructureSourceChange,
): Promise<CatalogStructureSourceChange> {
	if (change.beforeRevisionId === null)
		throw new TypeError("Fixed structural identities require an initialized compensation baseline");
	const reference = { owner: change.owner, id: change.ownerId };
	const identity = await loadCatalogIdentity(tx, reference, actor, true);
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

/** @internal Finalize at most 128 exact component changes with batched source/history reads for both recorded epochs. */
export async function advanceStructureSourceBaselines(
	tx: DatabaseTransaction,
	input: { sourceRecordId: string; proposalId: string; action: "apply" | "withdraw" },
	changes: readonly CatalogStructureSourceChange[],
) {
	if (!changes.length) return;
	if (changes.length > 128) throw new RangeError("Structure source application requires staging");
	const [root] = await tx
		.select({ proposal: catalogSourceAdoptionProposal, scope: catalogSourceBindingRevision })
		.from(catalogSourceAdoptionProposal)
		.innerJoin(
			catalogSourceBindingRevision,
			and(
				eq(
					catalogSourceBindingRevision.sourceRecordId,
					catalogSourceAdoptionProposal.sourceRecordId,
				),
				eq(catalogSourceBindingRevision.mappingKey, catalogSourceAdoptionProposal.mappingKey),
				eq(
					catalogSourceBindingRevision.revision,
					catalogSourceAdoptionProposal.expectedBindingRevision,
				),
			),
		)
		.where(
			and(
				eq(catalogSourceAdoptionProposal.sourceRecordId, input.sourceRecordId),
				eq(catalogSourceAdoptionProposal.id, input.proposalId),
			),
		)
		.limit(1);
	const [applied] = await tx
		.select()
		.from(catalogSourceApplication)
		.where(
			and(
				eq(catalogSourceApplication.sourceRecordId, input.sourceRecordId),
				eq(catalogSourceApplication.proposalId, input.proposalId),
				eq(catalogSourceApplication.action, "apply"),
			),
		)
		.limit(1);
	if (!root || !applied)
		throw new TypeError("Structure source application lacks its exact interpretation header");
	const scopes = catalogSourceApplicationScopes(
		applied,
		{
			mappingKey: root.scope.mappingKey,
			correspondenceRevision: root.scope.correspondenceRevision,
			snapshotId: root.proposal.snapshotId,
		},
		input.action,
	);
	const key = (epoch: number, ownerId: string, component: string, componentKey: string) =>
		JSON.stringify([epoch, ownerId, component, componentKey]);
	for (const owner of ["program", "publishing"] as const) {
		const selected = changes.filter((change) => change.owner === owner);
		if (!selected.length) continue;
		const ownerIds = [...new Set(selected.map((change) => change.ownerId))];
		const { history, head } = CatalogStructureHistoryTables[owner];
		const currentRows = await tx
			.select({ history })
			.from(history)
			.innerJoin(head, and(eq(head.ownerId, history.ownerId), eq(head.historyId, history.id)))
			.where(
				and(
					inArray(history.ownerId, ownerIds),
					inArray(
						history.id,
						selected.map((change) => change.afterRevisionId),
					),
				),
			)
			.limit(129);
		if (currentRows.length > 128)
			throw new RangeError("Structure current history batch exceeds its journal");
		const current = new Map(currentRows.map((row) => [row.history.id, row.history]));
		const { occurrence, baseline } = CatalogStructureSourceTables[owner];
		const supports = new Map<string, typeof occurrence.$inferSelect>();
		for (const scope of scopes)
			for (const snapshotId of scope.snapshotIds) {
				const rows = await tx
					.select()
					.from(occurrence)
					.where(
						and(
							eq(occurrence.sourceRecordId, input.sourceRecordId),
							eq(occurrence.mappingKey, scope.mappingKey),
							eq(occurrence.correspondenceRevision, scope.correspondenceRevision),
							eq(occurrence.snapshotId, snapshotId),
							inArray(occurrence.ownerId, ownerIds),
						),
					)
					.limit(129);
				if (rows.length > 128)
					throw new RangeError("Structure source snapshot requires staged application");
				for (const row of rows)
					supports.set(
						`${snapshotId}/${key(scope.correspondenceRevision, row.ownerId, row.component, row.componentKey)}`,
						row,
					);
			}
		const previousRows = await tx
			.select()
			.from(baseline)
			.where(
				and(
					eq(baseline.sourceRecordId, input.sourceRecordId),
					eq(baseline.mappingKey, root.scope.mappingKey),
					inArray(
						baseline.correspondenceRevision,
						scopes.map((scope) => scope.correspondenceRevision),
					),
					inArray(baseline.ownerId, ownerIds),
				),
			)
			.limit(257);
		if (previousRows.length > 256)
			throw new RangeError("Structure baseline batch requires staged application");
		const previous = new Map(
			previousRows.map((row) => [
				key(row.correspondenceRevision, row.ownerId, row.component, row.componentKey),
				row,
			]),
		);
		const next: (typeof baseline.$inferInsert)[] = [];
		for (const change of selected) {
			const native = current.get(change.afterRevisionId);
			if (
				!native ||
				native.ownerId !== change.ownerId ||
				native.component !== change.component ||
				native.componentKey !== change.componentKey
			)
				throw new TypeError(
					"Structure application does not reference its current exact native component",
				);
			let matched = false;
			for (const scope of scopes) {
				const componentKey = key(
					scope.correspondenceRevision,
					change.ownerId,
					change.component,
					change.componentKey,
				);
				const observed = scope.desiredSnapshotId
					? supports.get(`${scope.desiredSnapshotId}/${componentKey}`)
					: undefined;
				const source =
					observed ??
					scope.snapshotIds
						.map((snapshotId) => supports.get(`${snapshotId}/${componentKey}`))
						.find((row) => row !== undefined);
				const prior = previous.get(componentKey);
				const proof = source
					? {
							mappingOwner: source.mappingOwner,
							snapshotId: source.snapshotId,
							sourcePath: source.sourcePath,
							historyId: source.historyId,
						}
					: prior
						? {
								mappingOwner: prior.mappingOwner,
								snapshotId: prior.snapshotId,
								sourcePath: prior.sourcePath,
								historyId: prior.sourceHistoryId,
							}
						: null;
				if (!proof) continue;
				matched = true;
				next.push({
					sourceRecordId: input.sourceRecordId,
					mappingKey: scope.mappingKey,
					correspondenceRevision: scope.correspondenceRevision,
					mappingOwner: proof.mappingOwner,
					ownerId: change.ownerId,
					component: change.component,
					componentKey: change.componentKey,
					snapshotId: proof.snapshotId,
					sourcePath: proof.sourcePath,
					sourceHistoryId: proof.historyId,
					currentHistoryId: native.id,
					absent: !observed || native.operation === "DELETE",
					proposalId: input.proposalId,
					action: input.action,
				});
			}
			if (!matched)
				throw new TypeError(
					"Structure change has no exact source occurrence in its recorded epochs",
				);
		}
		if (next.length)
			await tx
				.insert(baseline)
				.values(next)
				.onConflictDoUpdate({
					target: [
						baseline.sourceRecordId,
						baseline.mappingKey,
						baseline.correspondenceRevision,
						baseline.ownerId,
						baseline.component,
						baseline.componentKey,
					],
					set: {
						snapshotId: sql`excluded.snapshot_id`,
						sourcePath: sql`excluded.source_path`,
						sourceHistoryId: sql`excluded.source_history_id`,
						currentHistoryId: sql`excluded.current_history_id`,
						absent: sql`excluded.absent`,
						proposalId: sql`excluded.proposal_id`,
						action: sql`excluded.action`,
					},
				});
	}
}
