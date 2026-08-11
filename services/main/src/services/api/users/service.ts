import { and, eq } from "drizzle-orm";
import type { ContentLanguage } from "@rezics/i18n";
import type { AvatarReference } from "@rezics/avatar";

import { database } from "../../database";
import {
	resolvedUnitLocalizationAvatar,
	resolvedUnitLocalizationImageAssetId,
	resolvedUnitLocalizationLanguage,
} from "../../units/localization";
import { profile as profileTable, unit, unitLocalization } from "../../database/schema";
import { presentAvatar } from "../../units/avatar";
import { presentImageAsset } from "../../units/service";
import { getPublicCanonicalUnitSlugAddress } from "../../units/slug-address";
import { presentNullablePortableTextDocument } from "../../documents/portable-text-presentation";
import { ProfileNotFound } from "./errors";

export function publicProfileSelection(localizationLanguages: readonly ContentLanguage[] = []) {
	return {
		id: unit.id,
		status: unit.status,
		visibility: unit.visibility,
		language: unitLocalization.language,
		name: unitLocalization.title,
		avatar: resolvedUnitLocalizationAvatar(unit.id, localizationLanguages),
		bannerAssetId: resolvedUnitLocalizationImageAssetId(unit.id, "banner", localizationLanguages),
		summary: unitLocalization.summary,
		description: unitLocalization.description,
		createdAt: unit.createdAt,
		updatedAt: unit.updatedAt,
	};
}

export async function getProfile(
	unitId: string,
	localizationLanguages: readonly ContentLanguage[] = [],
) {
	const profile = (
		await database
			.select(publicProfileSelection(localizationLanguages))
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
		avatar: AvatarReference | null;
		bannerAssetId: string | null;
		status: string;
		visibility: string;
		description: unknown;
	},
>(profile: T) {
	const { avatar, bannerAssetId, ...publicProfile } = profile;
	return {
		...publicProfile,
		slugAddress: await getPublicCanonicalUnitSlugAddress(profile.id),
		status: profile.status.toLowerCase(),
		visibility: profile.visibility.toLowerCase(),
		description: presentNullablePortableTextDocument(
			profile.description,
			"unit_localization.description",
		),
		avatar: presentAvatar(avatar),
		banner: presentImageAsset(bannerAssetId, "banner"),
	};
}
