import { beforeEach, describe, expect, it, vi } from "vitest";

const lockPlatformAccess = vi.hoisted(() => vi.fn());
const recordAuditEvent = vi.hoisted(() => vi.fn());

vi.mock("../../platform-access", () => ({ lockPlatformAccess }));
vi.mock("../../audit", () => ({ recordAuditEvent }));

import type { DatabaseTransaction } from "../../database";
import { BootstrapPlatformAccessManifest } from "../data";
import { ensureBootstrapPlatformAccess } from "./platform-access";

function transactionWithExistingGrant(existing: boolean) {
	const limit = vi.fn(async () => (existing ? [{ id: "grant-id" }] : []));
	const select = vi.fn(() => ({
		from: () => ({
			where: () => ({ limit }),
		}),
	}));
	const returning = vi.fn(async () => [{ id: "created-grant" }]);
	const values = vi.fn(() => ({ returning }));
	const insert = vi.fn(() => ({ values }));
	const update = vi.fn();
	const transaction = { select, insert, update } as unknown as DatabaseTransaction;
	return { transaction, insert, update };
}

describe("bootstrap platform access", () => {
	beforeEach(() => {
		lockPlatformAccess.mockReset();
		recordAuditEvent.mockReset();
	});

	it("inserts a grant only when that profile and capability were never granted", async () => {
		const { transaction, insert, update } = transactionWithExistingGrant(false);

		await ensureBootstrapPlatformAccess(transaction);

		const expectedInserts = BootstrapPlatformAccessManifest.reduce(
			(count, access) => count + access.capabilities.length,
			0,
		);
		expect(insert).toHaveBeenCalledTimes(expectedInserts);
		expect(update).not.toHaveBeenCalled();
		expect(recordAuditEvent).toHaveBeenCalledTimes(expectedInserts);
	});

	it("does not restore a previously granted or revoked capability", async () => {
		const { transaction, insert, update } = transactionWithExistingGrant(true);

		await ensureBootstrapPlatformAccess(transaction);

		expect(insert).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
		expect(recordAuditEvent).not.toHaveBeenCalled();
	});
});
