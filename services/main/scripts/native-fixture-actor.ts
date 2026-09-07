import { eq } from "drizzle-orm";
import type { DatabaseTransaction } from "../src/services/database";
import { users } from "../src/services/database/schema/auth";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { runWithParticipationAuthority } from "../src/services/participation/policy";

/** SQL fixtures exercise the same Auth/Self-Entity admission and current authority as native callers. @internal */
export async function runWithNativeFixtureActor<T>(
	tx: DatabaseTransaction,
	authUserId: string,
	work: () => Promise<T>,
): Promise<T> {
	if (process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
		throw new Error("Native fixture authority requires explicit disposable configuration");
	const [account] = await tx
		.select({ id: users.id, name: users.name, email: users.email })
		.from(users)
		.where(eq(users.id, authUserId))
		.limit(1);
	if (!account) throw new Error("Native fixture account is missing");
	const self = await ensureSelfEntityInTransaction(tx, { ...account, image: null });
	return runWithParticipationAuthority(
		{
			principal: { kind: "auth", authUserId },
			actingEntityId: self.id,
			authorizationRevision: self.authorizationRevision,
		},
		work,
	);
}
