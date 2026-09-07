import { eq } from "drizzle-orm";
import { z } from "zod";
import { database } from "../database";
import { participationGrant } from "../database/schema/participation";
import { CatalogReferenceSchema } from "../catalog/contracts";
import {
	ParticipationDenied,
	ParticipationAuthoritySchema,
	requireParticipation,
	type ParticipationAuthority,
} from "./policy";

const selectionSchema = z.strictObject({
	actingEntityId: z.uuid(),
	grant: z.strictObject({
		id: z.uuid(),
		revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
	}),
});

/** Converts one checked concrete target alternative into the shared catalog reference contract. @internal */
export function participationGrantTarget(grant: typeof participationGrant.$inferSelect) {
	const targets = Object.entries({
		publishing: grant.publishingId,
		music: grant.musicId,
		program: grant.programId,
		software: grant.softwareId,
		entity: grant.entityId,
		grouping: grant.groupingId,
		reference: grant.referenceId,
		distribution: grant.distributionId,
	}).filter(([, id]) => id !== null);
	if (targets.length !== 1 || !targets[0]) throw new ParticipationDenied("Grant target is invalid");
	return CatalogReferenceSchema.parse({ owner: targets[0][0], id: targets[0][1] });
}

/**
 * Selects an explicit current grant without changing the authenticated account or its private self identity.
 * Every protected effect must revalidate this authority in its own transaction.
 * @internal
 */
export async function resolveRequestParticipation(
	headers: Headers,
	self: { id: string; authorizationRevision: number },
	authUserId: string,
): Promise<ParticipationAuthority> {
	const raw = headers.get("X-Rezics-Participation");
	const base = {
		principal: { kind: "auth" as const, authUserId },
		actingEntityId: self.id,
		authorizationRevision: self.authorizationRevision,
	};
	if (raw === null) return base;
	if (raw.length > 2048) throw new ParticipationDenied("Participation selection is too large");
	let untrusted: unknown;
	try {
		untrusted = JSON.parse(raw);
	} catch {
		throw new ParticipationDenied("Participation selection is invalid");
	}
	const selection = selectionSchema.safeParse(untrusted);
	if (!selection.success) throw new ParticipationDenied("Participation selection is invalid");
	const authority = ParticipationAuthoritySchema.parse({ ...base, ...selection.data });
	await database.transaction(async (tx) => {
		const [grant] = await tx
			.select()
			.from(participationGrant)
			.where(eq(participationGrant.id, selection.data.grant.id))
			.limit(1);
		if (!grant) throw new ParticipationDenied("Selected participation grant is unavailable");
		if (
			grant.capability === "proposal.adopt" &&
			(!grant.proposalSourceRecordId || !grant.proposalId)
		)
			throw new ParticipationDenied("Proposal approval scope is invalid");
		await requireParticipation(
			tx,
			authority,
			grant.capability,
			participationGrantTarget(grant),
			grant.proposalSourceRecordId && grant.proposalId
				? { sourceRecordId: grant.proposalSourceRecordId, proposalId: grant.proposalId }
				: undefined,
		);
	});
	return authority;
}
