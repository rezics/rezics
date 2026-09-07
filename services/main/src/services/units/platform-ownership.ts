import { and, eq, gt, isNull, notExists, or, sql } from "drizzle-orm";

import { UnitOwnershipChanged, UnitOwnershipTargetIneligible } from "../api/governance/errors";
import { recordAuditEvent } from "../audit";
import type { PlatformAuthorization } from "../authorization/platform/authorization";
import { lockUnitAccessState } from "../authorization/unit/invitations";
import { replaceUnitOwnership } from "../authorization/unit/ownership";
import { database, type DatabaseTransaction } from "../database";
import { entityIdentity, unit, unitOwnership, unitSlugAddress } from "../database/schema";
import {
	createGovernanceDecision,
	type GovernanceRuleReference,
} from "../governance/decision-service";
import { createNotification } from "../notifications/service";
import { UnitNotFound } from "./errors";
import { firstUnitLocalizationTitle } from "./localization";

function canonicalProfileSlug(profileId: typeof entityIdentity.id) {
	return sql<string | null>`(
		select ${unitSlugAddress.slug}
		from ${unitSlugAddress}
		where ${unitSlugAddress.targetUnitId} = ${profileId}
			and ${unitSlugAddress.kind} = 'canonical'
		order by ${unitSlugAddress.scopeUnitId} nulls first
		limit 1
	)`;
}

async function ensurePlatformUnitExists(unitId: string): Promise<void> {
	const [record] = await database
		.select({ id: unit.id })
		.from(unit)
		.where(eq(unit.id, unitId))
		.limit(1);
	if (!record) throw new UnitNotFound();
}

export async function listPlatformOwnershipCandidates(input: {
	readonly unitId: string;
	readonly query?: string;
	readonly cursor?: string;
	readonly limit: number;
}) {
	await ensurePlatformUnitExists(input.unitId);
	const search = input.query?.trim();
	const slug = canonicalProfileSlug(entityIdentity.id);
	const rows = await database
		.select({
			profileId: entityIdentity.id,
			label: firstUnitLocalizationTitle(entityIdentity.id),
			slug,
		})
		.from(entityIdentity)
		.innerJoin(unit, eq(unit.id, entityIdentity.id))
		.where(
			and(
				isNull(unit.deletedAt),
				input.cursor ? gt(entityIdentity.id, input.cursor) : undefined,
				notExists(
					database
						.select({ id: unitOwnership.id })
						.from(unitOwnership)
						.where(
							and(
								eq(unitOwnership.unitId, input.unitId),
								eq(unitOwnership.profileId, entityIdentity.id),
								isNull(unitOwnership.revokedAt),
							),
						),
				),
				search
					? or(
							sql`${entityIdentity.id}::text ilike ${`%${search}%`}`,
							sql`coalesce(${firstUnitLocalizationTitle(entityIdentity.id)}, '') ilike ${`%${search}%`}`,
							sql`coalesce(${slug}, '') ilike ${`%${search}%`}`,
						)
					: undefined,
			),
		)
		.orderBy(entityIdentity.id)
		.limit(input.limit + 1);
	const items = rows.slice(0, input.limit);
	return {
		items,
		nextCursor: rows.length > input.limit ? (items.at(-1)?.profileId ?? null) : null,
	};
}

async function lockUnit(tx: DatabaseTransaction, unitId: string): Promise<void> {
	const [record] = await tx
		.select({ id: unit.id })
		.from(unit)
		.where(eq(unit.id, unitId))
		.limit(1)
		.for("update");
	if (!record) throw new UnitNotFound();
}

async function eligibleTarget(
	tx: DatabaseTransaction,
	profileId: string,
): Promise<{ readonly profileId: string; readonly label: string | null } | undefined> {
	const [target] = await tx
		.select({
			profileId: entityIdentity.id,
			label: firstUnitLocalizationTitle(entityIdentity.id),
		})
		.from(entityIdentity)
		.innerJoin(unit, eq(unit.id, entityIdentity.id))
		.where(and(eq(entityIdentity.id, profileId), isNull(unit.deletedAt)))
		.limit(1);
	return target;
}

export async function overridePlatformUnitOwnership(
	authorization: PlatformAuthorization<string>,
	input: {
		readonly unitId: string;
		readonly actorProfileId: string;
		readonly expectedOwnerProfileId: string | null;
		readonly targetProfileId: string;
		readonly rules: readonly GovernanceRuleReference[];
		readonly note?: string;
	},
) {
	return database.transaction(async (tx) => {
		await lockUnitAccessState(tx, [input.unitId]);
		await authorization.ensureCapability("unit.ownership.override", tx);
		await lockUnit(tx, input.unitId);
		const target = await eligibleTarget(tx, input.targetProfileId);
		if (!target) throw new UnitOwnershipTargetIneligible();
		const decision = await createGovernanceDecision(tx, {
			action: "unit.ownership.override",
			actorProfileId: input.actorProfileId,
			authority: { kind: "platform" },
			targetUnitId: input.unitId,
			subject: { kind: "unit_ownership", id: input.unitId },
			basis: { kind: "rules", rules: input.rules },
		});

		const replaced = await replaceUnitOwnership(tx, {
			unitId: input.unitId,
			expectedOwnerProfileId: input.expectedOwnerProfileId,
			targetProfileId: input.targetProfileId,
			actorProfileId: input.actorProfileId,
			now: new Date(),
		});
		if (!replaced.ok) {
			if (replaced.reason === "owner_unchanged") throw new UnitOwnershipTargetIneligible();
			throw new UnitOwnershipChanged();
		}

		await recordAuditEvent(tx, {
			category: "admin_activity",
			outcome: "succeeded",
			actor: { kind: "profile", profileId: input.actorProfileId },
			authority: { kind: "platform" },
			action: "unit.ownership.override",
			governanceDecisionId: decision.id,
			target: { kind: "unit", id: input.unitId },
			details: {
				previousOwnerProfileId: replaced.previousOwnerProfileId,
				ownerProfileId: target.profileId,
				...(input.note ? { note: input.note } : {}),
			},
		});
		if (replaced.previousOwnerProfileId)
			await createNotification(tx, {
				kind: "system",
				recipientEntityId: replaced.previousOwnerProfileId,
				actorProfileId: input.actorProfileId,
				subjectUnitId: input.unitId,
				dedupeKey: `unit-ownership-override:${replaced.ownershipId}:previous`,
				payload: {
					type: "system_event",
					event: "unit_ownership_override",
					references: {
						ownershipId: replaced.ownershipId,
						role: "previous_owner",
					},
				},
			});
		await createNotification(tx, {
			kind: "system",
			recipientEntityId: target.profileId,
			actorProfileId: input.actorProfileId,
			subjectUnitId: input.unitId,
			dedupeKey: `unit-ownership-override:${replaced.ownershipId}:owner`,
			payload: {
				type: "system_event",
				event: "unit_ownership_override",
				references: {
					ownershipId: replaced.ownershipId,
					role: "owner",
				},
			},
		});
		return { owner: target };
	});
}
