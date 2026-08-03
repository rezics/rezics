import type { User } from "better-auth";
import { and, eq } from "drizzle-orm";
import { DefaultStoredUiLocale, type UiLocale } from "@rezics/i18n";
import { OfficialRealmUnitIds } from "@rezics/slug";

import { ensureOfficialZoneFollows } from "../bootstrap/official-zone-follows";
import { ensureFavorites, ensureFavoritesInTransaction } from "../collections/favorites";
import { database } from "../database";
import { isFirstUnitLocalization } from "../units/localization";
import {
	profile,
	profileFavoritesCollection,
	profilePreference,
	realmMember,
	unit,
	unitOwnership,
	unitLocalization,
	users,
} from "../database/schema";
import {
	DefaultContentRatingValues,
	DefaultPreferredLanguage,
} from "../database/schema/contract-values";
import { recordUnitRevision } from "../units/history";
import { insertUnit } from "../units/create";

export interface SessionProfile {
	unitId: string;
	name: string | null;
	email: string | null;
}

interface StoredSessionProfile extends SessionProfile {
	favoritesId: string | null;
}

function presentSessionProfile({
	favoritesId: _favoritesId,
	...sessionProfile
}: StoredSessionProfile): SessionProfile {
	return sessionProfile;
}

async function findProfile(authUserId: string): Promise<StoredSessionProfile | undefined> {
	const [record] = await database
		.select({
			unitId: profile.id,
			name: unitLocalization.title,
			email: users.email,
			favoritesId: profileFavoritesCollection.collectionId,
		})
		.from(profile)
		.innerJoin(unit, eq(unit.id, profile.id))
		.innerJoin(users, eq(users.id, profile.authUserId))
		.leftJoin(
			unitLocalization,
			and(
				eq(unitLocalization.unitId, profile.id),
				isFirstUnitLocalization(unitLocalization.unitId),
			),
		)
		.leftJoin(profileFavoritesCollection, eq(profileFavoritesCollection.profileId, profile.id))
		.where(eq(profile.authUserId, authUserId))
		.limit(1);
	return record;
}

export async function ensureProfile(
	authUser: Pick<User, "id" | "email" | "name" | "image">,
	initialInterfaceLocale: UiLocale = DefaultStoredUiLocale,
) {
	const existing = await findProfile(authUser.id);
	if (existing) {
		if (!existing.favoritesId) await ensureFavorites(existing.unitId);
		return presentSessionProfile(existing);
	}
	const [registration] = await database
		.select({ contentLanguage: users.registrationContentLanguage })
		.from(users)
		.where(eq(users.id, authUser.id))
		.limit(1);
	const preferredLanguage = registration?.contentLanguage ?? DefaultPreferredLanguage;

	try {
		return await database.transaction(async (tx) => {
			const profileUnit = await insertUnit(tx, {
				kind: "profile",
				status: "published",
				visibility: "public",
				publishedAt: new Date(),
				statusActor: { kind: "system" },
			});
			await tx.insert(profile).values({
				id: profileUnit.id,
				authUserId: authUser.id,
			});
			await tx.insert(unitLocalization).values({
				unitId: profileUnit.id,
				language: preferredLanguage,
				title: authUser.name,
			});
			await tx.insert(profilePreference).values({
				profileId: profileUnit.id,
				interfaceLocale: initialInterfaceLocale,
				defaultScoreRealmId: OfficialRealmUnitIds.score,
				contentRatings: [...DefaultContentRatingValues],
				preferredLanguages: [preferredLanguage],
			});
			await tx.insert(realmMember).values({
				realmId: OfficialRealmUnitIds.score,
				profileId: profileUnit.id,
				state: "active",
			});
			await tx.insert(unitOwnership).values({
				unitId: profileUnit.id,
				profileId: profileUnit.id,
				assignedByProfileId: profileUnit.id,
			});
			await ensureOfficialZoneFollows(tx, [profileUnit.id], { sequenceIsEmpty: true });
			await ensureFavoritesInTransaction(tx, profileUnit.id);
			await recordUnitRevision(tx, {
				unitId: profileUnit.id,
				actorProfileId: profileUnit.id,
				event: "create",
			});
			return {
				unitId: profileUnit.id,
				name: authUser.name,
				email: authUser.email,
			};
		});
	} catch (error) {
		const raced = await findProfile(authUser.id);
		if (raced) {
			if (!raced.favoritesId) await ensureFavorites(raced.unitId);
			return presentSessionProfile(raced);
		}
		throw error;
	}
}
