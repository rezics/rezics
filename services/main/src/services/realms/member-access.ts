import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { getRealmRoleCapabilities, type RealmCapability } from "../authorization/realm/policy";
import { type DatabaseExecutor, type DatabaseTransaction } from "../database";
import {
	auditEvent,
	capabilityGrant,
	realmMember,
	RealmCapabilityValues,
} from "../database/schema";
import { CapabilityGrantExpiryInvalid } from "../api/governance/errors";
import { RealmMemberNotFound } from "../api/realms/errors";

export const RealmCapabilitySourceValues = ["role", "realm_grant", "platform"] as const;
export type RealmCapabilitySource = (typeof RealmCapabilitySourceValues)[number];

export interface RealmMemberCapabilityAccessItem {
	readonly capability: RealmCapability;
	readonly sources: RealmCapabilitySource[];
	readonly directGrant: {
		readonly grantedByProfileId: string;
		readonly expiresAt: Date | null;
	} | null;
}

export interface RealmMemberCapabilityAccess {
	readonly realmId: string;
	readonly profileId: string;
	readonly role: string;
	readonly capabilities: RealmMemberCapabilityAccessItem[];
}

function isRealmCapability(value: string): value is RealmCapability {
	return RealmCapabilityValues.some((capability) => capability === value);
}

export async function getRealmMemberCapabilityAccess(
	executor: DatabaseExecutor,
	realmId: string,
	profileId: string,
): Promise<RealmMemberCapabilityAccess> {
	const [membership] = await executor
		.select({ role: realmMember.role, state: realmMember.state })
		.from(realmMember)
		.where(and(eq(realmMember.realmId, realmId), eq(realmMember.profileId, profileId)))
		.limit(1);
	if (!membership || membership.state !== "active") throw new RealmMemberNotFound(true);
	const grants = await executor
		.select({
			authority: capabilityGrant.authority,
			capability: capabilityGrant.capability,
			grantedByProfileId: capabilityGrant.grantedByProfileId,
			expiresAt: capabilityGrant.expiresAt,
		})
		.from(capabilityGrant)
		.where(
			and(
				eq(capabilityGrant.profileId, profileId),
				inArray(capabilityGrant.capability, [...RealmCapabilityValues]),
				isNull(capabilityGrant.revokedAt),
				or(isNull(capabilityGrant.expiresAt), sql`${capabilityGrant.expiresAt} > now()`),
				or(
					and(
						eq(capabilityGrant.authority, "realm"),
						eq(capabilityGrant.realmId, realmId),
					),
					and(eq(capabilityGrant.authority, "platform"), isNull(capabilityGrant.realmId)),
				),
			),
		);
	const roleCapabilities = new Set(getRealmRoleCapabilities(membership.role));
	return {
		realmId,
		profileId,
		role: membership.role,
		capabilities: RealmCapabilityValues.map((capability) => {
			const directGrant = grants.find(
				(grant) =>
					grant.authority === "realm" &&
					isRealmCapability(grant.capability) &&
					grant.capability === capability,
			);
			const platformGrant = grants.some(
				(grant) =>
					grant.authority === "platform" &&
					isRealmCapability(grant.capability) &&
					grant.capability === capability,
			);
			const sources: RealmCapabilitySource[] = [];
			if (roleCapabilities.has(capability)) sources.push("role");
			if (directGrant) sources.push("realm_grant");
			if (platformGrant) sources.push("platform");
			return {
				capability,
				sources,
				directGrant: directGrant
					? {
							grantedByProfileId: directGrant.grantedByProfileId,
							expiresAt: directGrant.expiresAt,
						}
					: null,
			};
		}),
	};
}

export async function replaceRealmMemberCapabilityAccess(
	tx: DatabaseTransaction,
	input: {
		readonly actorProfileId: string;
		readonly realmId: string;
		readonly targetProfileId: string;
		readonly capabilities: readonly RealmCapability[];
		readonly expiresAt: Date | null;
	},
): Promise<RealmMemberCapabilityAccess> {
	const now = new Date();
	if (input.expiresAt && input.expiresAt <= now) throw new CapabilityGrantExpiryInvalid();
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`realm-member-access:${input.realmId}`}::text, 0))`,
	);
	await getRealmMemberCapabilityAccess(tx, input.realmId, input.targetProfileId);
	const existing = await tx
		.select({
			capability: capabilityGrant.capability,
			expiresAt: capabilityGrant.expiresAt,
			revokedAt: capabilityGrant.revokedAt,
		})
		.from(capabilityGrant)
		.where(
			and(
				eq(capabilityGrant.authority, "realm"),
				eq(capabilityGrant.realmId, input.realmId),
				eq(capabilityGrant.profileId, input.targetProfileId),
				inArray(capabilityGrant.capability, [...RealmCapabilityValues]),
			),
		);
	const activeExisting = existing.filter(
		(grant) => grant.revokedAt === null && (grant.expiresAt === null || grant.expiresAt > now),
	);
	const selected = new Set(input.capabilities);
	const before = activeExisting.flatMap((grant) =>
		isRealmCapability(grant.capability) ? [grant.capability] : [],
	);
	const removed = before.filter((capability) => !selected.has(capability));
	const expiresAtChanged = input.capabilities.some((capability) => {
		const grant = activeExisting.find((candidate) => candidate.capability === capability);
		return !grant || grant.expiresAt?.getTime() !== input.expiresAt?.getTime();
	});
	const changed =
		removed.length > 0 || before.length !== input.capabilities.length || expiresAtChanged;
	for (const capability of input.capabilities)
		await tx
			.insert(capabilityGrant)
			.values({
				authority: "realm",
				realmId: input.realmId,
				profileId: input.targetProfileId,
				capability,
				grantedByProfileId: input.actorProfileId,
				expiresAt: input.expiresAt,
			})
			.onConflictDoUpdate({
				target: [
					capabilityGrant.authority,
					capabilityGrant.realmId,
					capabilityGrant.profileId,
					capabilityGrant.capability,
				],
				set: {
					grantedByProfileId: input.actorProfileId,
					expiresAt: input.expiresAt,
					revokedAt: null,
					revokedByProfileId: null,
					updatedAt: now,
				},
			});
	if (removed.length)
		await tx
			.update(capabilityGrant)
			.set({
				revokedAt: now,
				revokedByProfileId: input.actorProfileId,
				updatedAt: now,
			})
			.where(
				and(
					eq(capabilityGrant.authority, "realm"),
					eq(capabilityGrant.realmId, input.realmId),
					eq(capabilityGrant.profileId, input.targetProfileId),
					inArray(capabilityGrant.capability, removed),
					isNull(capabilityGrant.revokedAt),
				),
			);
	if (changed)
		await tx.insert(auditEvent).values({
			actorProfileId: input.actorProfileId,
			action: "realm_member_access.replace",
			decisionCode: "allowed",
			subjectKind: "profile",
			subjectId: input.targetProfileId,
			metadata: {
				realmId: input.realmId,
				before,
				after: [...input.capabilities],
				expiresAt: input.expiresAt?.toISOString() ?? null,
			},
		});
	return getRealmMemberCapabilityAccess(tx, input.realmId, input.targetProfileId);
}
