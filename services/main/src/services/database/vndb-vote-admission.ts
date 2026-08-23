import {
	peekActiveObservability,
	type VndbVoteAdmissionAuthority,
	type VndbVoteAdmissionEvent,
	type VndbVoteAdmissionFamily,
} from "@rezics/observability";

import { database, type DatabaseTransaction } from ".";
import { databaseErrorMatches } from "./constraint";
import { VndbVoteHotKeyBusy } from "./errors";

export const VndbVoteHotKeySqlState = "55P03";
export const VndbVoteHotKeyConstraint = "vndb_vote_hot_key_busy";
export const VndbVoteHotKeyMaximumRetries = 2;
export const VndbVoteHotKeyMaximumRetryDelayMilliseconds = 75;

const retryDelayCapsMilliseconds = [25, 50] as const;

export interface VndbVoteAdmissionContext {
	readonly family: VndbVoteAdmissionFamily;
	readonly authority: VndbVoteAdmissionAuthority;
}

type TransactionRunner<Transaction> = <Result>(
	work: (tx: Transaction) => Promise<Result>,
) => Promise<Result>;

export interface VndbVoteAdmissionRuntime<Transaction> {
	readonly runTransaction: TransactionRunner<Transaction>;
	readonly sleep: (milliseconds: number) => Promise<void>;
	readonly random: () => number;
	readonly now: () => number;
	readonly record: (context: VndbVoteAdmissionContext, event: VndbVoteAdmissionEvent) => void;
}

const defaultRunTransaction: TransactionRunner<DatabaseTransaction> = (work) =>
	database.transaction(work);

const defaultRuntime: VndbVoteAdmissionRuntime<DatabaseTransaction> = {
	runTransaction: defaultRunTransaction,
	sleep: (milliseconds) =>
		new Promise((resolve) => {
			setTimeout(resolve, milliseconds);
		}),
	random: Math.random,
	now: performance.now.bind(performance),
	record: (context, event) => {
		peekActiveObservability()?.metrics.vndbVoteAdmission(context.family, context.authority, event);
	},
};

export function isVndbVoteHotKeyBusy(error: unknown): boolean {
	return databaseErrorMatches(error, {
		code: VndbVoteHotKeySqlState,
		constraint: VndbVoteHotKeyConstraint,
	});
}

export function toVndbVoteHotKeyBusy(error: unknown): VndbVoteHotKeyBusy | undefined {
	return isVndbVoteHotKeyBusy(error) ? new VndbVoteHotKeyBusy(error) : undefined;
}

function retryDelayMilliseconds(retry: number, random: () => number): number {
	const sample = random();
	if (!Number.isFinite(sample) || sample < 0 || sample >= 1)
		throw new Error("VNDB vote admission jitter must be in the range [0, 1)");
	const cap = retryDelayCapsMilliseconds[retry];
	if (cap === undefined) throw new Error("VNDB vote admission retry index is out of range");
	return Math.floor(sample * (cap + 1));
}

/**
 * Runs one complete VNDB-vote mutation transaction with bounded admission retries.
 *
 * Each retry starts a fresh transaction after the rejected transaction has
 * released its database connection. Callers must put every mutation and
 * dependent read inside `work` so a failed attempt cannot leak partial state.
 */
export async function runVndbVoteTransactionWithRuntime<Transaction, Result>(
	context: VndbVoteAdmissionContext,
	work: (tx: Transaction) => Promise<Result>,
	runtime: VndbVoteAdmissionRuntime<Transaction>,
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
			if (!isVndbVoteHotKeyBusy(error)) {
				runtime.record(context, { outcome: "unexpected", durationMilliseconds });
				throw error;
			}
			runtime.record(context, { outcome: "backpressured", durationMilliseconds });
			if (attempt >= VndbVoteHotKeyMaximumRetries) throw new VndbVoteHotKeyBusy(error);
			await runtime.sleep(retryDelayMilliseconds(attempt, runtime.random));
		}
	}
}

export async function runVndbVoteTransaction<Result>(
	context: VndbVoteAdmissionContext,
	work: (tx: DatabaseTransaction) => Promise<Result>,
): Promise<Result> {
	return runVndbVoteTransactionWithRuntime(context, work, defaultRuntime);
}
