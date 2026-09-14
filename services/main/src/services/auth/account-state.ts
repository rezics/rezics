import { eq, sql } from "drizzle-orm";

import { database, type DatabaseExecutor } from "../database";
import { userAccountState, users } from "../database/schema";
import type { UserAccountState } from "../database/schema/contract-values";
import { AccountClosed, AccountSuspended } from "./errors";

export interface AccountStateRecord {
	readonly state: UserAccountState;
	readonly governanceDecisionId: string | null;
	readonly note: string | null;
	readonly expiresAt: Date | null;
	readonly revision: number;
	readonly updatedAt: Date | null;
	readonly updatedByAuthUserId: string | null;
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
			governanceDecisionId: null,
			note: null,
			expiresAt: null,
			revision: 0,
			updatedAt: null,
			updatedByAuthUserId: null,
		};
	if (
		record.state === "suspended" &&
		record.expiresAt !== null &&
		record.expiresAt.getTime() <= now.getTime()
	)
		return {
			...record,
			state: "active",
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
			governanceDecisionId: userAccountState.decisionId,
			note: userAccountState.note,
			expiresAt: userAccountState.expiresAt,
			revision: userAccountState.revision,
			updatedAt: userAccountState.updatedAt,
			updatedByAuthUserId: userAccountState.updatedByAuthUserId,
			evaluatedAt: sql<string>`statement_timestamp()::text`,
		})
		.from(userAccountState)
		.where(eq(userAccountState.userId, userId))
		.limit(1);
	if (!record) return effectiveAccountState(undefined);
	const { evaluatedAt, ...state } = record;
	const now = new Date(evaluatedAt);
	if (!Number.isFinite(now.getTime()) || (state.expiresAt !== null && !Number.isFinite(state.expiresAt.getTime())))
		throw new Error("Account state time is unavailable");
	return effectiveAccountState(state, now);
}

export async function ensureAccountAuthenticationAllowed(
	userId: string,
	executor: DatabaseExecutor = database,
): Promise<void> {
	const [account] = await executor
		.select({ erasedAt: users.erasedAt })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	if (!account || account.erasedAt) throw new AccountClosed();
	const state = await loadEffectiveAccountState(userId, executor);
	if (state.state === "suspended") throw new AccountSuspended(state.expiresAt);
	if (state.state === "closed") throw new AccountClosed();
}
