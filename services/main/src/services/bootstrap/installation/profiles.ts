import { and, eq } from "drizzle-orm";

import { ensureFixedFavoritesInTransaction } from "../../collections/favorites";
import type { DatabaseTransaction } from "../../database";
import { accountPreference, accounts, entityIdentity, users } from "../../database/schema";
import {
	authEntity,
	participationGrant,
	participationGrantEvent,
} from "../../database/schema/participation";
import { createParticipantIdentity } from "../../participation/identity";
import { preparePlatformCredential, type IssuedPlatformCredential } from "../credentials";
import {
	BootstrapAccountManifest,
	BootstrapPlatformAdministratorProfile,
	BootstrapProfileManifest,
} from "../data";
import { assertFields, bootstrapEpoch } from "./common";

export async function ensureBootstrapProfiles(
	tx: DatabaseTransaction,
): Promise<IssuedPlatformCredential[]> {
	const createdAt = bootstrapEpoch();
	const issuedCredentials: IssuedPlatformCredential[] = [];
	for (const value of BootstrapAccountManifest) {
		await tx
			.insert(users)
			.values({
				id: value.authUserId,
				name: value.name,
				email: value.email,
				emailVerified: true,
				createdAt,
				updatedAt: createdAt,
			})
			.onConflictDoNothing();
		const [storedUser] = await tx
			.select({ id: users.id })
			.from(users)
			.where(eq(users.id, value.authUserId))
			.limit(1);
		assertFields(`auth user ${value.key}`, storedUser, { id: value.authUserId });

		const [storedAccount] = await tx
			.select({
				id: accounts.id,
				accountId: accounts.accountId,
				providerId: accounts.providerId,
				userId: accounts.userId,
			})
			.from(accounts)
			.where(and(eq(accounts.providerId, "credential"), eq(accounts.accountId, value.authUserId)))
			.limit(1);
		if (storedAccount) {
			assertFields(`credential account ${value.key}`, storedAccount, {
				id: value.accountId,
				accountId: value.authUserId,
				providerId: "credential",
				userId: value.authUserId,
			});
		} else {
			const prepared = await preparePlatformCredential();
			await tx.insert(accounts).values({
				id: value.accountId,
				accountId: value.authUserId,
				providerId: "credential",
				userId: value.authUserId,
				password: prepared.passwordHash,
				createdAt,
				updatedAt: createdAt,
			});
			issuedCredentials.push({
				action: "created",
				name: value.name,
				email: value.email,
				password: prepared.password,
			});
		}
	}
	const operator = BootstrapPlatformAdministratorProfile;
	for (const value of BootstrapProfileManifest) {
		const [stored] = await tx
			.select({ id: entityIdentity.id, shape: entityIdentity.shape })
			.from(entityIdentity)
			.where(eq(entityIdentity.id, value.profileId))
			.limit(1);
		const shape = value.key === "platformAdministrator" ? "person" : "organization";
		if (stored) assertFields(`Entity ${value.key}`, stored, { id: value.profileId, shape });
		else
			await createParticipantIdentity(tx, {
				id: value.profileId,
				shape,
				operatorAuthUserId: operator.authUserId,
				names: value.localizations.map((name) => ({ language: name.language, value: name.title })),
			});
	}
	await tx
		.insert(authEntity)
		.values({ authUserId: operator.authUserId, entityId: operator.profileId })
		.onConflictDoNothing();
	for (const value of BootstrapAccountManifest)
		await tx
			.insert(accountPreference)
			.values({ authUserId: value.authUserId, createdAt, updatedAt: createdAt })
			.onConflictDoNothing();
	for (const value of BootstrapProfileManifest) {
		if (value.key === "platformAdministrator") continue;
		for (const capability of ["entity.publish", "entity.membership", "entity.security"] as const) {
			const [existing] = await tx
				.select({ id: participationGrant.id })
				.from(participationGrant)
				.where(
					and(
						eq(participationGrant.authUserId, operator.authUserId),
						eq(participationGrant.actingEntityId, value.profileId),
						eq(participationGrant.capability, capability),
					),
				)
				.limit(1);
			if (existing) continue;
			const [grant] = await tx
				.insert(participationGrant)
				.values({
					authUserId: operator.authUserId,
					actingEntityId: value.profileId,
					entityId: value.profileId,
					capability,
					createdByAuthUserId: operator.authUserId,
				})
				.returning({ id: participationGrant.id });
			if (!grant) throw new Error("Bootstrap Entity grant insertion failed");
			await tx
				.insert(participationGrantEvent)
				.values({
					grantId: grant.id,
					revision: 1,
					operation: "grant",
					operatorAuthUserId: operator.authUserId,
				});
		}
	}
	return issuedCredentials;
}

export async function ensureBootstrapProfileFavorites(tx: DatabaseTransaction): Promise<void> {
	for (const bootstrapProfile of BootstrapAccountManifest)
		await ensureFixedFavoritesInTransaction(tx, {
			profileId: bootstrapProfile.profileId,
			collectionId: bootstrapProfile.favoritesCollectionId,
			createdAt: bootstrapEpoch(),
		});
}
