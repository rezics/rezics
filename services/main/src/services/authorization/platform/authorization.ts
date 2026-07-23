import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { database, type DatabaseExecutor } from "../../database";
import { capabilityGrant } from "../../database/schema";
import { PlatformCapabilityRequired } from "../errors";
import type { PlatformCapability } from "./policy";

export type { PlatformCapability } from "./policy";

async function hasActivePlatformGrant(
	executor: DatabaseExecutor,
	profileId: string,
	capability: PlatformCapability,
) {
	const [grant] = await executor
		.select({ id: capabilityGrant.id })
		.from(capabilityGrant)
		.where(
			and(
				eq(capabilityGrant.authority, "platform"),
				eq(capabilityGrant.profileId, profileId),
				eq(capabilityGrant.capability, capability),
				isNull(capabilityGrant.revokedAt),
				or(isNull(capabilityGrant.expiresAt), sql`${capabilityGrant.expiresAt} > now()`),
				isNull(capabilityGrant.realmId),
			),
		)
		.limit(1);
	return Boolean(grant);
}

export class PlatformAuthorization<ProfileId extends string | undefined> {
	constructor(readonly profileId: ProfileId) {}

	hasCapability(
		capability: PlatformCapability,
		executor: DatabaseExecutor = database,
	): Promise<boolean> {
		return this.profileId
			? hasActivePlatformGrant(executor, this.profileId, capability)
			: Promise.resolve(false);
	}

	async decideCapabilities<Capability extends PlatformCapability>(
		capabilities: readonly [Capability, ...Capability[]],
		executor: DatabaseExecutor = database,
	): Promise<ReadonlyMap<Capability, boolean>> {
		if (!this.profileId) return new Map(capabilities.map((capability) => [capability, false]));
		const grants = await executor
			.select({ capability: capabilityGrant.capability })
			.from(capabilityGrant)
			.where(
				and(
					eq(capabilityGrant.authority, "platform"),
					isNull(capabilityGrant.realmId),
					eq(capabilityGrant.profileId, this.profileId),
					inArray(capabilityGrant.capability, capabilities),
					isNull(capabilityGrant.revokedAt),
					or(
						isNull(capabilityGrant.expiresAt),
						sql`${capabilityGrant.expiresAt} > now()`,
					),
				),
			);
		const granted = new Set(grants.map(({ capability }) => capability));
		return new Map(capabilities.map((capability) => [capability, granted.has(capability)]));
	}

	async ensureCapability(
		this: PlatformAuthorization<string>,
		capability: PlatformCapability,
	): Promise<void> {
		if (!(await this.hasCapability(capability))) throw new PlatformCapabilityRequired();
	}
}
