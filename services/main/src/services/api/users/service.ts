import { eq, sql } from "drizzle-orm";

import { database } from "../../database";
import { profile as profileTable, unit } from "../../database/schema";
import { storage } from "../../storage";
import { isManagedUploadKey } from "../../authorization/upload/authorization";
import { ProfileNotFound } from "./errors";

export const PublicProfileSelection = {
	id: unit.id,
	slug: unit.slug,
	status: unit.status,
	visibility: unit.visibility,
	language: sql<string | null>`null`,
	name: profileTable.name,
	avatar: profileTable.avatar,
	summary: profileTable.summary,
	description: profileTable.description,
	createdAt: unit.createdAt,
	updatedAt: unit.updatedAt,
};

export async function getProfile(unitId: string) {
	const profile = (
		await database
			.select(PublicProfileSelection)
			.from(profileTable)
			.innerJoin(unit, eq(unit.id, profileTable.id))
			.where(eq(profileTable.id, unitId))
			.limit(1)
	)[0];
	if (!profile) throw new ProfileNotFound();
	return presentProfile(profile, true);
}

export async function presentProfile<
	T extends { avatar: string | null; status: string; visibility: string },
>(profile: T, includeKey = false) {
	const avatarKey = profile.avatar && isManagedUploadKey(profile.avatar) ? profile.avatar : null;
	return {
		...profile,
		status: profile.status.toLowerCase(),
		visibility: profile.visibility.toLowerCase(),
		avatar: avatarKey ? await storage.presignGet({ Key: avatarKey }) : profile.avatar,
		...(includeKey ? { avatarKey } : {}),
	};
}
