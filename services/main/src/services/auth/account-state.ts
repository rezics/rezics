import { eq } from "drizzle-orm";

import { database, type DatabaseExecutor } from "../database";
import { userAccountState } from "../database/schema";
import type { UserAccountState, UserAccountStateReason } from "../database/schema/contract-values";
import { AccountClosed, AccountSuspended } from "./errors";

export interface AccountStateRecord {
	readonly state: UserAccountState;
	readonly reason: UserAccountStateReason | null;
	readonly note: string | null;
	readonly expiresAt: Date | null;
	readonly revision: number;
	readonly updatedAt: Date | null;
	readonly updatedByProfileId: string | null;
}

export interface EffectiveAccountState extends AccountStateRecord {
	readonly state: UserAccountState;
}

export function effectiveAccountState(
	record: AccountStateRecord | undefined,
	now: Date = new Date(),
): EffectiveAccountState {
	if (!record)
		return {
			state: "active",
			reason: null,
			note: null,
			expiresAt: null,
			revision: 0,
			updatedAt: null,
			updatedByProfileId: null,
		};
	if (
		record.state === "suspended" &&
		record.expiresAt !== null &&
		record.expiresAt.getTime() <= now.getTime()
	)
		return {
			...record,
			state: "active",
			reason: null,
			note: null,
			expiresAt: null,
		};
	return record;
}

export async function loadEffectiveAccountState(
	userId: string,
	executor: DatabaseExecutor = database,
): Promise<EffectiveAccountState> {
	const [record] = await executor
		.select({
			state: userAccountState.state,
			reason: userAccountState.reason,
			note: userAccountState.note,
			expiresAt: userAccountState.expiresAt,
			revision: userAccountState.revision,
			updatedAt: userAccountState.updatedAt,
			updatedByProfileId: userAccountState.updatedByProfileId,
		})
		.from(userAccountState)
		.where(eq(userAccountState.userId, userId))
		.limit(1);
	return effectiveAccountState(record);
}

export async function ensureAccountAuthenticationAllowed(
	userId: string,
	executor: DatabaseExecutor = database,
): Promise<void> {
	const state = await loadEffectiveAccountState(userId, executor);
	if (state.state === "suspended") throw new AccountSuspended(state.expiresAt);
	if (state.state === "closed") throw new AccountClosed();
}
