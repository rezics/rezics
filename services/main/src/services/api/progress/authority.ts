import { and, eq, isNull } from "drizzle-orm";
import type { Authorization } from "../../authorization";
import { EmailVerificationRequired } from "../../auth/errors";
import { ensureAccountAuthenticationAllowed } from "../../auth/account-state";
import { lockUnitAccessState } from "../../authorization/unit/access-lock";
import { database, type DatabaseTransaction } from "../../database";
import { users, authEntity } from "../../database/schema";
import { ParticipationDenied } from "../../participation/policy";
import { UnitNotFound } from "../../units/errors";
import { readUnitStateById } from "../../units/query";
import { lockUnitProgress } from "./service";

/**
 * Serialize a private journal mutation with current account, Self and target-read authority.
 * @remarks Selected attribution does not change the private Auth owner. Callbacks must also
 * validate any independently protected chapter/media target within this transaction.
 * @internal
 */
export async function withProgressWriteAuthority<T>(
	input: {
		readonly authUserId: string;
		readonly unitId: string;
		readonly authorization: Authorization<string>;
	},
	work: (tx: DatabaseTransaction) => Promise<T>,
): Promise<T> {
	const { authUserId, unitId, authorization } = input;
	const authority = authorization.participationAuthority;
	if (
		authorization.authUserId !== authUserId ||
		!authority ||
		authority.principal.kind !== "auth" ||
		authority.principal.authUserId !== authUserId
	)
		throw new ParticipationDenied("Progress requires the current account's Self authority");
	return database.transaction(async (tx) => {
		const [account] = await tx
			.select({ id: users.id, emailVerified: users.emailVerified })
			.from(users)
			.where(
				and(eq(users.id, authUserId), eq(users.principalKind, "human"), isNull(users.erasedAt)),
			)
			.limit(1)
			.for("share");
		if (!account) throw new ParticipationDenied("Account is unavailable");
		await ensureAccountAuthenticationAllowed(authUserId, tx);
		if (!account.emailVerified) throw new EmailVerificationRequired();
		await authorization.account.ensureCanWrite(tx);
		const [self] = await tx
			.select({ id: authEntity.entityId })
			.from(authEntity)
			.where(
				and(
					eq(authEntity.authUserId, authUserId),
					eq(authEntity.entityId, authorization.profileId),
					eq(authEntity.state, "active"),
					eq(authEntity.revision, authority.authorizationRevision),
				),
			)
			.limit(1)
			.for("share");
		if (!self) throw new ParticipationDenied("Account Self identity changed");
		await lockUnitAccessState(tx, [unitId], "shared");
		const target = await readUnitStateById(tx, unitId, { lock: "share" });
		if (!target || !(await authorization.unit.decideInTransaction(tx, unitId, "unit.read")).allowed)
			throw new UnitNotFound();
		await lockUnitProgress(tx, authUserId, unitId);
		const result = await work(tx);
		if (!(await authorization.unit.decideInTransaction(tx, unitId, "unit.read")).allowed)
			throw new UnitNotFound();
		await authorization.account.ensureCanWrite(tx);
		return result;
	});
}
