import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { recordAuditEvent } from "../../audit";
import { ensureAccountAuthenticationAllowed } from "../../auth/account-state";
import { database, type DatabaseExecutor } from "../../database";
import { platformCapabilityGrant, users } from "../../database/schema";
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

export type GrantedPlatformAccess = Extract<PlatformAccessDecision, { readonly allowed: true }>;

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
				eq(platformCapabilityGrant.authUserId, profileId),
				inArray(platformCapabilityGrant.capability, grantingCapabilities),
				isNull(platformCapabilityGrant.revokedAt),
				or(
					isNull(platformCapabilityGrant.expiresAt),
					sql`${platformCapabilityGrant.expiresAt} > statement_timestamp()`,
				),
			),
		)
		.orderBy(sql`${platformCapabilityGrant.capability} = ${capability} desc`)
		.limit(1)
		.for("share");
	if (grant?.expiresAt) {
		// The row-lock wait can outlive the candidate SELECT's statement timestamp.
		// Check expiry again after admission; the locked grant cannot be revoked meanwhile.
		const current = await executor.execute<{ active: boolean }>(sql`select
			${grant.expiresAt.toISOString()}::timestamptz > statement_timestamp() as active`);
		if (!current.rows[0]?.active) return { allowed: false, reason: "ungranted" };
	}
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

	constructor(
		readonly profileId: ProfileId,
		readonly authUserId?: string,
	) {}

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
		return this.authUserId
			? decideActivePlatformGrant(executor, this.authUserId, capability)
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
		if (!this.authUserId)
			return new Map(capabilities.map((capability) => [capability, false] as const));
		const grantingCapabilities = [
			...new Set(capabilities.flatMap((capability) => grantingPlatformCapabilities(capability))),
		];
		const grants = await executor
			.select({ capability: platformCapabilityGrant.capability })
			.from(platformCapabilityGrant)
			.where(
				and(
					eq(platformCapabilityGrant.authUserId, this.authUserId),
					inArray(platformCapabilityGrant.capability, grantingCapabilities),
					isNull(platformCapabilityGrant.revokedAt),
					or(
						isNull(platformCapabilityGrant.expiresAt),
						sql`${platformCapabilityGrant.expiresAt} > statement_timestamp()`,
					),
				),
			);
		const grantedCapabilities = new Set(grants.map(({ capability }) => capability));
		return new Map(
			capabilities.map(
				(capability) =>
					[
						capability,
						grantingPlatformCapabilities(capability).some((grantingCapability) =>
							grantedCapabilities.has(grantingCapability),
						),
					] as const,
			),
		);
	}

	/** Return the selected grant so a transaction can recheck its deadline after later waits. */
	async ensureCapability(
		capability: PlatformCapability,
		executor: DatabaseExecutor = database,
	): Promise<GrantedPlatformAccess> {
		if (!this.authUserId) throw new PlatformCapabilityRequired();
		const [account] = await executor
			.select({ id: users.id })
			.from(users)
			.where(eq(users.id, this.authUserId))
			.limit(1)
			.for("share");
		if (!account) throw new PlatformCapabilityRequired();
		await ensureAccountAuthenticationAllowed(this.authUserId, executor);
		const decision = await this.#decideCapability(executor, capability);
		if (decision.allowed) return decision;
		await recordAuditEvent(database, {
			category: "policy_denied",
			outcome: "denied",
			actor: { kind: "auth", authUserId: this.authUserId },
			authority: { kind: "platform" },
			action: "platform.authorization.denied",
			outcomeCode: decision.reason,
			details: { requiredCapability: capability },
		});
		throw new PlatformCapabilityRequired();
	}
}
