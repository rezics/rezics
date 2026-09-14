import { and, eq, gt, isNull, or, sql, inArray } from "drizzle-orm";

import { AuthenticationRequired } from "../../auth/errors";
import { ensureAccountAuthenticationAllowed } from "../../auth/account-state";
import { database, type DatabaseExecutor } from "../../database";
import { accountEnforcement, users } from "../../database/schema";
import { EnforcementKindValues } from "../../database/schema/contract-values";
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
		.where(and(eq(users.id, authUserId), isNull(users.erasedAt)))
		.limit(1)
		.for("share");
	if (!account) throw new AuthenticationRequired();
	await ensureAccountAuthenticationAllowed(authUserId, executor);
	const evaluated = (await executor.execute<{ now: string; isolation: string }>(sql`select clock_timestamp()::text as now,current_setting('transaction_isolation') as isolation`)).rows[0];
	if (evaluated?.isolation !== "read committed") throw new Error("Current account policy requires READ COMMITTED");
	const now = new Date(evaluated.now);
	if (!Number.isFinite(now.getTime())) throw new Error("Account enforcement time is unavailable");
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
				inArray(accountEnforcement.kind, EnforcementKindValues.filter(kind => doesEnforcementBlockAction(kind, action))),
				or(isNull(accountEnforcement.expiresAt), gt(accountEnforcement.expiresAt, now)),
			),
		).limit(257);
	if (enforcements.length > 256) throw new Error("Account enforcement work budget is unavailable");
	if (
		enforcements.some(
			(enforcement) => {
				if (!doesEnforcementBlockAction(enforcement.kind, action)) return false;
				if (!Number.isFinite(enforcement.startsAt.getTime()) ||
					(enforcement.expiresAt !== null && !Number.isFinite(enforcement.expiresAt.getTime())))
					throw new Error("Account enforcement validity is unavailable");
				return enforcement.startsAt <= now &&
				(!enforcement.expiresAt || enforcement.expiresAt > now);
			},
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
