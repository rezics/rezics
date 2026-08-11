import type { RealmUnitCreatePermission } from "@rezics/access";
import { and, eq } from "drizzle-orm";

import { database, type DatabaseExecutor, type DatabaseTransaction } from "../../database";
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
import { type RealmCapability } from "./policy";

async function findRequiredRulesAcceptance(
	realmId: string,
	profileId: string,
	executor: DatabaseExecutor = database,
): Promise<{ readonly realmId: string; readonly revisionId: string } | undefined> {
	const rules = await getCurrentRealmRules(realmId, executor);
	if (!rules?.revisionId || !rules.requireOnPost) return undefined;
	const [acknowledgement] = await executor
		.select({ revisionId: realmRuleAcknowledgementTable.revisionId })
		.from(realmRuleAcknowledgementTable)
		.where(
			and(
				eq(realmRuleAcknowledgementTable.revisionId, rules.revisionId),
				eq(realmRuleAcknowledgementTable.profileId, profileId),
			),
		)
		.limit(1);
	return acknowledgement ? undefined : { realmId, revisionId: rules.revisionId };
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

	async ensureCapabilityInTransaction(
		this: RealmAuthorization<string>,
		tx: DatabaseTransaction,
		realmId: string,
		capability: RealmCapability,
	): Promise<RealmMembership | undefined> {
		const current = await findRealmMembership(realmId, this.profileId, tx);
		const decision = await this.unit.decideInTransaction(tx, realmId, capability);
		if (decision.allowed || (await this.platform.hasCapability(capability, tx))) return current;
		throw new RealmCapabilityRequired();
	}

	async ensureParticipation(
		this: RealmAuthorization<string>,
		realmId: string | undefined,
	): Promise<void> {
		if (!realmId) return;
		await this.ensureMembershipCapability(realmId, "realm.contribute");
	}

	async ensureUnitCreation(
		this: RealmAuthorization<string>,
		realmIds: readonly string[],
		permission: RealmUnitCreatePermission,
	): Promise<void> {
		const normalizedRealmIds = [...new Set(realmIds)].sort();
		if (!normalizedRealmIds.length) return;
		await Promise.all(
			normalizedRealmIds.map((realmId) => this.ensureCapability(realmId, permission)),
		);
		const requirements = (
			await Promise.all(
				normalizedRealmIds.map((realmId) => findRequiredRulesAcceptance(realmId, this.profileId)),
			)
		).filter(
			(requirement): requirement is { readonly realmId: string; readonly revisionId: string } =>
				requirement !== undefined,
		);
		if (requirements.length) throw new RealmRulesAcceptanceRequired({ realms: requirements });
	}

	async ensureUnitCreationInTransaction(
		this: RealmAuthorization<string>,
		tx: DatabaseTransaction,
		realmIds: readonly string[],
		permission: RealmUnitCreatePermission,
	): Promise<void> {
		const normalizedRealmIds = [...new Set(realmIds)].sort();
		for (const realmId of normalizedRealmIds) {
			await this.ensureCapabilityInTransaction(tx, realmId, permission);
			const requirement = await findRequiredRulesAcceptance(realmId, this.profileId, tx);
			if (requirement) throw new RealmRulesAcceptanceRequired({ realms: [requirement] });
		}
	}
}
