import { describe, expect, it, vi } from "vitest";

import { UnitOwnerValues } from "@rezics/reference";
import type { DatabaseTransaction } from "../database";
import { assertFixtureSeedTargetEmpty } from "./fixture-target";

function transactionWithExistingRows(input: {
	readonly userId?: string;
	readonly unitId?: string;
}) {
	const limit = vi
		.fn()
		.mockResolvedValue([])
		.mockResolvedValueOnce(input.userId ? [{ id: input.userId }] : [])
		.mockResolvedValueOnce(input.unitId ? [{ id: input.unitId }] : []);
	const where = vi.fn(() => ({ limit }));
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	const execute = vi.fn().mockResolvedValue({ rows: [] });
	return { transaction: { select, execute } as unknown as DatabaseTransaction, select, execute };
}

describe("Fixture Seed target preflight", () => {
	it("accepts the post-Bootstrap target before platform infrastructure is seeded", async () => {
		const { transaction, select, execute } = transactionWithExistingRows({});

		await expect(assertFixtureSeedTargetEmpty(transaction)).resolves.toBeUndefined();
		expect(select).toHaveBeenCalledTimes(UnitOwnerValues.length + 1);
		expect(execute).toHaveBeenCalledTimes(1);
		expect(execute.mock.invocationCallOrder[0]).toBeLessThan(select.mock.invocationCallOrder[0]!);
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
