import { and, eq, inArray, sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import { CatalogChildSourceTables } from "../database/schema/catalog-child-source";
import { CatalogStructureHistoryTables } from "../database/schema/catalog-structure-history";
import {
	catalogSourceAdoptionProposal,
	catalogSourceBindingRevision,
} from "../database/schema/catalog-source";
import { catalogSourceApplication } from "../database/schema/catalog-source-application";
import { catalogSourceApplicationScopes } from "./source-application-scopes";
import type { CatalogChildSourceChange } from "./child-source-contracts";
/** @internal Finalize at most 128 exact component changes with batched source/history reads for both recorded epochs. */
export async function advanceChildSourceBaselines(
	tx: DatabaseTransaction,
	input: { sourceRecordId: string; proposalId: string; action: "apply" | "withdraw" },
	changes: readonly CatalogChildSourceChange[],
) {
	if (!changes.length) return;
	if (changes.length > 128) throw new RangeError("Child source application requires staging");
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
		throw new TypeError("Child source application lacks its exact interpretation header");
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
			throw new RangeError("Child current history batch exceeds its journal");
		const current = new Map(currentRows.map((row) => [row.history.id, row.history]));
		const { occurrence, baseline } = CatalogChildSourceTables[owner];
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
					throw new RangeError("Child source snapshot requires staged application");
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
			throw new RangeError("Child baseline batch requires staged application");
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
					"Child application does not reference its current exact native component",
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
				throw new TypeError("Child change has no exact source occurrence in its recorded epochs");
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
