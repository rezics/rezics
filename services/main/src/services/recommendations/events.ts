import { and, eq, inArray, sql } from "drizzle-orm";
import { Value } from "typebox/value";
import type { Authorization } from "../authorization";
import { lockUnitAccessState } from "../authorization/unit/access-lock";
import { ensureAccountAuthenticationAllowed } from "../auth/account-state";
import type { DatabaseTransaction } from "../database";
import {
	users,
	authEntity,
	accountPreference,
	recommendationEvent,
	unitAccessGrant,
	participationGrant,
	platformCapabilityGrant,
} from "../database/schema";
import { ParticipationDenied } from "../participation/policy";
import { UnitNotFound } from "../units/errors";
import { readUnitStateById } from "../units/query";
import { ValidationError } from "../api/errors";
import { RecommendationEventBatchBody } from "../api/recommendations/schema";
import { verifyRecommendationTracking } from "./tracking";

/** Record bounded read telemetry under current account, preference and target authority. @internal */
export async function recordRecommendationEvents(
	tx: DatabaseTransaction,
	authorization: Authorization,
	input: RecommendationEventBatchBody["events"],
) {
	let events: RecommendationEventBatchBody["events"];
	try {
		({ events } = Value.Decode(
			RecommendationEventBatchBody,
			Value.Encode(RecommendationEventBatchBody, { events: input }),
		));
	} catch {
		throw new ValidationError({ events: "Invalid recommendation event batch" });
	}
	for (const event of events)
		if (!verifyRecommendationTracking(event.targetUnitId, event))
			throw new ValidationError({ tracking: "invalid recommendation tracking signature" });
	const accountId = authorization.authUserId,
		context = authorization.participationAuthority;
	let attribution: string | null = null;
	if (accountId) {
		if (
			!context ||
			context.principal.kind !== "auth" ||
			context.principal.authUserId !== accountId ||
			!authorization.profileId
		)
			throw new ParticipationDenied();
		const [account] = await tx
			.select({ id: users.id })
			.from(users)
			.where(eq(users.id, accountId))
			.limit(1)
			.for("share");
		if (!account) throw new ParticipationDenied();
		await ensureAccountAuthenticationAllowed(accountId, tx);
		const [self] = await tx
			.select({ id: authEntity.entityId })
			.from(authEntity)
			.where(
				and(
					eq(authEntity.authUserId, accountId),
					eq(authEntity.entityId, authorization.profileId),
					eq(authEntity.state, "active"),
					eq(authEntity.revision, context.authorizationRevision),
				),
			)
			.limit(1)
			.for("share");
		if (!self) throw new ParticipationDenied("Account self identity changed");
		const [preference] = await tx
			.select({ personalized: accountPreference.personalizedFeed })
			.from(accountPreference)
			.where(eq(accountPreference.authUserId, accountId))
			.limit(1)
			.for("share");
		attribution = (preference?.personalized ?? true) ? accountId : null;
	} else if (authorization.profileId || context) throw new ParticipationDenied();
	const targets = [...new Set(events.map((event) => event.targetUnitId))].sort();
	await lockUnitAccessState(tx, targets, "shared");
	for (const id of targets) {
		const state = await readUnitStateById(tx, id, { lock: "share" });
		if (!state || state.moderationStatus !== "approved") throw new UnitNotFound();
	}
	const directGrants: string[] = [],
		platformGrants: string[] = [];
	let usesNativeGrant = false;
	for (const id of targets) {
		const decision = await authorization.unit.decideInTransaction(tx, id, "unit.read");
		if (!decision.allowed) throw new UnitNotFound();
		if (decision.source === "native") usesNativeGrant = true;
		if (decision.source === "grant") directGrants.push(decision.grantId);
		if (decision.source === "platform")
			platformGrants.push((await authorization.platform.ensureCapability("unit.edit", tx)).grantId);
	}
	const {
		rows: [clock],
	} = await tx.execute<{ now: Date; expired: boolean }>(sql`select statement_timestamp() as now,
  exists(select 1 from ${unitAccessGrant} where ${directGrants.length ? inArray(unitAccessGrant.id, directGrants) : sql`false`} and ${unitAccessGrant.expiresAt}<=statement_timestamp())
  or exists(select 1 from ${participationGrant} where ${usesNativeGrant && context?.grant ? eq(participationGrant.id, context.grant.id) : sql`false`} and ${participationGrant.expiresAt}<=statement_timestamp())
  or exists(select 1 from ${platformCapabilityGrant} where ${platformGrants.length ? inArray(platformCapabilityGrant.id, platformGrants) : sql`false`} and ${platformCapabilityGrant.expiresAt}<=statement_timestamp()) as expired`);
	if (!clock) throw new Error("Event intake deadline query returned no row");
	if (clock.expired) throw new ParticipationDenied("Read authority expired before event intake");
	const now = new Date(clock.now).getTime();
	for (const event of events)
		if (event.occurredAt.getTime() < now - 86400000 || event.occurredAt.getTime() > now + 300000)
			throw new ValidationError({
				occurredAt: "must be within the last 24 hours and no more than 5 minutes ahead",
			});
	const inserted = await tx
		.insert(recommendationEvent)
		.values(
			events.map((event) => ({
				id: event.id,
				authUserId: attribution,
				requestId: event.requestId,
				surface: event.surface,
				type: event.type,
				targetUnitId: event.targetUnitId,
				position: event.position,
				policyVersion: event.policyVersion,
				occurredAt: event.occurredAt,
			})),
		)
		.onConflictDoNothing()
		.returning({ id: recommendationEvent.id });
	return { accepted: inserted.length };
}
