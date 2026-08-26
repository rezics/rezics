import {
	peekActiveObservability,
	type VoteAdmissionAuthority,
	type VoteAdmissionEvent,
	type VoteAdmissionFamily,
} from "@rezics/observability";

import { database, type DatabaseTransaction } from ".";
import { databaseErrorMatches } from "./constraint";
import { VoteHotKeyBusy } from "./errors";

export const VoteHotKeySqlState = "55P03";
export const VoteHotKeyConstraint = "vote_hot_key_busy";
export const VoteHotKeyMaximumRetries = 2;
export const VoteHotKeyMaximumRetryDelayMilliseconds = 75;

const retryDelayCapsMilliseconds = [25, 50] as const;

export interface VoteAdmissionContext {
	readonly family: VoteAdmissionFamily;
	readonly authority: VoteAdmissionAuthority;
}

type TransactionRunner<Transaction> = <Result>(
	work: (tx: Transaction) => Promise<Result>,
) => Promise<Result>;

export interface VoteAdmissionRuntime<Transaction> {
	readonly runTransaction: TransactionRunner<Transaction>;
	readonly sleep: (milliseconds: number) => Promise<void>;
	readonly random: () => number;
	readonly now: () => number;
	readonly record: (context: VoteAdmissionContext, event: VoteAdmissionEvent) => void;
}

const defaultRuntime: VoteAdmissionRuntime<DatabaseTransaction> = {
	runTransaction: (work) => database.transaction(work),
	sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
	random: Math.random,
	now: performance.now.bind(performance),
	record: (context, event) => {
		peekActiveObservability()?.metrics.voteAdmission(context.family, context.authority, event);
	},
};

export function isVoteHotKeyBusy(error: unknown): boolean {
	return databaseErrorMatches(error, {
		code: VoteHotKeySqlState,
		constraint: VoteHotKeyConstraint,
	});
}

function retryDelayMilliseconds(retry: number, random: () => number): number {
	const sample = random();
	if (!Number.isFinite(sample) || sample < 0 || sample >= 1)
		throw new Error("Vote admission jitter must be in the range [0, 1)");
	const cap = retryDelayCapsMilliseconds[retry];
	if (cap === undefined) throw new Error("Vote admission retry index is out of range");
	return Math.floor(sample * (cap + 1));
}

/** Runs a complete vote-sensitive transaction with bounded fresh-transaction retries. */
export async function runVoteTransactionWithRuntime<Transaction, Result>(
	context: VoteAdmissionContext,
	work: (tx: Transaction) => Promise<Result>,
	runtime: VoteAdmissionRuntime<Transaction>,
): Promise<Result> {
	for (let attempt = 0; ; attempt += 1) {
		runtime.record(context, { outcome: "attempted" });
		const startedAt = runtime.now();
		try {
			const result = await runtime.runTransaction(work);
			runtime.record(context, {
				outcome: "committed",
				durationMilliseconds: Math.max(0, runtime.now() - startedAt),
			});
			return result;
		} catch (error) {
			const durationMilliseconds = Math.max(0, runtime.now() - startedAt);
			if (!isVoteHotKeyBusy(error)) {
				runtime.record(context, { outcome: "unexpected", durationMilliseconds });
				throw error;
			}
			runtime.record(context, { outcome: "backpressured", durationMilliseconds });
			if (attempt >= VoteHotKeyMaximumRetries) throw new VoteHotKeyBusy(error);
			await runtime.sleep(retryDelayMilliseconds(attempt, runtime.random));
		}
	}
}

export async function runVoteTransaction<Result>(
	context: VoteAdmissionContext,
	work: (tx: DatabaseTransaction) => Promise<Result>,
): Promise<Result> {
	return runVoteTransactionWithRuntime(context, work, defaultRuntime);
}
