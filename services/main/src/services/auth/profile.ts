import type { User } from "better-auth";
import { and, eq } from "drizzle-orm";

import { OfficialZoneManifest } from "../bootstrap/manifest";
import { database } from "../database";
import { isPrimaryUnitLocalization } from "../units/localization";
import {
	profile,
	profilePreference,
	unit,
	unitFollow,
	unitLocalization,
	users,
} from "../database/schema";
import { DefaultContentLanguage } from "../database/schema/contract-values";
import { fractionalPositionAt } from "../ordering/position";
import { recordUnitRevision } from "../units/history";
import { insertUnit } from "../units/create";

export interface SessionProfile {
	unitId: string;
	name: string | null;
	email: string | null;
}

async function findProfile(authUserId: string): Promise<SessionProfile | undefined> {
	const [record] = await database
		.select({
			unitId: profile.id,
			name: unitLocalization.title,
			email: users.email,
		})
		.from(profile)
		.innerJoin(unit, eq(unit.id, profile.id))
		.innerJoin(users, eq(users.id, profile.authUserId))
		.leftJoin(
			unitLocalization,
			and(
				eq(unitLocalization.unitId, profile.id),
				isPrimaryUnitLocalization(unitLocalization.unitId),
			),
		)
		.where(eq(profile.authUserId, authUserId))
		.limit(1);
	return record;
}

export async function ensureProfile(authUser: Pick<User, "id" | "email" | "name" | "image">) {
	const existing = await findProfile(authUser.id);
	if (existing) return existing;

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
				language: DefaultContentLanguage,
				title: authUser.name,
			});
			await tx.insert(profilePreference).values({ profileId: profileUnit.id });
			await tx
				.insert(unitFollow)
				.values(
					OfficialZoneManifest.map((officialZone, index) => ({
						followerProfileId: profileUnit.id,
						unitId: officialZone.id,
						position: fractionalPositionAt(index),
					})),
				)
				.onConflictDoNothing();
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
		if (raced) return raced;
		throw error;
	}
}
