import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { recordAuditEvent } from "../../audit";
import { database, type DatabaseExecutor } from "../../database";
import { platformCapabilityGrant } from "../../database/schema";
import { PlatformCapabilityRequired } from "../errors";
import { grantingPlatformCapabilities, type PlatformCapability } from "./policy";

export type { PlatformCapability } from "./policy";

export type PlatformAccessDecision =
	| {
			readonly allowed: true;
			readonly source: "grant";
			readonly grantId: string;
			readonly grantedCapability: PlatformCapability;
			readonly expiresAt: Date | null;
	  }
	| { readonly allowed: false; readonly reason: "anonymous" | "ungranted" };

async function decideActivePlatformGrant(
	executor: DatabaseExecutor,
	profileId: string,
	capability: PlatformCapability,
): Promise<PlatformAccessDecision> {
	const grantingCapabilities = grantingPlatformCapabilities(capability);
	const [grant] = await executor
		.select({
			id: platformCapabilityGrant.id,
			capability: platformCapabilityGrant.capability,
			expiresAt: platformCapabilityGrant.expiresAt,
		})
		.from(platformCapabilityGrant)
		.where(
			and(
				eq(platformCapabilityGrant.profileId, profileId),
				inArray(platformCapabilityGrant.capability, grantingCapabilities),
				isNull(platformCapabilityGrant.revokedAt),
				or(
					isNull(platformCapabilityGrant.expiresAt),
					sql`${platformCapabilityGrant.expiresAt} > now()`,
				),
			),
		)
		.orderBy(sql`${platformCapabilityGrant.capability} = ${capability} desc`)
		.limit(1);
	return grant
		? {
				allowed: true,
				source: "grant",
				grantId: grant.id,
				grantedCapability: grant.capability,
				expiresAt: grant.expiresAt,
			}
		: { allowed: false, reason: "ungranted" };
}

export class PlatformAuthorization<ProfileId extends string | undefined> {
	readonly #decisions = new Map<PlatformCapability, Promise<PlatformAccessDecision>>();

	constructor(readonly profileId: ProfileId) {}

	decideCapability(capability: PlatformCapability): Promise<PlatformAccessDecision> {
		const current = this.#decisions.get(capability);
		if (current) return current;
		const decision = this.#decideCapability(database, capability);
		this.#decisions.set(capability, decision);
		return decision;
	}

	#decideCapability(
		executor: DatabaseExecutor,
		capability: PlatformCapability,
	): Promise<PlatformAccessDecision> {
		return this.profileId
			? decideActivePlatformGrant(executor, this.profileId, capability)
			: Promise.resolve({ allowed: false, reason: "anonymous" });
	}

	async hasCapability(
		capability: PlatformCapability,
		executor?: DatabaseExecutor,
	): Promise<boolean> {
		const decision = executor
			? await this.#decideCapability(executor, capability)
			: await this.decideCapability(capability);
		return decision.allowed;
	}

	async decideCapabilities<Capability extends PlatformCapability>(
		capabilities: readonly [Capability, ...Capability[]],
		executor: DatabaseExecutor = database,
	): Promise<ReadonlyMap<Capability, boolean>> {
		const decisions = await Promise.all(
			capabilities.map(
				async (capability) =>
					[capability, await this.hasCapability(capability, executor)] as const,
			),
		);
		return new Map(decisions);
	}

	async ensureCapability(
		this: PlatformAuthorization<string>,
		capability: PlatformCapability,
		executor: DatabaseExecutor = database,
	): Promise<void> {
		const decision = await this.#decideCapability(executor, capability);
		if (decision.allowed) return;
		await recordAuditEvent(database, {
			category: "policy_denied",
			outcome: "denied",
			actor: { kind: "profile", profileId: this.profileId },
			authority: { kind: "platform" },
			action: "platform.authorization.denied",
			reasonCode: decision.reason,
			details: { requiredCapability: capability },
		});
		throw new PlatformCapabilityRequired();
	}
}
