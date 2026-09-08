import { and, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { AccountAuthorization } from "../authorization/account/authorization";
import { currentParticipationAuthority, ParticipationDenied, requireParticipation } from "../participation/policy";
import { catalogSourceAdoptionProposal as proposals, catalogSourceRecord as records, catalogSourceMappingClaim as claims, catalogSourceBindingRevision as bindingRevisions } from "../database/schema/catalog-source";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import type { CatalogReference } from "./contracts";
import { catalogSourceApplication as applications } from "../database/schema/catalog-source-application";
import { beginCatalogSourceAcquisition, registerCatalogSourceRecord, loadCatalogSourceReceipt,
	catalogSourceRecordId, type CatalogSourceReceipt, type CatalogSourceArchive } from "./source-observations";
import { CatalogSourceIntakeKeySchema, type NativeSourceSnapshot } from "./source-native-registry";
import { catalogSourceAcquisitionRequest } from "./source-acquisition";
import { lockCatalogSourceBinding } from "./source-bindings";
import { loadCatalogIdentity, CatalogReferenceNotFound } from "./storage";
import { CatalogSourceProposalSchema, CatalogResourceBindingsQuerySchema } from "./source-api-contracts";

/** @internal Human intake is rechecked in each committed step; scoped automation cannot allocate unrelated identities. */
export async function requireCatalogSourceIntake(tx: DatabaseTransaction, actor: string) {
	const authority = currentParticipationAuthority();
	if (!authority || authority.principal.kind !== "auth" || authority.principal.authUserId !== actor || authority.grant)
		throw new ParticipationDenied("Source intake requires a current direct account");
	await requireParticipation(tx, authority, "entity.security", { owner: "entity", id: authority.actingEntityId });
	await new AccountAuthorization(actor).ensureCanContribute(tx);
}

/** @internal Cache admission or acquisition generation commits before any network or archive I/O. */
export async function beginCatalogApiIntake(tx: DatabaseTransaction, actor: string, input: z.input<typeof CatalogSourceIntakeKeySchema>, archive?: CatalogSourceArchive, refresh = false) {
	await requireCatalogSourceIntake(tx, actor);
	const key = CatalogSourceIntakeKeySchema.parse(input);
	const sourceRecordId = catalogSourceRecordId(key);
	// Run endpoint and identity validation before inserting a source record.
	const descriptor = catalogSourceAcquisitionRequest(key);
	const record = await registerCatalogSourceRecord(tx, key);
	if (!refresh && record.headSnapshotId && (record.lastCheckOutcome === "changed" || record.lastCheckOutcome === "unchanged") && record.lastCheckedAt &&
		record.lastCheckedAt.getTime() >= Date.now() - 15 * 60_000) {
		const receipt = await loadCatalogSourceReceipt(tx, sourceRecordId, record.headSnapshotId, archive);
		if (receipt.contractSha256 === descriptor.contractSha256)
			return { status: "cached" as const, sourceRecordId, snapshotId: record.headSnapshotId, receipt };
	}
	const generation = await beginCatalogSourceAcquisition(tx, key);
	return { status: "acquire" as const, acquisition: { ...key, ...generation } };
}

/** @internal Proposal reads disclose decisions only to an editor of their exact native target. */
export async function readCatalogApiProposalEvidence(tx: DatabaseTransaction, actor: string,
	sourceRecordId: string, proposalId: string, action: "apply" | "withdraw" | "reject" | "supersede", archive?: CatalogSourceArchive) {
	const [located] = await tx.select().from(proposals)
		.where(and(eq(proposals.sourceRecordId, sourceRecordId), eq(proposals.id, proposalId))).limit(1);
	if (!located) throw new CatalogReferenceNotFound();
	const binding = await lockCatalogSourceBinding(tx, { sourceRecordId, mappingKey: located.mappingKey });
	const authority = currentParticipationAuthority();
	if (!authority || authority.principal.authUserId !== actor) throw new ParticipationDenied();
	if (authority.grant || authority.principal.kind === "service")
		await requireParticipation(tx, authority, "proposal.adopt", binding.reference, { sourceRecordId, proposalId });
	else await loadCatalogIdentity(tx, binding.reference, actor, true);
	let previousSnapshotId = binding.claim.appliedCorrespondenceRevision === binding.claim.correspondenceRevision
		? binding.claim.observedSnapshotId : null;
	if (action === "withdraw") {
		const [application] = await tx.select({ previousSnapshotId: applications.previousSnapshotId }).from(applications)
			.where(and(eq(applications.sourceRecordId, sourceRecordId), eq(applications.proposalId, proposalId), eq(applications.action, "apply"))).limit(1);
		previousSnapshotId = application?.previousSnapshotId ?? null;
	}
	const after = await loadCatalogSourceReceipt(tx, sourceRecordId, located.snapshotId, archive);
	const before = previousSnapshotId ? await loadCatalogSourceReceipt(tx, sourceRecordId, previousSnapshotId, archive) : null;
	return { proposal: presentCatalogSourceProposal(located), reference: binding.reference,
		after: { receipt: after, snapshotId: located.snapshotId },
		before: before && previousSnapshotId ? { receipt: before, snapshotId: previousSnapshotId } : null };
}

export function presentCatalogSourceProposal(row: typeof proposals.$inferSelect) {
	return CatalogSourceProposalSchema.parse({
		id: row.id, sourceRecordId: row.sourceRecordId, snapshotId: row.snapshotId,
		mappingKey: row.mappingKey, mappingVersion: row.mappingVersion,
		expectedTargetRevision: row.expectedTargetRevision, expectedBindingRevision: row.expectedBindingRevision,
		expectedPolicyRevision: row.expectedPolicyRevision, state: row.state, decisionReason: row.decisionReason,
		appliedTargetRevision: row.appliedTargetRevision, createdAt: row.createdAt.toISOString(), decidedAt: row.decidedAt?.toISOString() ?? null,
	});
}

/** @internal A supplied snapshot remains evidence, never authority to apply it after a changed head. */
export async function reopenCatalogApiSnapshot(tx: DatabaseTransaction, actor: string, sourceRecordId: string, snapshotId: string, archive?: CatalogSourceArchive) {
	await requireCatalogSourceIntake(tx, actor);
	const [record] = await tx.select({ id: records.id }).from(records).where(eq(records.id, sourceRecordId)).limit(1);
	if (!record) throw new CatalogReferenceNotFound();
	return { receipt: await loadCatalogSourceReceipt(tx, sourceRecordId, snapshotId, archive), snapshotId };
}
export type CatalogApiArchivedSnapshot = Omit<NativeSourceSnapshot, "bytes"> & { receipt: CatalogSourceReceipt };

/** @alpha Bounded source provenance for one native owner; no corpus-wide binding enumeration. */
export async function pageCatalogResourceSourceBindings(tx: DatabaseTransaction, reference: CatalogReference,
	actor: string | null, input: z.input<typeof CatalogResourceBindingsQuerySchema>) {
	await loadCatalogIdentity(tx, reference, actor, false);
	const query = CatalogResourceBindingsQuerySchema.parse(input);
	const table = CatalogFactTables[reference.owner].sourceBinding;
	const rows = await tx.select({
		sourceRecordId: table.sourceRecordId, mappingKey: table.mappingKey,
		source: records.source, objectType: records.objectType, externalId: records.externalId,
		mappingVersion: claims.mappingVersion, bindingRevision: claims.bindingRevision, state: claims.state, mode: bindingRevisions.mode,
		observedSnapshotId: claims.observedSnapshotId, headSnapshotId: records.headSnapshotId,
	}).from(table)
		.innerJoin(claims, and(eq(claims.sourceRecordId, table.sourceRecordId), eq(claims.mappingKey, table.mappingKey)))
		.innerJoin(records, eq(records.id, table.sourceRecordId))
		.leftJoin(bindingRevisions, and(eq(bindingRevisions.sourceRecordId, table.sourceRecordId), eq(bindingRevisions.mappingKey, table.mappingKey), eq(bindingRevisions.revision, claims.bindingRevision)))
		.where(and(eq(table.ownerId, reference.id), query.afterMappingKey && query.afterSourceRecordId
			? sql`(${table.mappingKey},${table.sourceRecordId}) > (${query.afterMappingKey}::uuid,${query.afterSourceRecordId}::uuid)` : undefined))
		.orderBy(table.mappingKey, table.sourceRecordId).limit(query.limit);
	const items = rows.map(row => {
		if (row.mode === null) throw new TypeError("Source binding lacks its current immutable policy revision");
		return { ...row, mode: row.mode };
	});
	const last = items.at(-1);
	return { items, after: items.length === query.limit && last
		? { afterMappingKey: last.mappingKey, afterSourceRecordId: last.sourceRecordId } : null };
}

export async function catalogPrincipalMappingKey(tx: DatabaseTransaction, sourceRecordId: string) {
	const [claim] = await tx.select({ mappingKey: claims.mappingKey }).from(claims)
		.where(and(eq(claims.sourceRecordId, sourceRecordId), eq(claims.path, "/"))).limit(1);
	if (!claim) throw new TypeError("Native source intake did not seal its principal correspondence");
	return claim.mappingKey;
}
