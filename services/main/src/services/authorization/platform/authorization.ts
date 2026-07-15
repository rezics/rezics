import { and, eq, isNull, or, sql } from "drizzle-orm";

import { database } from "../../database";
import { capabilityGrant, PlatformCapabilityValues } from "../../database/schema";
import { PlatformCapabilityRequired } from "../errors";

export type PlatformCapability = (typeof PlatformCapabilityValues)[number];

async function hasActivePlatformGrant(profileId: string, capability: PlatformCapability) {
	const [grant] = await database
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

	hasCapability(capability: PlatformCapability): Promise<boolean> {
		return this.profileId
			? hasActivePlatformGrant(this.profileId, capability)
			: Promise.resolve(false);
	}

	async ensureCapability(
		this: PlatformAuthorization<string>,
		capability: PlatformCapability,
	): Promise<void> {
		if (!(await this.hasCapability(capability))) throw new PlatformCapabilityRequired();
	}
}
