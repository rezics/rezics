import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.hoisted(() => vi.fn());

vi.mock("../database", () => ({
	database: {
		transaction: (operation: (tx: { execute: typeof execute }) => Promise<unknown>) =>
			operation({ execute }),
	},
}));

import { cleanupExpiredStudioEditorCandidates } from "./cleanup";

describe("expired Studio editor candidate cleanup", () => {
	beforeEach(() => execute.mockReset());

	it("combines two independently bounded cleanup batches", async () => {
		execute
			.mockResolvedValueOnce({ rows: [{ count: 7 }] })
			.mockResolvedValueOnce({ rows: [{ count: "5" }] });

		await expect(
			cleanupExpiredStudioEditorCandidates({
				batchSize: 100,
				now: new Date("2026-08-11T00:00:00.000Z"),
			}),
		).resolves.toBe(12);
		expect(execute).toHaveBeenCalledTimes(2);
	});

	it("rejects unbounded or invalid inputs before opening a transaction", async () => {
		await expect(cleanupExpiredStudioEditorCandidates({ batchSize: 10_001 })).rejects.toThrow(
			RangeError,
		);
		await expect(
			cleanupExpiredStudioEditorCandidates({ batchSize: 1, now: new Date("invalid") }),
		).rejects.toThrow(TypeError);
		expect(execute).not.toHaveBeenCalled();
	});
});
