import { catalogSourceApplicationScopes } from "./source-application-scopes";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import {
	musicComponentRevision,
	musicComponentSourceOccurrence,
} from "@rezics/schema/postgres/music/music";
import { musicComponentSourceBaseline } from "@rezics/schema/postgres/music/music-source";
import {
	catalogSourceAdoptionProposal,
	catalogSourceBindingRevision,
} from "@rezics/schema/postgres/ingestion/source";
import { resolveCatalogSourceChildCorrespondence } from "./source-child-correspondence";
import { catalogSourceApplication } from "@rezics/schema/postgres/ingestion/source-application";
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
	const keyOf = (row: { ownerId: string; component: string; componentKey: string }) => `${row.ownerId}:${row.component}:${row.componentKey}`;
	const matched = new Set<string>();
	for (let offset = 0; offset < native.length; offset += 128) {
		const page = native.slice(offset, offset + 128);
		const heads = await tx.select({ ownerId: musicComponentRevision.ownerId, id: musicComponentRevision.id, operation: musicComponentRevision.operation })
			.from(musicComponentRevision).where(or(...page.map((change) => and(eq(musicComponentRevision.ownerId, change.ownerId), eq(musicComponentRevision.id, change.afterRevisionId))))).limit(page.length);
		const headById = new Map(heads.map((head) => [`${head.ownerId}:${head.id}`, head]));
		for (const interpretation of scopes) {
			const occurrence = musicComponentSourceOccurrence, table = musicComponentSourceBaseline;
			const supports = await tx.select({ ownerId: occurrence.ownerId, component: occurrence.component, componentKey: occurrence.componentKey,
				snapshotId: occurrence.snapshotId, sourcePath: occurrence.sourcePath, historyId: occurrence.historyId }).from(occurrence)
				.where(and(eq(occurrence.sourceRecordId, input.sourceRecordId), eq(occurrence.mappingKey, interpretation.mappingKey), eq(occurrence.correspondenceRevision, interpretation.correspondenceRevision),
					inArray(occurrence.snapshotId, interpretation.snapshotIds), or(...page.map((change) => and(eq(occurrence.ownerId, change.ownerId), eq(occurrence.component, change.component), eq(occurrence.componentKey, change.componentKey))))))
				.limit(page.length * 2 + 1);
			if (supports.length > page.length * 2) throw new Error("Ambiguous original music source component support");
			const supportBySnapshot = new Map<string, (typeof supports)[number]>();
			for (const row of supports) {
				const key = `${keyOf(row)}:${row.snapshotId}`;
				if (supportBySnapshot.has(key)) throw new Error("Ambiguous original music source component support");
				supportBySnapshot.set(key, row);
			}
			const previous = await tx.select().from(table).where(and(eq(table.sourceRecordId, input.sourceRecordId), eq(table.mappingKey, interpretation.mappingKey), eq(table.correspondenceRevision, interpretation.correspondenceRevision),
				or(...page.map((change) => and(eq(table.ownerId, change.ownerId), eq(table.component, change.component), eq(table.componentKey, change.componentKey))))))
				.orderBy(table.ownerId, table.component, table.componentKey).limit(page.length).for("update");
			const previousByKey = new Map(previous.map((row) => [keyOf(row), row]));
			const values: (typeof table.$inferInsert)[] = [];
			for (const change of page) {
				const key = keyOf(change), head = headById.get(`${change.ownerId}:${change.afterRevisionId}`);
				if (!head) throw new Error("Music source current history is missing");
				const observed = interpretation.desiredSnapshotId ? supportBySnapshot.get(`${key}:${interpretation.desiredSnapshotId}`) : undefined;
				let support: { snapshotId: string; sourcePath: string; historyId: string } | undefined = observed;
				for (const snapshotId of interpretation.snapshotIds) { if (support) break; support = supportBySnapshot.get(`${key}:${snapshotId}`); }
				const old = previousByKey.get(key);
				if (!support && old) support = { snapshotId: old.snapshotId, sourcePath: old.sourcePath, historyId: old.sourceHistoryId };
				if (!support) continue;
				matched.add(key);
				values.push({ sourceRecordId: input.sourceRecordId, mappingKey: interpretation.mappingKey, correspondenceRevision: interpretation.correspondenceRevision,
					mappingOwner: proposal.mappingOwner, ownerId: change.ownerId, component: change.component, componentKey: change.componentKey,
					snapshotId: support.snapshotId, sourcePath: support.sourcePath, sourceHistoryId: support.historyId, currentHistoryId: head.id,
					absent: !observed || head.operation === "DELETE", proposalId: input.proposalId, action: input.action });
			}
			if (values.length) await tx.insert(table).values(values).onConflictDoUpdate({
				target: [table.sourceRecordId, table.mappingKey, table.correspondenceRevision, table.ownerId, table.component, table.componentKey],
				set: { mappingOwner: sql`excluded.mapping_owner`, snapshotId: sql`excluded.snapshot_id`, sourcePath: sql`excluded.source_path`, sourceHistoryId: sql`excluded.source_history_id`,
					currentHistoryId: sql`excluded.current_history_id`, absent: sql`excluded.absent`, proposalId: sql`excluded.proposal_id`, action: sql`excluded.action` },
			});
		}
	}
	if (native.some((change) => !matched.has(keyOf(change)))) throw new Error("Music change lacks exact support in either recorded interpretation");
}
