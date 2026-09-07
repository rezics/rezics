import { and, eq, gt, isNull, or } from "drizzle-orm";

import { AuthenticationRequired } from "../../auth/errors";
import { database, type DatabaseExecutor } from "../../database";
import { accountEnforcement, users } from "../../database/schema";
import { AccountRestricted } from "../errors";
import { doesEnforcementBlockAction, type AccountAction } from "./policy";

async function ensureAccountCanAct(
	authUserId: string,
	action: AccountAction,
	executor: DatabaseExecutor,
): Promise<void> {
	const [account] = await executor
		.select({ id: users.id })
		.from(users)
		.where(eq(users.id, authUserId))
		.limit(1)
		.for("share");
	if (!account) throw new AuthenticationRequired();
	const now = new Date();
	const enforcements = await executor
		.select({
			kind: accountEnforcement.kind,
			startsAt: accountEnforcement.startsAt,
			expiresAt: accountEnforcement.expiresAt,
		})
		.from(accountEnforcement)
		.where(
			and(
				eq(accountEnforcement.authUserId, authUserId),
				isNull(accountEnforcement.revocationActionId),
				or(isNull(accountEnforcement.expiresAt), gt(accountEnforcement.expiresAt, now)),
			),
		);
	if (
		enforcements.some(
			(enforcement) =>
				enforcement.startsAt <= now &&
				(!enforcement.expiresAt || enforcement.expiresAt > now) &&
				doesEnforcementBlockAction(enforcement.kind, action),
		)
	)
		throw new AccountRestricted();
}

export class AccountAuthorization<AuthUserId extends string | undefined> {
	constructor(readonly authUserId: AuthUserId) {}

	ensureCanWrite(executor: DatabaseExecutor = database): Promise<void> {
		if (!this.authUserId) throw new AuthenticationRequired();
		return ensureAccountCanAct(this.authUserId, "write", executor);
	}

	ensureCanContribute(executor: DatabaseExecutor = database): Promise<void> {
		if (!this.authUserId) throw new AuthenticationRequired();
		return ensureAccountCanAct(this.authUserId, "contribute", executor);
	}
}
