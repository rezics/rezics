import { describe, expect, it, vi } from "vitest";

import type { DatabaseTransaction } from "../database";
import { assertFixtureSeedTargetEmpty } from "./fixture-target";

function transactionWithExistingRows(input: {
	readonly userId?: string;
	readonly unitId?: string;
}) {
	const limit = vi
		.fn()
		.mockResolvedValueOnce(input.userId ? [{ id: input.userId }] : [])
		.mockResolvedValueOnce(input.unitId ? [{ id: input.unitId }] : []);
	const where = vi.fn(() => ({ limit }));
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	return { transaction: { select } as unknown as DatabaseTransaction, select };
}

describe("Fixture Seed target preflight", () => {
	it("accepts the post-Bootstrap target before platform infrastructure is seeded", async () => {
		const { transaction, select } = transactionWithExistingRows({});

		await expect(assertFixtureSeedTargetEmpty(transaction)).resolves.toBeUndefined();
		expect(select).toHaveBeenCalledTimes(2);
	});

	it("rejects an existing non-Bootstrap user", async () => {
		const { transaction } = transactionWithExistingRows({ userId: "existing-user" });

		await expect(assertFixtureSeedTargetEmpty(transaction)).rejects.toThrow(
			"Seed requires an empty database",
		);
	});

	it("rejects an existing non-Bootstrap Unit", async () => {
		const { transaction } = transactionWithExistingRows({ unitId: "existing-unit" });

		await expect(assertFixtureSeedTargetEmpty(transaction)).rejects.toThrow(
			"Seed requires an empty database",
		);
	});
});
