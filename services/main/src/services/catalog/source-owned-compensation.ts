import { and, eq } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import { CatalogNameTables } from "../database/schema/catalog-names";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import type { CatalogOwner, CatalogReference } from "./contracts";
import type { CatalogNameInput, CatalogNameAuthorityInput } from "./name-contracts";
import { reviseCatalogName } from "./names";
import { reviseCatalogNameAuthority } from "./authority";
import { restoreCatalogSemanticRevision, transitionCatalogSemanticState } from "./semantic-history";
import { loadCatalogIdentity } from "./storage";
import {
	CatalogSourceNativeChangesSchema,
	type CatalogSourceNativeChange,
} from "./source-applications";

type NamedForm = typeof CatalogNameTables.entity.nameRevision.$inferSelect;
type Authority = typeof CatalogNameTables.entity.authorityRevision.$inferSelect;
export type CatalogSourceOwnedChange = Extract<CatalogSourceNativeChange, { owner: CatalogOwner }>;

/** @internal Reconstruct canonical inputs from checked named-form history without replaying storage metadata. */
export function catalogNameRevisionValues(row: NamedForm): CatalogNameInput {
	return {
		value: row.value,
		kind: row.kind,
		sortName: row.sortName,
		languageTag: row.languageTag,
		privateUseNamespace: row.privateUseNamespace,
		origin: row.origin,
		translationMethod: row.translationMethod,
		primaryForLanguage: row.primaryForLanguage,
		scopeOwnerId: row.scopeOwnerId,
		territory: row.territory,
		context: row.context,
		derivationNameId: row.derivationNameId,
		derivationRevision: row.derivationRevision,
		begin: row.begin,
		end: row.end,
		ended: row.ended,
		spoiler: row.spoiler,
		state: row.state,
	};
}
function authorityValues(row: Authority): CatalogNameAuthorityInput {
	return {
		nameId: row.nameId,
		nameRevision: row.nameRevision,
		claim: row.claim,
		reviewState: row.reviewState,
		authorizerEntityId: row.authorizerEntityId,
		role: row.role,
		territory: row.territory,
		channel: row.channel,
		context: row.context,
		validFrom: row.validFrom?.toISOString() ?? null,
		validUntil: row.validUntil?.toISOString() ?? null,
		evidence: {
			sourceRecordId: row.sourceRecordId,
			snapshotId: row.snapshotId,
			sourcePath: row.sourcePath,
		},
		reviewEvidence:
			row.reviewSourceRecordId && row.reviewSnapshotId && row.reviewSourcePath
				? {
						sourceRecordId: row.reviewSourceRecordId,
						snapshotId: row.reviewSnapshotId,
						sourcePath: row.reviewSourcePath,
					}
				: null,
		state: row.state,
	};
}

/** @internal Compensates exactly one owned native change through canonical CAS commands. */
export async function compensateCatalogSourceOwnedChange(
	tx: DatabaseTransaction,
	actor: string,
	input: CatalogSourceOwnedChange,
): Promise<CatalogSourceOwnedChange> {
	const [change] = CatalogSourceNativeChangesSchema.parse([input]);
	if (!change || !("owner" in change))
		throw new TypeError("Expected an owner-local semantic or named-form change");
	const reference: CatalogReference = { owner: change.owner, id: change.ownerId };
	const identity = await loadCatalogIdentity(tx, reference, actor, true);
	let afterRevision: number;
	switch (change.kind) {
		case "catalog-semantic": {
			if (change.beforeRevision === null)
				afterRevision = (
					await transitionCatalogSemanticState(
						tx,
						reference,
						actor,
						identity.revision,
						change.componentKey,
						change.afterRevision,
						"superseded",
					)
				).headVersion;
			else {
				const t = CatalogFactTables[change.owner].semanticRevision;
				const [previous] = await tx
					.select()
					.from(t)
					.where(
						and(
							eq(t.ownerId, change.ownerId),
							eq(t.semanticId, change.componentKey),
							eq(t.version, change.beforeRevision),
						),
					)
					.limit(1);
				if (!previous) throw new Error("Semantic compensation history is missing");
				afterRevision =
					previous.state === "active"
						? (
								await restoreCatalogSemanticRevision(
									tx,
									reference,
									actor,
									identity.revision,
									change.componentKey,
									change.afterRevision,
									change.beforeRevision,
								)
							).headVersion
						: (
								await transitionCatalogSemanticState(
									tx,
									reference,
									actor,
									identity.revision,
									change.componentKey,
									change.afterRevision,
									previous.state,
								)
							).headVersion;
			}
			break;
		}
		case "catalog-name": {
			const t = CatalogNameTables[change.owner].nameRevision;
			const [previous] = await tx
				.select()
				.from(t)
				.where(
					and(
						eq(t.ownerId, change.ownerId),
						eq(t.id, change.componentKey),
						eq(t.revision, change.beforeRevision ?? change.afterRevision),
					),
				)
				.limit(1);
			if (!previous) throw new Error("Named-form compensation history is missing");
			const values = catalogNameRevisionValues(previous);
			if (change.beforeRevision === null) values.state = "withdrawn";
			afterRevision = (
				await reviseCatalogName(
					tx,
					reference,
					actor,
					change.componentKey,
					change.afterRevision,
					values,
				)
			).revision;
			break;
		}
		case "catalog-name-authority": {
			const t = CatalogNameTables[change.owner].authorityRevision;
			const [previous] = await tx
				.select()
				.from(t)
				.where(
					and(
						eq(t.ownerId, change.ownerId),
						eq(t.id, change.componentKey),
						eq(t.revision, change.beforeRevision ?? change.afterRevision),
					),
				)
				.limit(1);
			if (!previous) throw new Error("Name authority compensation history is missing");
			const values = authorityValues(previous);
			if (change.beforeRevision === null) values.state = "withdrawn";
			afterRevision = (
				await reviseCatalogNameAuthority(
					tx,
					reference,
					actor,
					change.componentKey,
					change.afterRevision,
					values,
				)
			).revision;
			break;
		}
	}
	return { ...change, beforeRevision: change.afterRevision, afterRevision };
}
