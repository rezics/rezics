import { and, eq } from "drizzle-orm";
import type { Authorization } from "../authorization";
import { ensureAccountAuthenticationAllowed } from "../auth/account-state";
import type { DatabaseTransaction } from "../database";
import { users, authEntity } from "../database/schema";
import { ParticipationDenied } from "../participation/policy";

/** Lock and revalidate the current account and Self binding for a Realm operation. @internal */
export async function admitRealmAccount(
	tx: DatabaseTransaction,
	authorization: Authorization<string>,
	action: "read" | "write" | "contribute",
) {
	const context = authorization.participationAuthority,
		authUserId = authorization.authUserId;
	if (!authUserId || !context || context.principal.authUserId !== authUserId)
		throw new ParticipationDenied();
	if (action === "contribute") await authorization.account.ensureCanContribute(tx);
	else if (action === "write") await authorization.account.ensureCanWrite(tx);
	else {
		const [account] = await tx
			.select({ id: users.id })
			.from(users)
			.where(eq(users.id, authUserId))
			.limit(1)
			.for("share");
		if (!account) throw new ParticipationDenied("Account is unavailable");
	}
	await ensureAccountAuthenticationAllowed(authUserId, tx);
	const [binding] = await tx
		.select({ entityId: authEntity.entityId })
		.from(authEntity)
		.where(
			and(
				eq(authEntity.authUserId, authUserId),
				eq(authEntity.entityId, authorization.profileId),
				eq(authEntity.state, "active"),
				eq(authEntity.revision, context.authorizationRevision),
			),
		)
		.limit(1)
		.for("share");
	if (!binding) throw new ParticipationDenied("Account self identity changed");
	return binding;
}
