import { and, eq } from "drizzle-orm";

import type { DatabaseTransaction } from "../../database";
import { accounts, profile, profilePreference, users } from "../../database/schema";
import { ensureFixedFavoritesInTransaction } from "../../collections/favorites";
import { fractionalPositionAt } from "../../ordering/position";
import { recordUnitRevision } from "../../units/history";
import { preparePlatformCredential, type IssuedPlatformCredential } from "../credentials";
import { BootstrapProfileManifest, TopLevelSlugNamespaceUnitIds } from "../data";
import {
	assertFields,
	bootstrapEpoch,
	ensureBootstrapAddressedUnit,
	ensureOwnership,
	insertStarterLocalization,
} from "./common";

export async function ensureBootstrapProfiles(
	tx: DatabaseTransaction,
): Promise<IssuedPlatformCredential[]> {
	const createdAt = bootstrapEpoch();
	const issuedCredentials: IssuedPlatformCredential[] = [];
	for (const value of BootstrapProfileManifest) {
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

		const createdUnit = await ensureBootstrapAddressedUnit(tx, {
			id: value.profileId,
			kind: "profile",
			scopeUnitId: TopLevelSlugNamespaceUnitIds.users,
			slug: value.slug,
		});
		await tx
			.insert(profile)
			.values({
				id: value.profileId,
				authUserId: value.authUserId,
				joinedAt: createdAt,
				createdAt,
				updatedAt: createdAt,
			})
			.onConflictDoNothing();
		const [storedProfile] = await tx
			.select({ id: profile.id, authUserId: profile.authUserId })
			.from(profile)
			.where(eq(profile.id, value.profileId))
			.limit(1);
		assertFields(`Profile ${value.key}`, storedProfile, {
			id: value.profileId,
			authUserId: value.authUserId,
		});
		if (createdUnit)
			for (const [index, localization] of value.localizations.entries())
				await insertStarterLocalization(tx, {
					unitId: value.profileId,
					position: fractionalPositionAt(index),
					...localization,
				});
		await tx
			.insert(profilePreference)
			.values({ profileId: value.profileId, createdAt, updatedAt: createdAt })
			.onConflictDoNothing();
		await ensureOwnership(tx, value.profileId, value.profileId);
		if (createdUnit)
			await recordUnitRevision(tx, {
				unitId: value.profileId,
				actorProfileId: value.profileId,
				event: "create",
				message: "Bootstrap Profile",
			});
	}
	return issuedCredentials;
}

export async function ensureBootstrapProfileFavorites(tx: DatabaseTransaction): Promise<void> {
	for (const bootstrapProfile of BootstrapProfileManifest)
		await ensureFixedFavoritesInTransaction(tx, {
			profileId: bootstrapProfile.profileId,
			collectionId: bootstrapProfile.favoritesCollectionId,
			createdAt: bootstrapEpoch(),
		});
}
