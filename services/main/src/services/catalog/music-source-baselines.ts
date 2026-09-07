import { and, eq } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import {
	musicComponentRevision,
	musicComponentSourceOccurrence,
} from "../database/schema/catalog-music";
import { musicComponentSourceBaseline } from "../database/schema/catalog-music-source";
import {
	catalogSourceAdoptionProposal,
	catalogSourceBindingRevision,
} from "../database/schema/catalog-source";
import { resolveCatalogSourceChildCorrespondence } from "./source-child-correspondence";
import { catalogSourceApplication } from "../database/schema/catalog-source-application";
import type { CatalogSourceNativeChange } from "./source-applications";

/** @internal Resolves only a journal-proved compensation frontier, never an equal spelling or equal row body. */
export async function resolveMusicSourceComponentBaseline(
	tx: DatabaseTransaction,
	input: {
		sourceRecordId: string;
		mappingKey: string;
		ownerId: string;
		component: string;
		componentKey: string;
		sourceHistoryId: string;
		correspondenceRevision?: number;
	},
) {
	const table = musicComponentSourceBaseline;
	const correspondenceRevision =
		input.correspondenceRevision ??
		(await resolveCatalogSourceChildCorrespondence(tx, input.sourceRecordId))
			.correspondenceRevision;
	const [baseline] = await tx
		.select()
		.from(table)
		.where(
			and(
				eq(table.sourceRecordId, input.sourceRecordId),
				eq(table.mappingKey, input.mappingKey),
				eq(table.correspondenceRevision, correspondenceRevision),
				eq(table.ownerId, input.ownerId),
				eq(table.component, input.component),
				eq(table.componentKey, input.componentKey),
			),
		)
		.limit(1);
	if (!baseline || baseline.sourceHistoryId !== input.sourceHistoryId) return input.sourceHistoryId;
	return baseline.currentHistoryId;
}

/** @internal Called by the shared journal owner after inserting exact changes, in the same transaction. */
export async function advanceMusicSourceComponentBaselines(
	tx: DatabaseTransaction,
	input: {
		sourceRecordId: string;
		proposalId: string;
		action: "apply" | "withdraw";
		previousSnapshotId: string | null;
	},
	changes: readonly CatalogSourceNativeChange[],
) {
	const native = changes.filter((change) => change.kind === "music-component");
	if (!native.length) return;
	const [proposal] = await tx
		.select()
		.from(catalogSourceAdoptionProposal)
		.where(
			and(
				eq(catalogSourceAdoptionProposal.sourceRecordId, input.sourceRecordId),
				eq(catalogSourceAdoptionProposal.id, input.proposalId),
			),
		)
		.limit(1);
	if (!proposal) throw new Error("Music source baseline proposal is missing");
	const [scope] = await tx
		.select({
			mappingKey: catalogSourceBindingRevision.mappingKey,
			correspondenceRevision: catalogSourceBindingRevision.correspondenceRevision,
		})
		.from(catalogSourceBindingRevision)
		.where(
			and(
				eq(catalogSourceBindingRevision.sourceRecordId, input.sourceRecordId),
				eq(catalogSourceBindingRevision.mappingKey, proposal.mappingKey),
				eq(catalogSourceBindingRevision.revision, proposal.expectedBindingRevision),
			),
		)
		.limit(1);
	if (!scope) throw new Error("Music source baseline proposal has no exact correspondence epoch");
	let sourceSnapshotId = proposal.snapshotId;
	if (input.action === "withdraw") {
		const [application] = await tx
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
		if (!application) throw new Error("Music source baseline application is missing");
		sourceSnapshotId = application.previousSnapshotId ?? proposal.snapshotId;
	}
	for (const change of native) {
		const occurrence = musicComponentSourceOccurrence;
		const candidates = await tx
			.select()
			.from(occurrence)
			.where(
				and(
					eq(occurrence.sourceRecordId, input.sourceRecordId),
					eq(occurrence.mappingKey, scope.mappingKey),
					eq(occurrence.correspondenceRevision, scope.correspondenceRevision),
					eq(occurrence.snapshotId, sourceSnapshotId),
					eq(occurrence.ownerId, change.ownerId),
					eq(occurrence.component, change.component),
					eq(occurrence.componentKey, change.componentKey),
				),
			)
			.limit(2);
		const table = musicComponentSourceBaseline;
		const key = and(
			eq(table.sourceRecordId, input.sourceRecordId),
			eq(table.mappingKey, proposal.mappingKey),
			eq(table.correspondenceRevision, scope.correspondenceRevision),
			eq(table.ownerId, change.ownerId),
			eq(table.component, change.component),
			eq(table.componentKey, change.componentKey),
		);
		const [previous] = await tx.select().from(table).where(key).limit(1);
		let support = candidates[0];
		if (candidates.length > 1) throw new Error("Ambiguous original music source component support");
		if (!support) {
			const fallbackSnapshot =
				previous?.snapshotId ?? input.previousSnapshotId ?? proposal.snapshotId;
			const fallback = await tx
				.select()
				.from(occurrence)
				.where(
					and(
						eq(occurrence.sourceRecordId, input.sourceRecordId),
						eq(occurrence.mappingKey, scope.mappingKey),
						eq(occurrence.correspondenceRevision, scope.correspondenceRevision),
						eq(occurrence.snapshotId, fallbackSnapshot),
						eq(occurrence.ownerId, change.ownerId),
						eq(occurrence.component, change.component),
						eq(occurrence.componentKey, change.componentKey),
					),
				)
				.limit(2);
			if (fallback.length !== 1)
				throw new Error("Removed music component lacks exact source support");
			support = fallback[0];
		}
		if (!support) throw new Error("Music source component support is missing");
		const [head] = await tx
			.select()
			.from(musicComponentRevision)
			.where(
				and(
					eq(musicComponentRevision.ownerId, change.ownerId),
					eq(musicComponentRevision.id, change.afterRevisionId),
				),
			)
			.limit(1);
		if (!head) throw new Error("Music source current history is missing");
		await tx
			.insert(table)
			.values({
				sourceRecordId: input.sourceRecordId,
				mappingKey: proposal.mappingKey,
				correspondenceRevision: scope.correspondenceRevision,
				ownerId: change.ownerId,
				component: change.component,
				componentKey: change.componentKey,
				snapshotId: support.snapshotId,
				sourcePath: support.sourcePath,
				sourceHistoryId: support.historyId,
				currentHistoryId: head.id,
				absent: head.operation === "DELETE",
				proposalId: input.proposalId,
				action: input.action,
			})
			.onConflictDoUpdate({
				target: [
					table.sourceRecordId,
					table.mappingKey,
					table.correspondenceRevision,
					table.ownerId,
					table.component,
					table.componentKey,
				],
				set: {
					snapshotId: support.snapshotId,
					sourcePath: support.sourcePath,
					sourceHistoryId: support.historyId,
					currentHistoryId: head.id,
					absent: head.operation === "DELETE",
					proposalId: input.proposalId,
					action: input.action,
				},
			});
	}
}
