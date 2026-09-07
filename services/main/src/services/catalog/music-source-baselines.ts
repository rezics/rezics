import { catalogSourceApplicationScopes } from "./source-application-scopes";
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
	const [appliedHeader] = await tx
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
	if (!appliedHeader) throw new Error("Music baseline requires its immutable apply header");
	const scopes = catalogSourceApplicationScopes(
		appliedHeader,
		{ ...scope, snapshotId: proposal.snapshotId },
		input.action,
	);
	for (const change of native) {
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
		let matched = false;
		for (const interpretation of scopes) {
			const occurrence = musicComponentSourceOccurrence;
			const find = async (snapshotId: string) => {
				const rows = await tx
					.select()
					.from(occurrence)
					.where(
						and(
							eq(occurrence.sourceRecordId, input.sourceRecordId),
							eq(occurrence.mappingKey, interpretation.mappingKey),
							eq(occurrence.correspondenceRevision, interpretation.correspondenceRevision),
							eq(occurrence.snapshotId, snapshotId),
							eq(occurrence.ownerId, change.ownerId),
							eq(occurrence.component, change.component),
							eq(occurrence.componentKey, change.componentKey),
						),
					)
					.limit(2);
				if (rows.length > 1) throw new Error("Ambiguous original music source component support");
				return rows[0];
			};
			const observed = interpretation.desiredSnapshotId
				? await find(interpretation.desiredSnapshotId)
				: undefined;
			let support: { snapshotId: string; sourcePath: string; historyId: string } | undefined =
				observed;
			for (const snapshotId of interpretation.snapshotIds) {
				if (support) break;
				support = await find(snapshotId);
			}
			const table = musicComponentSourceBaseline;
			const key = and(
				eq(table.sourceRecordId, input.sourceRecordId),
				eq(table.mappingKey, interpretation.mappingKey),
				eq(table.correspondenceRevision, interpretation.correspondenceRevision),
				eq(table.ownerId, change.ownerId),
				eq(table.component, change.component),
				eq(table.componentKey, change.componentKey),
			);
			const [previous] = await tx.select().from(table).where(key).limit(1).for("update");
			if (!support && previous)
				support = {
					snapshotId: previous.snapshotId,
					sourcePath: previous.sourcePath,
					historyId: previous.sourceHistoryId,
				};
			if (!support) continue;
			matched = true;
			const values = {
				sourceRecordId: input.sourceRecordId,
				mappingKey: interpretation.mappingKey,
				correspondenceRevision: interpretation.correspondenceRevision,
				mappingOwner: proposal.mappingOwner,
				ownerId: change.ownerId,
				component: change.component,
				componentKey: change.componentKey,
				snapshotId: support.snapshotId,
				sourcePath: support.sourcePath,
				sourceHistoryId: support.historyId,
				currentHistoryId: head.id,
				absent: !observed || head.operation === "DELETE",
				proposalId: input.proposalId,
				action: input.action,
			};
			await tx
				.insert(table)
				.values(values)
				.onConflictDoUpdate({
					target: [
						table.sourceRecordId,
						table.mappingKey,
						table.correspondenceRevision,
						table.ownerId,
						table.component,
						table.componentKey,
					],
					set: values,
				});
		}
		if (!matched)
			throw new Error("Music change lacks exact support in either recorded interpretation");
	}
}
