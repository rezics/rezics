import type { User } from "better-auth";
import { eq } from "drizzle-orm";

import { database } from "../database";
import { profile, profilePreference, unit, users } from "../database/schema";
import { recordUnitRevision } from "../units/history";

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
			name: profile.name,
			email: users.email,
		})
		.from(profile)
		.innerJoin(unit, eq(unit.id, profile.id))
		.innerJoin(users, eq(users.id, profile.authUserId))
		.where(eq(profile.authUserId, authUserId))
		.limit(1);
	return record?.slug ? { ...record, slug: record.slug } : undefined;
}

export async function ensureProfile(authUser: Pick<User, "id" | "email" | "name" | "image">) {
	const existing = await findProfile(authUser.id);
	if (existing) return existing;

	try {
		return await database.transaction(async (tx) => {
			const stem = authUser.name
				.normalize("NFKD")
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-|-$/g, "")
				.slice(0, 40);
			const slug = `${stem || "user"}-${crypto.randomUUID().slice(0, 8)}`;
			const [profileUnit] = await tx
				.insert(unit)
				.values({
					kind: "profile",
					slug,
					status: "published",
					visibility: "public",
					publishedAt: new Date(),
				})
				.returning({ id: unit.id, slug: unit.slug });
			if (!profileUnit?.slug) throw new Error("Profile Unit insertion did not return a slug");
			await tx.insert(profile).values({
				id: profileUnit.id,
				authUserId: authUser.id,
				name: authUser.name,
				avatar: authUser.image,
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
