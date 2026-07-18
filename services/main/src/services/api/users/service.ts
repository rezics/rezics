import { and, eq } from "drizzle-orm";
import { PortableTextDocument, parseNullableDocument } from "@rezics/content-structure";

import { database } from "../../database";
import { isPrimaryUnitLocalization } from "../../units/localization";
import { profile as profileTable, unit, unitLocalization } from "../../database/schema";
import { imageAssetContentUrl } from "../image-assets/service";
import { ProfileNotFound } from "./errors";

export const PublicProfileSelection = {
	id: unit.id,
	slug: unit.slug,
	status: unit.status,
	visibility: unit.visibility,
	language: unitLocalization.language,
	name: unitLocalization.title,
	avatarAssetId: profileTable.avatarAssetId,
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
	return presentProfile(profile, true);
}

export async function presentProfile<
	T extends {
		avatarAssetId: string | null;
		status: string;
		visibility: string;
		description: unknown;
	},
>(profile: T, includeKey = false) {
	return {
		...profile,
		status: profile.status.toLowerCase(),
		visibility: profile.visibility.toLowerCase(),
		description: parseNullableDocument(PortableTextDocument, profile.description),
		avatar: profile.avatarAssetId ? imageAssetContentUrl(profile.avatarAssetId) : null,
		...(includeKey ? { avatarAssetId: profile.avatarAssetId } : {}),
	};
}
