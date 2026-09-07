import type { User } from "better-auth";
import { and, eq } from "drizzle-orm";
import { DefaultStoredUiLocale, type UiLocale } from "@rezics/i18n";
import { database, type DatabaseTransaction } from "../database";
import { users } from "../database/schema/auth";
import { authEntity } from "../database/schema/participation";
import { accountPreference } from "../database/schema/account-preference";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { createParticipantIdentity } from "../participation/identity";
import { ParticipationDenied } from "../participation/policy";
import { initializeAccountParticipation } from "./account-defaults";

/** @alpha Public self identity. Private login/email data belongs to the Auth account. */
export interface SessionEntity {
	id: string;
	name: string | null;
	authorizationRevision: number;
}

/** Creates precisely one self Entity; serialization is on the private account, not a name match. */
export async function ensureSelfEntity(
	authUser: Pick<User, "id" | "email" | "name" | "image">,
	initialInterfaceLocale: UiLocale = DefaultStoredUiLocale,
): Promise<SessionEntity> {
	return database.transaction((tx) =>
		ensureSelfEntityInTransaction(tx, authUser, initialInterfaceLocale, true),
	);
}

/** Transaction-owning account constructors and SQL fixtures use the same row-locked self-identity admission. @internal */
export async function ensureSelfEntityInTransaction(
	tx: DatabaseTransaction,
	authUser: Pick<User, "id" | "email" | "name" | "image">,
	initialInterfaceLocale: UiLocale = DefaultStoredUiLocale,
	initializeDefaults = false,
): Promise<SessionEntity> {
	const [known] = await tx
		.select({ id: authEntity.entityId })
		.from(authEntity)
		.where(eq(authEntity.authUserId, authUser.id))
		.limit(1);
	const [account] = await tx
		.select({
			id: users.id,
			language: users.registrationContentLanguage,
			principalKind: users.principalKind,
			erasedAt: users.erasedAt,
		})
		.from(users)
		.where(eq(users.id, authUser.id))
		.limit(1)
		.for(known ? "share" : "update");
	if (!account || account.erasedAt) throw new ParticipationDenied("Account is unavailable");
	if (account.principalKind !== "human")
		throw new ParticipationDenied(
			"Service accounts cannot use interactive or personal API credentials",
		);
	const [existing] = await tx
		.select()
		.from(authEntity)
		.where(eq(authEntity.authUserId, account.id))
		.limit(1);
	const names = CatalogFactTables.entity.name;
	if (existing) {
		if (existing.state !== "active") throw new ParticipationDenied("Self identity is suspended");
		const [name] = await tx
			.select({ value: names.value })
			.from(names)
			.where(and(eq(names.ownerId, existing.entityId), eq(names.state, "active")))
			.orderBy(names.id)
			.limit(1);
		return {
			id: existing.entityId,
			name: name?.value ?? null,
			authorizationRevision: existing.revision,
		};
	}
	await tx
		.insert(accountPreference)
		.values({
			authUserId: account.id,
			interfaceLocale: initialInterfaceLocale,
			preferredLanguages: [account.language],
		})
		.onConflictDoNothing();
	const publicName = initialPublicName(authUser);
	const entity = await createParticipantIdentity(tx, {
		shape: "person",
		operatorAuthUserId: account.id,
		names: publicName ? [{ language: account.language, value: publicName }] : [],
	});
	await tx.insert(authEntity).values({ authUserId: account.id, entityId: entity.id });
	if (initializeDefaults) await initializeAccountParticipation(tx, entity.id);
	return {
		id: entity.id,
		name: publicName,
		authorizationRevision: 1,
	};
}

function initialPublicName(user: Pick<User, "name" | "email">): string | null {
	const name = user.name.trim();
	return name.length > 0 &&
		name.length <= 120 &&
		name.toLowerCase() !== user.email.trim().toLowerCase()
		? name
		: null;
}
