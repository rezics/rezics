import { and, eq } from "drizzle-orm";
import { PortableTextDocument, parseNullableDocument } from "@rezics/block";
import type { ContentLanguage } from "@rezics/i18n";

import { database } from "../../database";
import {
	avatarReferenceFromColumns,
	resolvedUnitLocalizationLanguage,
} from "../../units/localization";
import { profile as profileTable, unit, unitLocalization } from "../../database/schema";
import { presentAvatar } from "../../units/avatar";
import { presentImageAsset } from "../../units/service";
import { getPublicCanonicalUnitSlugAddress } from "../../units/slug-address";
import { ProfileNotFound } from "./errors";

export const PublicProfileSelection = {
	id: unit.id,
	status: unit.status,
	visibility: unit.visibility,
	language: unitLocalization.language,
	name: unitLocalization.title,
	avatarType: unitLocalization.avatarType,
	avatarAssetId: unitLocalization.avatarAssetId,
	avatarEmoji: unitLocalization.avatarEmoji,
	avatarIconPrefix: unitLocalization.avatarIconPrefix,
	avatarIconName: unitLocalization.avatarIconName,
	bannerAssetId: unitLocalization.bannerAssetId,
	summary: unitLocalization.summary,
	description: unitLocalization.description,
	createdAt: unit.createdAt,
	updatedAt: unit.updatedAt,
};

export async function getProfile(
	unitId: string,
	localizationLanguages: readonly ContentLanguage[] = [],
) {
	const profile = (
		await database
			.select(PublicProfileSelection)
			.from(profileTable)
			.innerJoin(unit, eq(unit.id, profileTable.id))
			.innerJoin(
				unitLocalization,
				and(
					eq(unitLocalization.unitId, profileTable.id),
					eq(
						unitLocalization.language,
						resolvedUnitLocalizationLanguage(profileTable.id, localizationLanguages),
					),
				),
			)
			.where(eq(profileTable.id, unitId))
			.limit(1)
	)[0];
	if (!profile) throw new ProfileNotFound();
	return presentProfile(profile);
}

export async function presentProfile<
	T extends {
		id: string;
		avatarType: typeof unitLocalization.$inferSelect.avatarType;
		avatarAssetId: string | null;
		avatarEmoji: string | null;
		avatarIconPrefix: typeof unitLocalization.$inferSelect.avatarIconPrefix;
		avatarIconName: string | null;
		bannerAssetId: string | null;
		status: string;
		visibility: string;
		description: unknown;
	},
>(profile: T) {
	const {
		avatarType,
		avatarAssetId,
		avatarEmoji,
		avatarIconPrefix,
		avatarIconName,
		bannerAssetId,
		...publicProfile
	} = profile;
	return {
		...publicProfile,
		slugAddress: await getPublicCanonicalUnitSlugAddress(profile.id),
		status: profile.status.toLowerCase(),
		visibility: profile.visibility.toLowerCase(),
		description: parseNullableDocument(PortableTextDocument, profile.description),
		avatar: presentAvatar(
			avatarReferenceFromColumns({
				avatarType,
				avatarAssetId,
				avatarEmoji,
				avatarIconPrefix,
				avatarIconName,
			}),
		),
		banner: presentImageAsset(bannerAssetId, "banner"),
	};
}
