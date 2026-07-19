import type { User } from "better-auth";
import { and, eq } from "drizzle-orm";

import { database } from "../database";
import { isPrimaryUnitLocalization } from "../units/localization";
import { profile, profilePreference, unit, unitLocalization, users } from "../database/schema";
import { DefaultLanguage } from "../database/schema/contract-values";
import { recordUnitRevision } from "../units/history";
import { insertAddressedUnit } from "../units/slug-address";
import { TopLevelSlugNamespaceUnitIds } from "../units/slug-system";
import { generateSlugLabel } from "../units/slug";

export interface SessionProfile {
	unitId: string;
	slug: string;
	name: string | null;
	email: string | null;
}

async function findProfile(authUserId: string): Promise<SessionProfile | undefined> {
	const [record] = await database
		.select({
			unitId: profile.id,
			slug: unit.slug,
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
	return record?.slug ? { ...record, slug: record.slug } : undefined;
}

export async function ensureProfile(authUser: Pick<User, "id" | "email" | "name" | "image">) {
	const existing = await findProfile(authUser.id);
	if (existing) return existing;

	try {
		return await database.transaction(async (tx) => {
			const profileUnit = await insertAddressedUnit(tx, {
				kind: "profile",
				slugScopeId: TopLevelSlugNamespaceUnitIds.users,
				slug: generateSlugLabel(authUser.name, "user"),
				status: "published",
				visibility: "public",
				publishedAt: new Date(),
			});
			await tx.insert(profile).values({
				id: profileUnit.id,
				authUserId: authUser.id,
			});
			await tx.insert(unitLocalization).values({
				unitId: profileUnit.id,
				language: DefaultLanguage,
				title: authUser.name,
			});
			await tx.insert(profilePreference).values({ profileId: profileUnit.id });
			await recordUnitRevision(tx, {
				unitId: profileUnit.id,
				actorProfileId: profileUnit.id,
				event: "create",
			});
			return {
				unitId: profileUnit.id,
				slug: profileUnit.slug,
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
