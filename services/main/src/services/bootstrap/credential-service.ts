import { and, eq, sql } from "drizzle-orm";

import { database } from "../database";
import { accounts } from "../database/schema";
import { assertPlatformCoreReady, inspectPlatformCore, PlatformInstallationLockName } from "./core";
import { preparePlatformCredential, type IssuedPlatformCredential } from "./credentials";
import { BootstrapProfileManifest } from "./manifest";

export async function rotatePlatformCredentials(): Promise<readonly IssuedPlatformCredential[]> {
	return database.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${PlatformInstallationLockName}, 0))`,
		);
		assertPlatformCoreReady(await inspectPlatformCore(tx));
		const issuedCredentials: IssuedPlatformCredential[] = [];
		for (const profile of BootstrapProfileManifest) {
			const [storedAccount] = await tx
				.select({
					id: accounts.id,
					accountId: accounts.accountId,
					providerId: accounts.providerId,
					userId: accounts.userId,
				})
				.from(accounts)
				.where(eq(accounts.id, profile.accountId))
				.limit(1);
			if (
				!storedAccount ||
				storedAccount.accountId !== profile.authUserId ||
				storedAccount.providerId !== "credential" ||
				storedAccount.userId !== profile.authUserId
			)
				throw new Error(`Platform credential account ${profile.key} has an invalid identity`);
			const prepared = await preparePlatformCredential();
			const updated = await tx
				.update(accounts)
				.set({ password: prepared.passwordHash, updatedAt: new Date() })
				.where(
					and(
						eq(accounts.id, profile.accountId),
						eq(accounts.accountId, profile.authUserId),
						eq(accounts.providerId, "credential"),
						eq(accounts.userId, profile.authUserId),
					),
				)
				.returning({ id: accounts.id });
			if (updated.length !== 1)
				throw new Error(`Platform credential account ${profile.key} was not rotated`);
			issuedCredentials.push({
				action: "rotated",
				name: profile.name,
				email: profile.email,
				password: prepared.password,
			});
		}
		return issuedCredentials;
	});
}
