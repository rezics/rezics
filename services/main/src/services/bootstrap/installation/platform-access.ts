import { and, eq } from "drizzle-orm";

import { recordAuditEvent } from "../../audit";
import type { DatabaseTransaction } from "../../database";
import { platformCapabilityGrant } from "../../database/schema";
import { lockPlatformAccess } from "../../platform-access";
import { BootstrapPlatformAccessManifest } from "../data";
import { bootstrapEpoch } from "./common";

export async function ensureBootstrapPlatformAccess(tx: DatabaseTransaction): Promise<void> {
	await lockPlatformAccess(tx);
	const createdAt = bootstrapEpoch();
	for (const access of BootstrapPlatformAccessManifest)
		for (const capability of access.capabilities) {
			const [existing] = await tx
				.select({ id: platformCapabilityGrant.id })
				.from(platformCapabilityGrant)
				.where(
					and(
						eq(platformCapabilityGrant.authUserId, access.authUserId),
						eq(platformCapabilityGrant.capability, capability),
					),
				)
				.limit(1);
			if (existing) continue;
			const [created] = await tx
				.insert(platformCapabilityGrant)
				.values({
					authUserId: access.authUserId,
					capability,
					grantedByAuthUserId: access.grantedByAuthUserId,
					createdAt,
					updatedAt: createdAt,
				})
				.returning({ id: platformCapabilityGrant.id });
			await recordAuditEvent(tx, {
				category: "system_event",
				outcome: "succeeded",
				actor: {
					kind: "auth",
					authUserId: access.grantedByAuthUserId,
					credentialKind: "bootstrap",
				},
				authority: { kind: "platform" },
				action: "platform.access.bootstrap",
				target: {
					kind: "auth",
					id: access.authUserId,
				},
				details: {
					capability,
					grantId: created?.id,
					source: "bootstrap",
				},
				createdAt,
			});
		}
}
