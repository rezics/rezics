import { and, eq, sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import {
	CatalogSourceOwnedBaselines,
	CatalogSourceProfileBaselines,
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
import { catalogSourceBindingRevision } from "../database/schema/catalog-source";
import { catalogSourceApplication } from "../database/schema/catalog-source-application";
import { catalogSourceAdoptionProposal as proposals } from "../database/schema/catalog-source";
import {
	CatalogSourceNativeChangesSchema,
	type CatalogSourceNativeChange,
} from "./source-applications";
import type { CatalogSourceOwnedChange } from "./source-owned-compensation";
import { CatalogProfileSourceTables } from "../database/schema/catalog-profile-source";
import { resolveCatalogSourceChildCorrespondence } from "./source-child-correspondence";
import { catalogSourceApplicationScopes } from "./source-application-scopes";

type NumericChange = Extract<CatalogSourceNativeChange, { afterRevision: number }>;
type Origin = { sourceSnapshotId: string; sourcePath: string; sourceRevision: number };

async function origin(
	tx: DatabaseTransaction,
	sourceRecordId: string,
	snapshotId: string,
	change: NumericChange,
	scope: { mappingKey: string; correspondenceRevision: number },
): Promise<Origin | undefined> {
	if (change.kind === "catalog-profile") {
		const t = CatalogProfileSourceTables[change.owner];
		const [row] = await tx
			.select({ sourcePath: t.sourcePath, sourceRevision: t.revision })
			.from(t)
			.where(
				and(
					eq(t.sourceRecordId, sourceRecordId),
					eq(t.mappingKey, scope.mappingKey),
					eq(t.correspondenceRevision, scope.correspondenceRevision),
					eq(t.snapshotId, snapshotId),
					eq(t.ownerId, change.ownerId),
				),
			)
			.limit(1);
		return row && { ...row, sourceSnapshotId: snapshotId };
	}
	if ("owner" in change) {
		const tables = CatalogNameTables[change.owner];
		if (change.kind === "catalog-identifier") {
			const support = CatalogFactTables[change.owner].support;
			const [row] = await tx
				.select({ sourcePath: support.sourcePath, sourceRevision: support.identifierRevision })
				.from(support)
				.where(
					and(
						eq(support.ownerId, change.ownerId),
						eq(support.sourceMappingKey, scope.mappingKey),
						eq(support.sourceCorrespondenceRevision, scope.correspondenceRevision),
						eq(support.identifierId, change.componentKey),
						eq(support.sourceRecordId, sourceRecordId),
						eq(support.snapshotId, snapshotId),
					),
				)
				.orderBy(support.id)
				.limit(1);
			return row?.sourceRevision
				? {
						sourcePath: row.sourcePath,
						sourceRevision: row.sourceRevision,
						sourceSnapshotId: snapshotId,
					}
				: undefined;
		}
		if (change.kind === "catalog-name") {
			const t = tables.sourceOccurrence;
			const [row] = await tx
				.select({ sourcePath: t.sourcePath, sourceRevision: t.nameRevision })
				.from(t)
				.where(
					and(
						eq(t.mappingKey, scope.mappingKey),
						eq(t.correspondenceRevision, scope.correspondenceRevision),
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
			const binding = tables.sourceBinding;
			const [row] = await tx
				.select({ sourcePath: t.sourcePath, sourceRevision: t.revision })
				.from(t)
				.innerJoin(
					binding,
					and(
						eq(binding.ownerId, t.ownerId),
						eq(binding.nameId, t.nameId),
						eq(binding.sourceRecordId, sourceRecordId),
						eq(binding.mappingKey, scope.mappingKey),
						eq(binding.correspondenceRevision, scope.correspondenceRevision),
					),
				)
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
					sourceRevision: sql`${value.expectedHeadVersion} + 1`.mapWith(Number),
				})
				.from(f.support)
				.innerJoin(value, and(eq(value.ownerId, f.support.ownerId), eq(value.id, sourceKey)))
				.where(
					and(
						eq(f.support.sourceRecordId, sourceRecordId),
						eq(f.support.sourceMappingKey, scope.mappingKey),
						eq(f.support.sourceCorrespondenceRevision, scope.correspondenceRevision),
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
						eq(t.mappingKey, scope.mappingKey),
						eq(t.correspondenceRevision, scope.correspondenceRevision),
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
						eq(t.mappingKey, scope.mappingKey),
						eq(t.correspondenceRevision, scope.correspondenceRevision),
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
						eq(t.mappingKey, scope.mappingKey),
						eq(t.correspondenceRevision, scope.correspondenceRevision),
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
						eq(t.mappingKey, scope.mappingKey),
						eq(t.correspondenceRevision, scope.correspondenceRevision),
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
	key: { sourceRecordId: string; mappingKey: string; correspondenceRevision?: number },
	change: Pick<CatalogSourceOwnedChange, "owner" | "ownerId" | "kind" | "componentKey">,
	sourceRevision: number,
) {
	const t = CatalogSourceOwnedBaselines[change.owner];
	const correspondenceRevision =
		key.correspondenceRevision ??
		(await resolveCatalogSourceChildCorrespondence(tx, key.sourceRecordId)).correspondenceRevision;
	const [row] = await tx
		.select()
		.from(t)
		.where(
			and(
				eq(t.sourceRecordId, key.sourceRecordId),
				eq(t.mappingKey, key.mappingKey),
				eq(t.correspondenceRevision, correspondenceRevision),
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
	const [epoch] = await tx
		.select({ correspondenceRevision: catalogSourceBindingRevision.correspondenceRevision })
		.from(catalogSourceBindingRevision)
		.where(
			and(
				eq(catalogSourceBindingRevision.sourceRecordId, input.sourceRecordId),
				eq(catalogSourceBindingRevision.mappingKey, proposal.mappingKey),
				eq(catalogSourceBindingRevision.revision, proposal.expectedBindingRevision),
			),
		)
		.limit(1);
	if (!epoch) throw new Error("Source baseline requires its proposal's exact correspondence epoch");
	const currentScope = {
		mappingKey: proposal.mappingKey,
		correspondenceRevision: epoch.correspondenceRevision,
	};
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
	const [applied] =
		input.action === "withdraw"
			? await tx
					.select()
					.from(catalogSourceApplication)
					.where(
						and(
							eq(catalogSourceApplication.sourceRecordId, input.sourceRecordId),
							eq(catalogSourceApplication.proposalId, input.proposalId),
							eq(catalogSourceApplication.action, "apply"),
						),
					)
					.limit(1)
			: [];
	if (input.action === "withdraw" && !applied)
		throw new Error("Source baseline compensation requires its original application");
	const appliedHeader = input.action === "apply" ? application : applied;
	if (!appliedHeader) throw new Error("Source interpretation requires its immutable apply header");
	const scopes = catalogSourceApplicationScopes(
		appliedHeader,
		{ ...currentScope, snapshotId: proposal.snapshotId },
		input.action,
	);
	for (const change of changes) {
		if (!("afterRevision" in change)) continue;
		let matched = false;
		for (const scope of scopes) {
			const observed = scope.desiredSnapshotId
				? await origin(tx, input.sourceRecordId, scope.desiredSnapshotId, change, scope)
				: undefined;
			let fallback = observed;
			for (const snapshotId of scope.snapshotIds) {
				if (fallback) break;
				fallback = await origin(tx, input.sourceRecordId, snapshotId, change, scope);
			}
			const locator = {
				sourceRecordId: input.sourceRecordId,
				mappingKey: proposal.mappingKey,
				correspondenceRevision: scope.correspondenceRevision,
				ownerId: change.ownerId,
			};
			const common = {
				...locator,
				mappingOwner: proposal.mappingOwner,
				currentRevision: change.afterRevision,
				lastProposalId: input.proposalId,
				lastAction: input.action,
				absent: !observed,
			};
			if (change.kind === "catalog-profile") {
				const t = CatalogSourceProfileBaselines[change.owner];
				const [previous] = await tx
					.select()
					.from(t)
					.where(
						and(
							eq(t.sourceRecordId, locator.sourceRecordId),
							eq(t.mappingKey, locator.mappingKey),
							eq(t.correspondenceRevision, locator.correspondenceRevision),
							eq(t.ownerId, locator.ownerId),
						),
					)
					.limit(1)
					.for("update");
				const proof = fallback ?? previous;
				if (!proof) continue;
				matched = true;
				const values = {
					...common,
					sourceSnapshotId: proof.sourceSnapshotId,
					sourcePath: proof.sourcePath,
					sourceRevision: proof.sourceRevision,
				};
				await tx
					.insert(t)
					.values(values)
					.onConflictDoUpdate({
						target: [t.sourceRecordId, t.mappingKey, t.correspondenceRevision, t.ownerId],
						set: values,
					});
			} else if ("owner" in change) {
				const t = CatalogSourceOwnedBaselines[change.owner];
				const key = and(
					eq(t.sourceRecordId, locator.sourceRecordId),
					eq(t.mappingKey, locator.mappingKey),
					eq(t.correspondenceRevision, locator.correspondenceRevision),
					eq(t.ownerId, locator.ownerId),
					eq(t.kind, change.kind),
					eq(t.componentKey, change.componentKey),
				);
				const [previous] = await tx.select().from(t).where(key).limit(1).for("update");
				const proof = fallback ?? previous;
				if (!proof) continue;
				matched = true;
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
					identifierId: change.kind === "catalog-identifier" ? change.componentKey : null,
				};
				await tx
					.insert(t)
					.values(values)
					.onConflictDoUpdate({
						target: [
							t.sourceRecordId,
							t.mappingKey,
							t.correspondenceRevision,
							t.ownerId,
							t.kind,
							t.componentKey,
						],
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
							eq(t.correspondenceRevision, locator.correspondenceRevision),
							eq(t.ownerId, locator.ownerId),
						),
					)
					.limit(1)
					.for("update");
				const proof = fallback ?? previous;
				if (!proof) continue;
				matched = true;
				const values = {
					...common,
					sourceSnapshotId: proof.sourceSnapshotId,
					sourcePath: proof.sourcePath,
					sourceRevision: proof.sourceRevision,
				};
				await tx
					.insert(t)
					.values(values)
					.onConflictDoUpdate({
						target: [t.sourceRecordId, t.mappingKey, t.correspondenceRevision, t.ownerId],
						set: values,
					});
			} else if (change.kind === "software-component") {
				const t = softwareSourceComponentBaseline;
				const [previous] = await tx
					.select()
					.from(t)
					.where(
						and(
							eq(t.sourceRecordId, locator.sourceRecordId),
							eq(t.mappingKey, locator.mappingKey),
							eq(t.correspondenceRevision, locator.correspondenceRevision),
							eq(t.ownerId, locator.ownerId),
							eq(t.component, change.component),
							eq(t.componentKey, change.componentKey),
						),
					)
					.limit(1)
					.for("update");
				const proof = fallback ?? previous;
				if (!proof) continue;
				matched = true;
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
						target: [
							t.sourceRecordId,
							t.mappingKey,
							t.correspondenceRevision,
							t.ownerId,
							t.component,
							t.componentKey,
						],
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
							eq(t.correspondenceRevision, locator.correspondenceRevision),
							eq(t.ownerId, locator.ownerId),
							eq(t.componentKey, change.componentKey),
						),
					)
					.limit(1)
					.for("update");
				const proof = fallback ?? previous;
				if (!proof) continue;
				matched = true;
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
						target: [
							t.sourceRecordId,
							t.mappingKey,
							t.correspondenceRevision,
							t.ownerId,
							t.componentKey,
						],
						set: values,
					});
			}
		}
		if (!matched)
			throw new Error("Native change has no source occurrence in either recorded interpretation");
	}
}
