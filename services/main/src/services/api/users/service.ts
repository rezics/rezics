import { and, eq } from "drizzle-orm";
import { PortableTextDocument, parseNullableDocument } from "@rezics/block";
import type { AvatarReference } from "@rezics/avatar";

import { database } from "../../database";
import {
	isPrimaryUnitLocalization,
	resolvedUnitLocalizationAvatar,
	resolvedUnitLocalizationImageAssetId,
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
	avatar: resolvedUnitLocalizationAvatar(profileTable.id),
	bannerAssetId: resolvedUnitLocalizationImageAssetId(profileTable.id, "banner"),
	summary: unitLocalization.summary,
	description: unitLocalization.description,
	createdAt: unit.createdAt,
	updatedAt: unit.updatedAt,
};

export async function getProfile(unitId: string) {
	const profile = (
		await database
			.select(PublicProfileSelection)
			.from(profileTable)
			.innerJoin(unit, eq(unit.id, profileTable.id))
			.leftJoin(
				unitLocalization,
				and(
					eq(unitLocalization.unitId, profileTable.id),
					isPrimaryUnitLocalization(unitLocalization.unitId),
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
		description: parseNullableDocument(PortableTextDocument, profile.description),
		avatar: presentAvatar(avatar),
		banner: presentImageAsset(bannerAssetId, "banner"),
	};
}
