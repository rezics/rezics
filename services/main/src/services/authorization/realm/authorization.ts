import { and, eq } from "drizzle-orm";

import { database } from "../../database";
import {
	realm as realmTable,
	realmRuleAcceptance as realmRuleAcknowledgementTable,
} from "../../database/schema";
import {
	findRealmMembership,
	getCurrentRealmRules,
	type RealmMembership,
} from "../../realms/service";
import { RealmCapabilityRequired, RealmRulesAcceptanceRequired } from "../errors";
import type { PlatformAuthorization } from "../platform/authorization";
import type { UnitAuthorization } from "../unit/authorization";
import {
	shouldRequireRealmRuleAcknowledgement,
	type RealmCapability,
	type RealmRuleTrigger,
} from "./policy";

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
		private readonly unit: UnitAuthorization<ProfileId>,
	) {}

	async decideCapabilities<Capability extends RealmCapability>(
		realmId: string,
		capabilities: readonly [Capability, ...Capability[]],
	): Promise<ReadonlyMap<Capability, boolean>> {
		const denied = () => new Map(capabilities.map((capability) => [capability, false]));
		const [record] = await database
			.select({ id: realmTable.id })
			.from(realmTable)
			.where(eq(realmTable.id, realmId))
			.limit(1);
		if (!record || !this.profileId) return denied();
		const decisions = await Promise.all(
			capabilities.map(async (capability) => {
				const [unitDecision, platformDecision] = await Promise.all([
					this.unit.decide(realmId, capability),
					this.platform.hasCapability(capability),
				]);
				return [capability, unitDecision.allowed || platformDecision] as const;
			}),
		);
		return new Map(decisions);
	}

	async ensureMembershipCapability(
		this: RealmAuthorization<string>,
		realmId: string,
		capability: RealmCapability,
	): Promise<RealmMembership> {
		const current = await findRealmMembership(realmId, this.profileId);
		if (!current || current.state !== "active") throw new RealmCapabilityRequired();
		await this.ensureCapability(realmId, capability);
		return current;
	}

	async ensureCapability(
		this: RealmAuthorization<string>,
		realmId: string,
		capability: RealmCapability,
	): Promise<RealmMembership | undefined> {
		const current = await findRealmMembership(realmId, this.profileId);
		const [decision, platformDecision] = await Promise.all([
			this.unit.decide(realmId, capability),
			this.platform.hasCapability(capability),
		]);
		if (decision.allowed || platformDecision) return current;
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
}
