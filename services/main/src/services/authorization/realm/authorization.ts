import { and, eq, isNull, or, sql } from "drizzle-orm";

import { database } from "../../database";
import {
	capabilityGrant,
	realm as realmTable,
	realmRuleAcceptance as realmRuleAcknowledgementTable,
} from "../../database/schema";
import {
	findRealmMembership,
	getCurrentRealmRules,
	type RealmMembership,
} from "../../realms/service";
import {
	RealmCapabilityRequired,
	RealmRoleManagementForbidden,
	RealmRulesAcceptanceRequired,
} from "../errors";
import type { PlatformAuthorization } from "../platform/authorization";
import {
	canManageRealmMember,
	canRealmRolePerform,
	shouldRequireRealmRuleAcknowledgement,
	type RealmCapability,
	type RealmRuleTrigger,
} from "./policy";

async function hasActiveRealmCapabilityGrant(
	realmId: string,
	profileId: string,
	capability: RealmCapability,
) {
	const [grant] = await database
		.select({ id: capabilityGrant.id })
		.from(capabilityGrant)
		.where(
			and(
				eq(capabilityGrant.authority, "realm"),
				eq(capabilityGrant.realmId, realmId),
				eq(capabilityGrant.profileId, profileId),
				eq(capabilityGrant.capability, capability),
				isNull(capabilityGrant.revokedAt),
				or(isNull(capabilityGrant.expiresAt), sql`${capabilityGrant.expiresAt} > now()`),
			),
		)
		.limit(1);
	return Boolean(grant);
}

async function hasMembershipCapability(
	current: RealmMembership | undefined,
	capability: RealmCapability,
) {
	if (!current || current.state !== "active") return false;
	return (
		canRealmRolePerform(current.role, capability) ||
		(await hasActiveRealmCapabilityGrant(current.realmId, current.profileId, capability))
	);
}

async function ensureRulesAccepted(
	realmId: string,
	profileId: string,
	trigger: RealmRuleTrigger,
): Promise<void> {
	const rules = await getCurrentRealmRules(realmId);
	if (!rules?.revisionId || !shouldRequireRealmRuleAcknowledgement(trigger, rules)) return;
	const [acknowledgement] = await database
		.select({ revisionId: realmRuleAcknowledgementTable.revisionId })
		.from(realmRuleAcknowledgementTable)
		.where(
			and(
				eq(realmRuleAcknowledgementTable.revisionId, rules.revisionId),
				eq(realmRuleAcknowledgementTable.profileId, profileId),
			),
		)
		.limit(1);
	if (!acknowledgement) throw new RealmRulesAcceptanceRequired(rules);
}

export class RealmAuthorization<ProfileId extends string | undefined> {
	constructor(
		readonly profileId: ProfileId,
		private readonly platform: PlatformAuthorization<ProfileId>,
	) {}

	async ensureMembershipCapability(
		this: RealmAuthorization<string>,
		realmId: string,
		capability: RealmCapability,
	): Promise<RealmMembership> {
		const current = await findRealmMembership(realmId, this.profileId);
		if (!current || !(await hasMembershipCapability(current, capability)))
			throw new RealmCapabilityRequired();
		return current;
	}

	async ensureCapability(
		this: RealmAuthorization<string>,
		realmId: string,
		capability: RealmCapability,
	): Promise<RealmMembership | undefined> {
		const current = await findRealmMembership(realmId, this.profileId);
		if (await hasMembershipCapability(current, capability)) return current;
		if (await this.platform.hasCapability(capability)) {
			const [realm] = await database
				.select({ id: realmTable.id })
				.from(realmTable)
				.where(eq(realmTable.id, realmId))
				.limit(1);
			if (realm) return current;
		}
		throw new RealmCapabilityRequired();
	}

	async ensureParticipation(
		this: RealmAuthorization<string>,
		realmId: string | undefined,
		trigger?: RealmRuleTrigger,
	): Promise<void> {
		if (!realmId) return;
		await this.ensureMembershipCapability(realmId, "realm.contribute");
		if (trigger) await ensureRulesAccepted(realmId, this.profileId, trigger);
	}

	ensureCanManageMember(actorRole: string, targetRole: string, nextRole?: string): void {
		if (!canManageRealmMember(actorRole, targetRole))
			throw new RealmRoleManagementForbidden("manage");
		if (nextRole && !canManageRealmMember(actorRole, targetRole, nextRole))
			throw new RealmRoleManagementForbidden("grant");
	}
}
