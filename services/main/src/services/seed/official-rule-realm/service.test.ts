import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseUrl = vi.hoisted(() => ({ value: "postgres://test:test@localhost/rezics" }));
const transaction = vi.hoisted(() => vi.fn());
const inspectPlatformCore = vi.hoisted(() => vi.fn());
const assertPlatformCoreReady = vi.hoisted(() => vi.fn());
const publishRealmRuleRevision = vi.hoisted(() => vi.fn());
const recordAuditEvent = vi.hoisted(() => vi.fn());

vi.mock("../../config", () => ({
	env: {
		get DATABASE_URL() {
			return databaseUrl.value;
		},
	},
}));
vi.mock("../../database", () => ({ database: { transaction } }));
vi.mock("../../bootstrap/core", () => ({ inspectPlatformCore, assertPlatformCoreReady }));
vi.mock("../../realms/rule-publication", () => ({ publishRealmRuleRevision }));
vi.mock("../../audit", () => ({ recordAuditEvent }));

import type { DatabaseTransaction } from "../../database";
import { seedOfficialRuleRealm, seedOfficialRuleRealmInTransaction } from "./service";

const Transaction = { sentinel: "official-rule-transaction" } as unknown as DatabaseTransaction;

describe("Official Rule Platform Infrastructure Seed", () => {
	beforeEach(() => {
		databaseUrl.value = "postgres://test:test@localhost/rezics";
		transaction.mockReset();
		transaction.mockImplementation(async (work: (tx: DatabaseTransaction) => Promise<unknown>) =>
			work(Transaction),
		);
		inspectPlatformCore.mockReset();
		inspectPlatformCore.mockResolvedValue({ ready: true });
		assertPlatformCoreReady.mockReset();
		publishRealmRuleRevision.mockReset();
		recordAuditEvent.mockReset();
		recordAuditEvent.mockResolvedValue(undefined);
	});

	it("publishes and audits the first revision in the caller transaction", async () => {
		publishRealmRuleRevision.mockResolvedValue({
			status: "published",
			revision: { id: "revision-1", version: 1 },
		});

		await expect(
			seedOfficialRuleRealmInTransaction(Transaction, { whenSeeded: "fail" }),
		).resolves.toEqual({ status: "seeded", revisionId: "revision-1", version: 1 });
		expect(publishRealmRuleRevision).toHaveBeenCalledWith(
			Transaction,
			expect.objectContaining({ baseRevisionId: null, rules: expect.any(Array) }),
		);
		expect(recordAuditEvent).toHaveBeenCalledWith(
			Transaction,
			expect.objectContaining({ action: "realm.rules.initialize" }),
		);
	});

	it("treats existing online history as authoritative in idempotent mode", async () => {
		publishRealmRuleRevision.mockResolvedValue({
			status: "revision_changed",
			currentRevisionId: "online-revision",
		});

		await expect(
			seedOfficialRuleRealmInTransaction(Transaction, { whenSeeded: "skip" }),
		).resolves.toEqual({ status: "already_seeded", revisionId: "online-revision" });
		expect(recordAuditEvent).not.toHaveBeenCalled();
	});

	it("refuses the standalone Seed for a non-local database before inspection", async () => {
		databaseUrl.value = "postgres://test:test@db.example.test/rezics";

		await expect(seedOfficialRuleRealm({ whenSeeded: "skip" })).rejects.toThrow(
			"Refusing to seed non-local database host",
		);
		expect(inspectPlatformCore).not.toHaveBeenCalled();
		expect(transaction).not.toHaveBeenCalled();
	});

	it("keeps the standalone local command on the transaction-aware path", async () => {
		publishRealmRuleRevision.mockResolvedValue({
			status: "revision_changed",
			currentRevisionId: "local-revision",
		});

		await expect(seedOfficialRuleRealm({ whenSeeded: "skip" })).resolves.toEqual({
			status: "already_seeded",
			revisionId: "local-revision",
		});
		expect(assertPlatformCoreReady).toHaveBeenCalledWith({ ready: true });
		expect(publishRealmRuleRevision).toHaveBeenCalledWith(Transaction, expect.any(Object));
	});
});
