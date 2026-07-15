import { and, eq, gt, isNull, or } from "drizzle-orm";

import { database } from "../../database";
import { accountEnforcement } from "../../database/schema";
import { AccountRestricted } from "../errors";
import { doesEnforcementBlockAction, type AccountAction } from "./policy";

async function ensureAccountCanAct(profileId: string, action: AccountAction): Promise<void> {
	const now = new Date();
	const enforcements = await database
		.select({
			kind: accountEnforcement.kind,
			startsAt: accountEnforcement.startsAt,
			expiresAt: accountEnforcement.expiresAt,
		})
		.from(accountEnforcement)
		.where(
			and(
				eq(accountEnforcement.profileId, profileId),
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

export class AccountAuthorization<ProfileId extends string | undefined> {
	constructor(readonly profileId: ProfileId) {}

	ensureCanWrite(this: AccountAuthorization<string>): Promise<void> {
		return ensureAccountCanAct(this.profileId, "write");
	}

	ensureCanContribute(this: AccountAuthorization<string>): Promise<void> {
		return ensureAccountCanAct(this.profileId, "contribute");
	}
}
