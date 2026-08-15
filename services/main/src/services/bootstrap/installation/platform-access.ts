import { and, eq, isNull } from "drizzle-orm";

import type { DatabaseTransaction } from "../../database";
import { platformCapabilityGrant } from "../../database/schema";
import { recordAuditEvent } from "../../audit";
import { lockPlatformAccess } from "../../platform-access";
import { BootstrapPlatformAccessManifest } from "../data";
import { bootstrapEpoch } from "./common";

export async function ensureBootstrapPlatformAccess(tx: DatabaseTransaction): Promise<void> {
	await lockPlatformAccess(tx);
	const createdAt = bootstrapEpoch();
	for (const access of BootstrapPlatformAccessManifest)
		for (const capability of access.capabilities) {
			const [current] = await tx
				.select({
					id: platformCapabilityGrant.id,
					expiresAt: platformCapabilityGrant.expiresAt,
				})
				.from(platformCapabilityGrant)
				.where(
					and(
						eq(platformCapabilityGrant.profileId, access.profileId),
						eq(platformCapabilityGrant.capability, capability),
						isNull(platformCapabilityGrant.revokedAt),
					),
				)
				.limit(1);
			if (current?.expiresAt === null) continue;
			if (current)
				await tx
					.update(platformCapabilityGrant)
					.set({
						revokedAt: createdAt,
						revokedByProfileId: access.grantedByProfileId,
						updatedAt: createdAt,
					})
					.where(eq(platformCapabilityGrant.id, current.id));
			const [created] = await tx
				.insert(platformCapabilityGrant)
				.values({
					profileId: access.profileId,
					capability,
					grantedByProfileId: access.grantedByProfileId,
					createdAt,
					updatedAt: createdAt,
				})
				.returning({ id: platformCapabilityGrant.id });
			await recordAuditEvent(tx, {
				category: "system_event",
				outcome: "succeeded",
				actor: {
					kind: "profile",
					profileId: access.grantedByProfileId,
					credentialKind: "bootstrap",
				},
				authority: { kind: "platform" },
				action: "platform.access.bootstrap",
				target: {
					kind: "profile",
					id: access.profileId,
				},
				details: {
					capability,
					grantId: created?.id,
					replacedGrantId: current?.id,
					source: "bootstrap",
				},
				createdAt,
			});
		}
}
