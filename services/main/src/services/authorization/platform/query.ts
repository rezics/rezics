import { and, eq, exists, inArray, isNull, or, sql } from "drizzle-orm";

import { database } from "../../database";
import { platformCapabilityGrant } from "../../database/schema";
import type { PlatformCapability } from "./policy";
import { grantingPlatformCapabilities } from "./policy";

/** Return the SQL predicate equivalent of an active Platform capability decision. */
export function getPlatformCapabilityCondition(profileId: string, capability: PlatformCapability) {
	return exists(
		database
			.select({ id: platformCapabilityGrant.id })
			.from(platformCapabilityGrant)
			.where(
				and(
					eq(platformCapabilityGrant.profileId, profileId),
					inArray(platformCapabilityGrant.capability, grantingPlatformCapabilities(capability)),
					isNull(platformCapabilityGrant.revokedAt),
					or(
						isNull(platformCapabilityGrant.expiresAt),
						sql`${platformCapabilityGrant.expiresAt} > now()`,
					),
				),
			),
	);
}
