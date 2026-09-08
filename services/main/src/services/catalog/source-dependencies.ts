import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { catalogSourceProposalDependency as dependencies } from "../database/schema/catalog-source-dependency";
import {
	catalogSourceAdoptionProposal as proposals,
	catalogSourceMappingClaim as claims,
	catalogSourceRecord as records,
} from "../database/schema/catalog-source";
import {
	currentParticipationAuthority,
	ParticipationDenied,
	requireParticipation,
} from "../participation/policy";
import { lockCatalogSourceBinding } from "./source-bindings";
import { loadCatalogIdentity } from "./storage";
import {
	requireCatalogSourceReferenceEvidence,
	type CatalogSourceReferenceEvidence,
} from "./source-observations";

const keySchema = z.strictObject({
	sourceRecordId: z.uuid(),
	proposalId: z.uuid(),
	position: z.number().int().min(0).max(8191),
});

/** Separately authorized intake may share its own draft dependencies with one exact proposal. @internal */
export async function prepareCatalogSourceProposalDependency(
	tx: DatabaseTransaction,
	actor: string,
	input: z.infer<typeof keySchema> & {
		dependencySourceRecordId: string;
		evidence: CatalogSourceReferenceEvidence;
		purpose?: "incoming" | "previous-for-withdrawal";
	},
) {
	const key = keySchema.parse({
		sourceRecordId: input.sourceRecordId,
		proposalId: input.proposalId,
		position: input.position,
	});
	z.uuid().parse(input.dependencySourceRecordId);
	const purpose = z
		.enum(["incoming", "previous-for-withdrawal"])
		.parse(input.purpose ?? "incoming");
	const evidence = requireCatalogSourceReferenceEvidence(input.evidence);
	const authority = currentParticipationAuthority();
	if (
		!authority ||
		authority.principal.kind !== "auth" ||
		authority.principal.authUserId !== actor ||
		authority.grant
	)
		throw new ParticipationDenied("Dependency sharing requires direct human intake authority");
	const [located] = await tx
		.select()
		.from(proposals)
		.where(and(eq(proposals.sourceRecordId, key.sourceRecordId), eq(proposals.id, key.proposalId)))
		.limit(1);
	if (!located) throw new Error("Source proposal is missing");
	if (key.position > 127 && located.mappingVersion !== "musicbrainz.release.1")
		throw new RangeError("Only staged music release proposals admit extended dependency pages");
	const root = await lockCatalogSourceBinding(tx, {
		sourceRecordId: key.sourceRecordId,
		mappingKey: located.mappingKey,
	});
	await loadCatalogIdentity(tx, root.reference, actor, true);
	const [proposal] = await tx
		.select()
		.from(proposals)
		.where(and(eq(proposals.sourceRecordId, key.sourceRecordId), eq(proposals.id, key.proposalId)))
		.limit(1)
		.for("update");
	if (
		!proposal ||
		proposal.state !== "pending" ||
		proposal.expectedBindingRevision !== root.claim.bindingRevision ||
		evidence.sourceRecordId !== proposal.sourceRecordId ||
		(purpose === "incoming"
			? evidence.snapshotId !== proposal.snapshotId
			: root.claim.appliedCorrespondenceRevision !== root.claim.correspondenceRevision ||
				evidence.snapshotId !== root.claim.observedSnapshotId)
	)
		throw new Error("Dependency preparation requires the exact pending source proposal evidence");
	const [record] = await tx
		.select()
		.from(records)
		.where(eq(records.id, input.dependencySourceRecordId))
		.limit(1);
	if (!record || record.source !== evidence.source || record.externalId !== evidence.externalId)
		throw new Error("Dependency source identity differs from its archived reference");
	const [claim] = await tx
		.select()
		.from(claims)
		.where(and(eq(claims.sourceRecordId, record.id), eq(claims.path, "/")))
		.limit(1);
	if (!claim) throw new Error("Dependency must be materialized before proposal preparation");
	const dependency = await lockCatalogSourceBinding(tx, {
		sourceRecordId: record.id,
		mappingKey: claim.mappingKey,
	});
	if (dependency.claim.state !== "active") throw new Error("Dependency correspondence is inactive");
	const native = await loadCatalogIdentity(tx, dependency.reference, actor, false);
	const publicDependency =
		native.visibility === "public" &&
		native.status === "published" &&
		native.moderationStatus === "approved";
	if (!publicDependency && native.createdByAuthUserId !== actor)
		throw new ParticipationDenied("Only the draft creator may share a private source dependency");
	const values = {
		...key,
		snapshotId: evidence.snapshotId,
		sourcePath: evidence.path,
		dependencySourceRecordId: record.id,
		dependencyMappingKey: claim.mappingKey,
		dependencyBindingRevision: dependency.claim.bindingRevision,
		preparedByAuthUserId: actor,
		publishingId: dependency.reference.owner === "publishing" ? native.id : null,
		musicId: dependency.reference.owner === "music" ? native.id : null,
		programId: dependency.reference.owner === "program" ? native.id : null,
		softwareId: dependency.reference.owner === "software" ? native.id : null,
		entityId: dependency.reference.owner === "entity" ? native.id : null,
		groupingId: dependency.reference.owner === "grouping" ? native.id : null,
		referenceId: dependency.reference.owner === "reference" ? native.id : null,
		distributionId: dependency.reference.owner === "distribution" ? native.id : null,
	};
	await tx.insert(dependencies).values(values).onConflictDoNothing();
	const [persisted] = await tx
		.select()
		.from(dependencies)
		.where(
			and(
				eq(dependencies.sourceRecordId, key.sourceRecordId),
				eq(dependencies.proposalId, key.proposalId),
				eq(dependencies.position, key.position),
			),
		)
		.limit(1);
	if (
		!persisted ||
		persisted.revokedAt ||
		persisted.dependencySourceRecordId !== record.id ||
		persisted.dependencyMappingKey !== claim.mappingKey ||
		persisted.dependencyBindingRevision !== dependency.claim.bindingRevision ||
		persisted.snapshotId !== evidence.snapshotId ||
		persisted.sourcePath !== evidence.path
	)
		throw new Error("Source dependency position already identifies different or revoked evidence");
	return {
		position: key.position,
		reference: dependency.reference,
		bindingRevision: dependency.claim.bindingRevision,
	};
}

/** A dependency's preparer can end that read delegation without gaining authority over the root. @internal */
export async function revokeCatalogSourceProposalDependency(
	tx: DatabaseTransaction,
	actor: string,
	input: z.infer<typeof keySchema>,
) {
	const key = keySchema.parse(input),
		authority = currentParticipationAuthority();
	if (
		!authority ||
		authority.principal.kind !== "auth" ||
		authority.principal.authUserId !== actor ||
		authority.grant
	)
		throw new ParticipationDenied("Dependency revocation requires its direct human preparer");
	await requireParticipation(tx, authority, "entity.security", {
		owner: "entity",
		id: authority.actingEntityId,
	});
	const predicate = and(
		eq(dependencies.sourceRecordId, key.sourceRecordId),
		eq(dependencies.proposalId, key.proposalId),
		eq(dependencies.position, key.position),
	);
	const [dependency] = await tx.select().from(dependencies).where(predicate).limit(1).for("update");
	if (!dependency || dependency.preparedByAuthUserId !== actor)
		throw new ParticipationDenied("Dependency revocation requires its preparer");
	if (!dependency.revokedAt)
		await tx.update(dependencies).set({ revokedAt: new Date() }).where(predicate);
}
