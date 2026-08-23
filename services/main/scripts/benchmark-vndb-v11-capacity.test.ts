import { describe, expect, it } from "vitest";

import {
	createDisposableCapacityClient,
	realHotKeyAttemptAccountingIsExact,
	realHotKeySchemaReady,
	realHotKeyTerminalAccountingIsExact,
} from "./benchmark-vndb-v11-capacity";

describe("VNDB v11 capacity benchmark target preflight", () => {
	it.each([
		["postgres://postgres:postgres@localhost:5433/rezics_atlas", "localhost"],
		["postgresql://postgres:postgres@127.0.0.1/rezics_atlas?sslmode=disable", "127.0.0.1"],
		["postgres://postgres:postgres@[::1]:5433/rezics_atlas", "[::1]"],
	])("accepts a disposable loopback PostgreSQL URL", (connectionString, expectedHost) => {
		const client = createDisposableCapacityClient(connectionString);

		expect(client.host).toBe(expectedHost);
		expect(client.database).toBe("rezics_atlas");
	});

	it.each([
		"not a URL",
		"mysql://localhost/rezics_atlas",
		"postgres://database.example/rezics_atlas",
		"postgres://127.0.0.2/rezics_atlas",
		"postgres://localhost./rezics_atlas",
		"postgres://localhost/postgres",
		"postgres://localhost/rezics_atlas/",
		"postgres://localhost/%72ezics_atlas",
		"postgres://localhost/rezics_atlas?host=database.example",
		"postgres://localhost/rezics_atlas?host=%2Fvar%2Frun%2Fpostgresql",
	])("rejects a target outside the exact disposable fixture", (connectionString) => {
		expect(() => createDisposableCapacityClient(connectionString)).toThrow();
	});
});

describe("VNDB v11 real hot-key accounting", () => {
	it("partitions every attempted transaction into exactly one outcome", () => {
		expect(
			realHotKeyAttemptAccountingIsExact({
				attemptedTransactions: 10,
				backpressuredAttempts: 3,
				deadlocks: 1,
				otherErrors: 1,
				succeededRequests: 4,
				timedOutAttempts: 1,
			}),
		).toBe(true);
		expect(
			realHotKeyAttemptAccountingIsExact({
				attemptedTransactions: 9,
				backpressuredAttempts: 3,
				deadlocks: 1,
				otherErrors: 1,
				succeededRequests: 4,
				timedOutAttempts: 1,
			}),
		).toBe(false);
	});

	it("partitions every logical request into exactly one terminal outcome", () => {
		expect(
			realHotKeyTerminalAccountingIsExact({
				logicalRequests: 10,
				succeededRequests: 6,
				terminalBackpressuredRequests: 1,
				terminalDeadlockRequests: 1,
				terminalOtherErrorRequests: 1,
				terminalTimedOutRequests: 1,
			}),
		).toBe(true);
		expect(
			realHotKeyTerminalAccountingIsExact({
				logicalRequests: 11,
				succeededRequests: 6,
				terminalBackpressuredRequests: 1,
				terminalDeadlockRequests: 1,
				terminalOtherErrorRequests: 1,
				terminalTimedOutRequests: 1,
			}),
		).toBe(false);
	});
});

describe("VNDB v11 real hot-key schema readiness", () => {
	const ready = {
		controlState: "postcontract_open",
		fenceInventoryExact: true,
		fenceTriggerCount: 14,
		functionInstalled: true,
		globalAdmissionIsFailFast: true,
		globalAdmissionTriggerInstalled: true,
		globalFenceTriggerInstalled: true,
		globalTableInstalled: true,
		hotKeyTriggerCount: 2,
		realmAdmissionIsFailFast: true,
		realmAdmissionTriggerInstalled: true,
		realmFenceTriggerInstalled: true,
		realmTableInstalled: true,
		unitTagAdmissionTriggerInstalled: true,
		unitTagJudgmentAdmissionTriggerInstalled: true,
		writerFenceBodyOrderValid: true,
		writerFenceInstalled: true,
		writerFenceTransitionUsesExclusiveKey: true,
		writerFenceUsesFixedAdvisoryKey: true,
	} as const;

	it("accepts only the complete exact trigger and fence inventory", () => {
		expect(realHotKeySchemaReady(ready)).toBe(true);
		expect(realHotKeySchemaReady({ ...ready, realmAdmissionTriggerInstalled: false })).toBe(false);
		expect(realHotKeySchemaReady({ ...ready, hotKeyTriggerCount: 1 })).toBe(false);
		expect(realHotKeySchemaReady({ ...ready, fenceInventoryExact: false })).toBe(false);
		expect(realHotKeySchemaReady({ ...ready, fenceTriggerCount: 13 })).toBe(false);
	});
});
