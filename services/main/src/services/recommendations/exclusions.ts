import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { Authorization } from "../authorization";
import { ensureAccountAuthenticationAllowed } from "../auth/account-state";
import type { DatabaseTransaction } from "../database";
import { authEntity, recommendationEvent, recommendationExclusion } from "../database/schema";
import type { RecommendationExclusionBody } from "../api/recommendations/schema";
import { ParticipationDenied } from "../participation/policy";
import { UnitNotFound } from "../units/errors";
import { resolveRegisteredUnitReference } from "../units/reference";
import { allocateReferenceValue, findReferenceValueByNativeId } from "../units/reference-value";

async function admitExclusions(tx: DatabaseTransaction, authorization: Authorization<string>) {
	const context = authorization.participationAuthority,
		authUserId = authorization.authUserId;
	if (
		!authUserId ||
		!context ||
		context.principal.kind !== "auth" ||
		context.principal.authUserId !== authUserId
	)
		throw new ParticipationDenied();
	await authorization.account.ensureCanWrite(tx);
	await ensureAccountAuthenticationAllowed(authUserId, tx);
	const [binding] = await tx
		.select({ entityId: authEntity.entityId })
		.from(authEntity)
		.where(
			and(
				eq(authEntity.authUserId, authUserId),
				eq(authEntity.entityId, authorization.profileId),
				eq(authEntity.state, "active"),
				eq(authEntity.revision, context.authorizationRevision),
			),
		)
		.limit(1)
		.for("share");
	if (!binding) throw new ParticipationDenied("Account self identity changed");
	// Personal choices use the actual account's self authority, regardless of an organization selection.
	return {
		authUserId,
		personal: new Authorization(binding.entityId, authUserId, {
			principal: context.principal,
			actingEntityId: binding.entityId,
			authorizationRevision: context.authorizationRevision,
		}),
	};
}

/** Save a private exclusion and its transport-validated tracking event atomically. @internal */
export async function saveRecommendationExclusion(
	tx: DatabaseTransaction,
	authorization: Authorization<string>,
	targetUnitId: string,
	event: Omit<RecommendationExclusionBody, "signature">,
) {
	z.uuid().parse(targetUnitId);
	const { authUserId, personal } = await admitExclusions(tx, authorization);
	const decision = await personal.unit.decideInTransaction(tx, targetUnitId, "unit.read");
	if (!decision.allowed) throw new UnitNotFound();
	const { reference } = await resolveRegisteredUnitReference(tx, targetUnitId);
	const targetReferenceId = await allocateReferenceValue(tx, reference);
	await tx
		.insert(recommendationExclusion)
		.values({ authUserId, targetReferenceId })
		.onConflictDoNothing();
	await tx
		.insert(recommendationEvent)
		.values({
			id: event.eventId,
			authUserId,
			requestId: event.requestId,
			surface: event.surface,
			type: "not_interested",
			targetReferenceId,
			position: event.position,
			policyVersion: event.policyVersion,
			occurredAt: event.occurredAt,
		})
		.onConflictDoNothing();
	return { excluded: true };
}

/** Remove only the actual account's choice, including after target visibility changes. @internal */
export async function removeRecommendationExclusion(
	tx: DatabaseTransaction,
	authorization: Authorization<string>,
	targetUnitId: string,
) {
	z.uuid().parse(targetUnitId);
	const { authUserId } = await admitExclusions(tx, authorization);
	const target = await findReferenceValueByNativeId(tx, targetUnitId);
	if (target)
		await tx
			.delete(recommendationExclusion)
			.where(
				and(
					eq(recommendationExclusion.authUserId, authUserId),
					eq(recommendationExclusion.targetReferenceId, target.valueId),
				),
			);
	return { excluded: false };
}
