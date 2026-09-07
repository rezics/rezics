import { and, eq, sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import {
	CatalogSourceOwnedBaselines,
	softwareSourceComponentBaseline,
	softwareSourceRecordBaseline,
	softwareSourceContextBaseline,
	softwareSourceParticipationBaseline,
} from "../database/schema/catalog-source-owned-baseline";
import {
	softwareComponentSourceOccurrence,
	softwareRecordSourceOccurrence,
} from "../database/schema/catalog-software-source";
import { softwareParticipationSourceOccurrence } from "../database/schema/catalog-software";
import { softwareParticipationCreditSourceOccurrence } from "../database/schema/catalog-software-participation";
import { CatalogNameTables } from "../database/schema/catalog-names";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { catalogSourceApplication } from "../database/schema/catalog-source-application";
import { catalogSourceAdoptionProposal as proposals } from "../database/schema/catalog-source";
import {
	CatalogSourceNativeChangesSchema,
	type CatalogSourceNativeChange,
} from "./source-applications";
import type { CatalogSourceOwnedChange } from "./source-owned-compensation";

type NumericChange = Extract<CatalogSourceNativeChange, { afterRevision: number }>;
type Origin = { sourceSnapshotId: string; sourcePath: string; sourceRevision: number };

async function origin(
	tx: DatabaseTransaction,
	sourceRecordId: string,
	snapshotId: string,
	change: NumericChange,
): Promise<Origin | undefined> {
	if ("owner" in change) {
		const tables = CatalogNameTables[change.owner];
		if (change.kind === "catalog-name") {
			const t = tables.sourceOccurrence;
			const [row] = await tx
				.select({ sourcePath: t.sourcePath, sourceRevision: t.nameRevision })
				.from(t)
				.where(
					and(
						eq(t.sourceRecordId, sourceRecordId),
						eq(t.snapshotId, snapshotId),
						eq(t.ownerId, change.ownerId),
						eq(t.nameId, change.componentKey),
					),
				)
				.orderBy(t.nameRevision)
				.limit(1);
			return row && { ...row, sourceSnapshotId: snapshotId };
		}
		if (change.kind === "catalog-name-authority") {
			const t = tables.authorityRevision;
			const [row] = await tx
				.select({ sourcePath: t.sourcePath, sourceRevision: t.revision })
				.from(t)
				.where(
					and(
						eq(t.sourceRecordId, sourceRecordId),
						eq(t.snapshotId, snapshotId),
						eq(t.ownerId, change.ownerId),
						eq(t.id, change.componentKey),
					),
				)
				.orderBy(t.revision)
				.limit(1);
			return row && { ...row, sourceSnapshotId: snapshotId };
		}
		const f = CatalogFactTables[change.owner];
		for (const kind of ["fact", "relation"] as const) {
			const value = kind === "fact" ? f.fact : f.relation;
			const sourceKey = kind === "fact" ? f.support.factId : f.support.relationId;
			const [row] = await tx
				.select({
					sourcePath: f.support.sourcePath,
					sourceRevision: sql<number>`${value.expectedHeadVersion} + 1`,
				})
				.from(f.support)
				.innerJoin(value, and(eq(value.ownerId, f.support.ownerId), eq(value.id, sourceKey)))
				.where(
					and(
						eq(f.support.sourceRecordId, sourceRecordId),
						eq(f.support.snapshotId, snapshotId),
						eq(f.support.ownerId, change.ownerId),
						eq(value.semanticId, change.componentKey),
					),
				)
				.orderBy(f.support.id)
				.limit(1);
			if (row) return { ...row, sourceSnapshotId: snapshotId };
		}
		return undefined;
	}
	switch (change.kind) {
		case "software-component": {
			const t = softwareComponentSourceOccurrence;
			const [row] = await tx
				.select({ sourcePath: t.sourcePath, sourceRevision: t.revision })
				.from(t)
				.where(
					and(
						eq(t.sourceRecordId, sourceRecordId),
						eq(t.snapshotId, snapshotId),
						eq(t.ownerId, change.ownerId),
						eq(t.component, change.component),
						eq(t.componentKey, change.componentKey),
					),
				)
				.limit(1);
			return row && { ...row, sourceSnapshotId: snapshotId };
		}
		case "software-record": {
			const t = softwareRecordSourceOccurrence;
			const [row] = await tx
				.select({ sourcePath: t.sourcePath, sourceRevision: t.revision })
				.from(t)
				.where(
					and(
						eq(t.sourceRecordId, sourceRecordId),
						eq(t.snapshotId, snapshotId),
						eq(t.ownerId, change.ownerId),
					),
				)
				.limit(1);
			return row && { ...row, sourceSnapshotId: snapshotId };
		}
		case "software-context": {
			const t = softwareParticipationSourceOccurrence;
			const [row] = await tx
				.select({ sourcePath: t.sourcePointer, sourceRevision: t.contextRevision })
				.from(t)
				.where(
					and(
						eq(t.sourceRecordId, sourceRecordId),
						eq(t.snapshotId, snapshotId),
						eq(t.contentId, change.ownerId),
						eq(t.contextId, change.componentKey),
					),
				)
				.limit(1);
			return row && { ...row, sourceSnapshotId: snapshotId };
		}
		case "software-participation": {
			const t = softwareParticipationCreditSourceOccurrence;
			const [row] = await tx
				.select({ sourcePath: t.sourcePath, sourceRevision: t.participationRevision })
				.from(t)
				.where(
					and(
						eq(t.sourceRecordId, sourceRecordId),
						eq(t.snapshotId, snapshotId),
						eq(t.contentId, change.ownerId),
						eq(t.participationId, change.componentKey),
					),
				)
				.limit(1);
			return row && { ...row, sourceSnapshotId: snapshotId };
		}
	}
}

/** @internal One indexed lookup collapses arbitrarily many apply/compensate cycles. */
export async function resolveCatalogSourceOwnedBaseline(
	tx: DatabaseTransaction,
	key: { sourceRecordId: string; mappingKey: string },
	change: Pick<CatalogSourceOwnedChange, "owner" | "ownerId" | "kind" | "componentKey">,
	sourceRevision: number,
) {
	const t = CatalogSourceOwnedBaselines[change.owner];
	const [row] = await tx
		.select()
		.from(t)
		.where(
			and(
				eq(t.sourceRecordId, key.sourceRecordId),
				eq(t.mappingKey, key.mappingKey),
				eq(t.ownerId, change.ownerId),
				eq(t.kind, change.kind),
				eq(t.componentKey, change.componentKey),
			),
		)
		.limit(1);
	return row && row.sourceRevision === sourceRevision ? row.currentRevision : sourceRevision;
}

/** @internal Finalize only after immutable native journal rows exist in this transaction. */
export async function advanceCatalogSourceOwnedBaselines(
	tx: DatabaseTransaction,
	input: {
		sourceRecordId: string;
		proposalId: string;
		action: "apply" | "withdraw";
		previousSnapshotId: string | null;
	},
	inputChanges: CatalogSourceNativeChange[],
) {
	const changes = CatalogSourceNativeChangesSchema.parse(inputChanges);
	const [proposal] = await tx
		.select()
		.from(proposals)
		.where(
			and(eq(proposals.sourceRecordId, input.sourceRecordId), eq(proposals.id, input.proposalId)),
		)
		.limit(1);
	if (!proposal) throw new Error("Source baseline proposal is missing");
	const [application] = await tx
		.select()
		.from(catalogSourceApplication)
		.where(
			and(
				eq(catalogSourceApplication.sourceRecordId, input.sourceRecordId),
				eq(catalogSourceApplication.proposalId, input.proposalId),
				eq(catalogSourceApplication.action, input.action),
			),
		)
		.limit(1);
	if (!application) throw new Error("Source baseline requires its committed native journal");
	const [applied] = input.action === "withdraw" ? await tx.select().from(catalogSourceApplication).where(and(eq(catalogSourceApplication.sourceRecordId, input.sourceRecordId), eq(catalogSourceApplication.proposalId, input.proposalId), eq(catalogSourceApplication.action, "apply"))).limit(1) : [];
	if (input.action === "withdraw" && !applied) throw new Error("Source baseline compensation requires its original application");
	const desiredSnapshot = input.action === "apply" ? proposal.snapshotId : applied?.previousSnapshotId;
	for (const change of changes) {
		if (!("afterRevision" in change)) continue;
		const observed = desiredSnapshot
			? await origin(tx, input.sourceRecordId, desiredSnapshot, change)
			: undefined;
		const fallback =
			observed ?? (await origin(tx, input.sourceRecordId, proposal.snapshotId, change));
		const locator = {
			sourceRecordId: input.sourceRecordId,
			mappingKey: proposal.mappingKey,
			ownerId: change.ownerId,
		};
		const common = {
			...locator,
			currentRevision: change.afterRevision,
			lastProposalId: input.proposalId,
			lastAction: input.action,
			absent: !observed,
		};
		if ("owner" in change) {
			const t = CatalogSourceOwnedBaselines[change.owner];
			const key = and(
				eq(t.sourceRecordId, locator.sourceRecordId),
				eq(t.mappingKey, locator.mappingKey),
				eq(t.ownerId, locator.ownerId),
				eq(t.kind, change.kind),
				eq(t.componentKey, change.componentKey),
			);
			const [previous] = await tx.select().from(t).where(key).limit(1).for("update");
			const proof = fallback ?? previous;
			if (!proof) throw new Error("Owned native change has no source occurrence evidence");
			const values = {
				...common,
				sourceSnapshotId: proof.sourceSnapshotId,
				sourcePath: proof.sourcePath,
				sourceRevision: proof.sourceRevision,
				kind: change.kind,
				componentKey: change.componentKey,
				semanticId: change.kind === "catalog-semantic" ? change.componentKey : null,
				nameId: change.kind === "catalog-name" ? change.componentKey : null,
				authorityId: change.kind === "catalog-name-authority" ? change.componentKey : null,
			};
			await tx
				.insert(t)
				.values(values)
				.onConflictDoUpdate({
					target: [t.sourceRecordId, t.mappingKey, t.ownerId, t.kind, t.componentKey],
					set: values,
				});
		} else if (change.kind === "software-record") {
			const t = softwareSourceRecordBaseline;
			const [previous] = await tx
				.select()
				.from(t)
				.where(
					and(
						eq(t.sourceRecordId, locator.sourceRecordId),
						eq(t.mappingKey, locator.mappingKey),
						eq(t.ownerId, locator.ownerId),
					),
				)
				.limit(1)
				.for("update");
			const proof = fallback ?? previous;
			if (!proof) throw new Error("Software record change has no source occurrence evidence");
			const values = {
				...common,
				sourceSnapshotId: proof.sourceSnapshotId,
				sourcePath: proof.sourcePath,
				sourceRevision: proof.sourceRevision,
			};
			await tx
				.insert(t)
				.values(values)
				.onConflictDoUpdate({ target: [t.sourceRecordId, t.mappingKey, t.ownerId], set: values });
		} else if (change.kind === "software-component") {
			const t = softwareSourceComponentBaseline;
			const [previous] = await tx
				.select()
				.from(t)
				.where(
					and(
						eq(t.sourceRecordId, locator.sourceRecordId),
						eq(t.mappingKey, locator.mappingKey),
						eq(t.ownerId, locator.ownerId),
						eq(t.component, change.component),
						eq(t.componentKey, change.componentKey),
					),
				)
				.limit(1)
				.for("update");
			const proof = fallback ?? previous;
			if (!proof) throw new Error("Software component change has no source occurrence evidence");
			const values = {
				...common,
				sourceSnapshotId: proof.sourceSnapshotId,
				sourcePath: proof.sourcePath,
				sourceRevision: proof.sourceRevision,
				component: change.component,
				componentKey: change.componentKey,
			};
			await tx
				.insert(t)
				.values(values)
				.onConflictDoUpdate({
					target: [t.sourceRecordId, t.mappingKey, t.ownerId, t.component, t.componentKey],
					set: values,
				});
		} else {
			const t =
				change.kind === "software-context"
					? softwareSourceContextBaseline
					: softwareSourceParticipationBaseline;
			const [previous] = await tx
				.select()
				.from(t)
				.where(
					and(
						eq(t.sourceRecordId, locator.sourceRecordId),
						eq(t.mappingKey, locator.mappingKey),
						eq(t.ownerId, locator.ownerId),
						eq(t.componentKey, change.componentKey),
					),
				)
				.limit(1)
				.for("update");
			const proof = fallback ?? previous;
			if (!proof) throw new Error("Software child change has no source occurrence evidence");
			const values = {
				...common,
				sourceSnapshotId: proof.sourceSnapshotId,
				sourcePath: proof.sourcePath,
				sourceRevision: proof.sourceRevision,
				componentKey: change.componentKey,
			};
			await tx
				.insert(t)
				.values(values)
				.onConflictDoUpdate({
					target: [t.sourceRecordId, t.mappingKey, t.ownerId, t.componentKey],
					set: values,
				});
		}
	}
}
