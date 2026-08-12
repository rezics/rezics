import { beforeEach, describe, expect, it, vi } from "vitest";

const seedOfficialRuleRealmInTransaction = vi.hoisted(() => vi.fn());

vi.mock("./official-rule-realm/service", () => ({ seedOfficialRuleRealmInTransaction }));

import type { DatabaseTransaction } from "../database";
import {
	PlatformInfrastructureSeedKeys,
	seedPlatformInfrastructure,
} from "./platform-infrastructure";

describe("Platform Infrastructure Seed registry", () => {
	beforeEach(() => seedOfficialRuleRealmInTransaction.mockReset());

	it("declares the bounded local/CI infrastructure providers", () => {
		expect(PlatformInfrastructureSeedKeys).toEqual(["official-rule-realm"]);
	});

	it("delegates only its transaction and domain-local idempotency policy", async () => {
		const transaction = { sentinel: "same-transaction" } as unknown as DatabaseTransaction;
		seedOfficialRuleRealmInTransaction.mockResolvedValue({
			status: "already_seeded",
			revisionId: "revision-id",
		});

		await seedPlatformInfrastructure(transaction);

		expect(seedOfficialRuleRealmInTransaction).toHaveBeenCalledExactlyOnceWith(transaction, {
			whenSeeded: "skip",
		});
	});
});
