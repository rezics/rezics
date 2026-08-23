import { StatusCodes } from "http-status-codes";
import { describe, expect, it } from "vitest";

import { VndbVoteHotKeyBusy } from "./errors";
import {
	isVndbVoteHotKeyBusy,
	runVndbVoteTransactionWithRuntime,
	toVndbVoteHotKeyBusy,
	VndbVoteHotKeyConstraint,
	VndbVoteHotKeyMaximumRetries,
	VndbVoteHotKeyMaximumRetryDelayMilliseconds,
	VndbVoteHotKeySqlState,
	type VndbVoteAdmissionContext,
	type VndbVoteAdmissionRuntime,
} from "./vndb-vote-admission";

type TestTransaction = {
	append(value: number): void;
	readonly attempt: number;
};

const context = {
	family: "unit_tag",
	authority: "global",
} satisfies VndbVoteAdmissionContext;

function busyError(): unknown {
	return new Error("transaction failed", {
		cause: {
			code: VndbVoteHotKeySqlState,
			constraint: VndbVoteHotKeyConstraint,
		},
	});
}

describe("VNDB vote admission", () => {
	it("translates only the exact retryable database identity", () => {
		const exact = busyError();

		expect(isVndbVoteHotKeyBusy(exact)).toBe(true);
		const translated = toVndbVoteHotKeyBusy(exact);
		expect(translated).toBeInstanceOf(VndbVoteHotKeyBusy);
		expect(translated?.status).toBe(StatusCodes.TOO_MANY_REQUESTS);
		expect(translated?.retryAfterSeconds).toBe(1);
		expect(translated?.cause).toBe(exact);
		expect(
			isVndbVoteHotKeyBusy({
				code: "23505",
				constraint: VndbVoteHotKeyConstraint,
			}),
		).toBe(false);
		expect(
			isVndbVoteHotKeyBusy({
				code: VndbVoteHotKeySqlState,
				constraint: "another_constraint",
			}),
		).toBe(false);
	});

	it("retries fresh whole transactions after rollback without leaking partial work", async () => {
		const events: string[] = [];
		const committed: number[] = [];
		const sleeps: number[] = [];
		const metrics: string[] = [];
		const samples = [0.4, 0.8];
		let attempt = 0;
		let now = 0;
		const runtime: VndbVoteAdmissionRuntime<TestTransaction> = {
			runTransaction: async (work) => {
				attempt += 1;
				const pending: number[] = [];
				const testTransaction: TestTransaction = {
					append: (value) => pending.push(value),
					attempt,
				};
				events.push(`transaction:${attempt}:start`);
				try {
					const result = await work(testTransaction);
					committed.push(...pending);
					events.push(`transaction:${attempt}:commit`);
					return result;
				} catch (error) {
					events.push(`transaction:${attempt}:rollback`);
					throw error;
				}
			},
			sleep: async (milliseconds) => {
				sleeps.push(milliseconds);
				events.push(`sleep:${milliseconds}`);
			},
			random: () => samples.shift() ?? 0,
			now: () => (now += 10),
			record: ({ family, authority }, event) => {
				metrics.push(
					`${family}:${authority}:${event.outcome}${"durationMilliseconds" in event ? `:${event.durationMilliseconds}` : ""}`,
				);
			},
		};

		const result = await runVndbVoteTransactionWithRuntime(
			context,
			async (tx) => {
				tx.append(tx.attempt);
				if (tx.attempt < 3) throw busyError();
				return "committed";
			},
			runtime,
		);

		expect(result).toBe("committed");
		expect(committed).toEqual([3]);
		expect(sleeps).toEqual([10, 40]);
		expect(events).toEqual([
			"transaction:1:start",
			"transaction:1:rollback",
			"sleep:10",
			"transaction:2:start",
			"transaction:2:rollback",
			"sleep:40",
			"transaction:3:start",
			"transaction:3:commit",
		]);
		expect(metrics).toEqual([
			"unit_tag:global:attempted",
			"unit_tag:global:backpressured:10",
			"unit_tag:global:attempted",
			"unit_tag:global:backpressured:10",
			"unit_tag:global:attempted",
			"unit_tag:global:committed:10",
		]);
	});

	it("exhausts after two retries within the 75 ms jitter budget", async () => {
		let attempts = 0;
		const sleeps: number[] = [];
		const metrics: string[] = [];
		const runtime: VndbVoteAdmissionRuntime<TestTransaction> = {
			runTransaction: async (work) => {
				attempts += 1;
				return work({ append: () => undefined, attempt: attempts });
			},
			sleep: async (milliseconds) => {
				sleeps.push(milliseconds);
			},
			random: () => 0.999_999,
			now: () => 0,
			record: ({ authority }, event) => metrics.push(`${authority}:${event.outcome}`),
		};

		const failure = await runVndbVoteTransactionWithRuntime(
			context,
			async () => {
				throw busyError();
			},
			runtime,
		).then(
			() => undefined,
			(error: unknown) => error,
		);

		expect(failure).toBeInstanceOf(VndbVoteHotKeyBusy);
		if (!(failure instanceof VndbVoteHotKeyBusy))
			throw new Error("Expected the typed VNDB vote backpressure error");
		expect(failure.cause).toBeDefined();
		expect(attempts).toBe(VndbVoteHotKeyMaximumRetries + 1);
		expect(sleeps).toEqual([25, 50]);
		expect(sleeps.reduce((total, delay) => total + delay, 0)).toBe(
			VndbVoteHotKeyMaximumRetryDelayMilliseconds,
		);
		expect(metrics.filter((metric) => metric === "global:attempted")).toHaveLength(3);
		expect(metrics.filter((metric) => metric === "global:backpressured")).toHaveLength(3);
		expect(metrics).not.toContain("global:committed");
	});

	it("does not retry or translate an unrelated transaction failure", async () => {
		const original = new Error("validation failed");
		let attempts = 0;
		let sleeps = 0;
		const metrics: string[] = [];

		const runtime: VndbVoteAdmissionRuntime<TestTransaction> = {
			runTransaction: async (work) => {
				attempts += 1;
				return work({ append: () => undefined, attempt: attempts });
			},
			sleep: async () => {
				sleeps += 1;
			},
			random: () => 0,
			now: () => 0,
			record: (_context, event) => metrics.push(event.outcome),
		};

		const failure = await runVndbVoteTransactionWithRuntime(
			context,
			async () => {
				throw original;
			},
			runtime,
		).then(
			() => undefined,
			(error: unknown) => error,
		);

		expect(failure).toBe(original);
		expect(attempts).toBe(1);
		expect(sleeps).toBe(0);
		expect(metrics).toEqual(["attempted", "unexpected"]);
	});
});
