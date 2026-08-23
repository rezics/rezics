import { describe, expect, it, vi } from "vitest";

import type { DatabaseTransaction } from "../database";
import { tag, unitTagJudgment } from "../database/schema";
import { applyNewPostTagMentionVotes, collectNewPostUnitMentionIds } from "./tag-mentions";

const first = "019f73cb-926e-7e50-9a7f-da67701accb3";
const second = "019f73cb-926e-7e50-9a7f-da67701accb4";
const postId = "019f73cb-926e-7e50-9a7f-da67701accb5";
const profileId = "019f73cb-926e-7e50-9a7f-da67701accb6";

function document(...unitIds: string[]) {
	return {
		_type: "portable-text",
		_key: "a10000000001",
		content: [
			{
				_key: "block",
				_type: "block",
				children: unitIds.map((unitId, index) => ({
					_key: `mention-${index}`,
					_type: "unit-mention",
					unitId,
				})),
			},
		],
	};
}

type JudgmentState = {
	fitVote: -1 | 1 | null;
	fitUpdatedAt: Date | null;
	spoilerLevel: 0 | 1 | 2 | null;
	spoilerUpdatedAt: Date | null;
};

function transactionWithExistingJudgment(initial: JudgmentState) {
	const state = { ...initial };
	const updates: Array<{ readonly table: unknown; readonly values: unknown }> = [];
	const limit = vi.fn(async () => [{ value: state.fitVote }]);
	const lock = vi.fn(() => ({ limit }));
	const select = vi.fn(() => ({
		from: vi.fn((table: unknown) => {
			if (table === tag) return { where: vi.fn(async () => [{ id: first }]) };
			if (table === unitTagJudgment) return { where: vi.fn(() => ({ for: lock })) };
			throw new Error("Unexpected select table");
		}),
	}));
	const insert = vi.fn((table: unknown) => ({
		values: vi.fn(() => ({
			onConflictDoNothing: vi.fn(() =>
				table === unitTagJudgment
					? { returning: vi.fn(async () => []) }
					: Promise.resolve(undefined),
			),
		})),
	}));
	const update = vi.fn((table: unknown) => ({
		set: vi.fn((values: unknown) => ({
			where: vi.fn(async () => {
				updates.push({ table, values });
				if (table !== unitTagJudgment) throw new Error("Unexpected update table");
				Object.assign(state, values);
			}),
		})),
	}));
	const transaction = { select, insert, update } as unknown as DatabaseTransaction;
	return { transaction, state, updates, lock };
}

async function applyMentionVote(transaction: DatabaseTransaction): Promise<void> {
	await applyNewPostTagMentionVotes(transaction, {
		postId,
		profileId,
		nextBody: document(first),
	});
}

describe("Post Unit mention side effects", () => {
	it("returns only distinct mentions newly added to the document", () => {
		expect(collectNewPostUnitMentionIds(document(first), document(first, second, second))).toEqual([
			second,
		]);
	});

	it("does not interpret mention removal as a reversible vote", () => {
		expect(collectNewPostUnitMentionIds(document(first), document())).toEqual([]);
	});

	it("adds fit to a locked spoiler-only judgment without changing its spoiler judgment", async () => {
		const spoilerUpdatedAt = new Date("2026-08-22T12:00:00.000Z");
		const { transaction, state, updates, lock } = transactionWithExistingJudgment({
			fitVote: null,
			fitUpdatedAt: null,
			spoilerLevel: 2,
			spoilerUpdatedAt,
		});

		await applyMentionVote(transaction);

		expect(lock).toHaveBeenCalledWith("update");
		expect(state).toEqual({
			fitVote: 1,
			fitUpdatedAt: expect.any(Date),
			spoilerLevel: 2,
			spoilerUpdatedAt,
		});
		expect(updates).toEqual([
			{
				table: unitTagJudgment,
				values: { fitVote: 1, fitUpdatedAt: expect.any(Date) },
			},
		]);
		expect(updates[0]?.values).not.toHaveProperty("spoilerLevel");
		expect(updates[0]?.values).not.toHaveProperty("spoilerUpdatedAt");
	});

	it("keeps an existing positive fit judgment idempotent", async () => {
		const fitUpdatedAt = new Date("2026-08-22T12:00:00.000Z");
		const { transaction, state, updates, lock } = transactionWithExistingJudgment({
			fitVote: 1,
			fitUpdatedAt,
			spoilerLevel: 1,
			spoilerUpdatedAt: new Date("2026-08-22T12:01:00.000Z"),
		});

		await applyMentionVote(transaction);

		expect(lock).toHaveBeenCalledWith("update");
		expect(updates).toEqual([]);
		expect(state.fitVote).toBe(1);
		expect(state.fitUpdatedAt).toBe(fitUpdatedAt);
	});

	it("preserves an existing negative fit judgment and rejects the mention", async () => {
		const spoilerUpdatedAt = new Date("2026-08-22T12:01:00.000Z");
		const { transaction, state, updates, lock } = transactionWithExistingJudgment({
			fitVote: -1,
			fitUpdatedAt: new Date("2026-08-22T12:00:00.000Z"),
			spoilerLevel: 1,
			spoilerUpdatedAt,
		});

		await expect(applyMentionVote(transaction)).rejects.toMatchObject({
			_tag: "PostTagMentionVoteConflict",
		});
		expect(lock).toHaveBeenCalledWith("update");
		expect(updates).toEqual([]);
		expect(state).toMatchObject({ fitVote: -1, spoilerLevel: 1, spoilerUpdatedAt });
	});
});
