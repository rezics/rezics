import { describe, expect, it, vi } from "vitest";

import type { DatabaseTransaction } from "../database";
import { acknowledgeCurrentRealmRulesOnFollow } from "./service";

function createTransaction(
	rules:
		| {
				revisionId: string;
				acknowledgementMode: "explicit" | "implicit_on_follow";
		  }
		| undefined,
) {
	const limit = vi.fn(async () => (rules ? [rules] : []));
	const orderBy = vi.fn(() => ({ limit }));
	const where = vi.fn(() => ({ orderBy }));
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	const onConflictDoNothing = vi.fn(async () => undefined);
	const values = vi.fn(() => ({ onConflictDoNothing }));
	const insert = vi.fn(() => ({ values }));
	const transaction = { select, insert } as unknown as DatabaseTransaction;
	return { transaction, insert, values, onConflictDoNothing };
}

describe("Realm rule acknowledgement on follow", () => {
	it("records the current revision for implicit-on-follow rules", async () => {
		const revisionId = "019f94d1-c8ca-7110-b984-b0614ba4db9d";
		const profileId = "019f94d1-c8ca-7110-b984-b0614ba4db9c";
		const { transaction, values, onConflictDoNothing } = createTransaction({
			revisionId,
			acknowledgementMode: "implicit_on_follow",
		});

		await acknowledgeCurrentRealmRulesOnFollow(transaction, "realm-id", profileId);

		expect(values).toHaveBeenCalledWith({
			revisionId,
			profileId,
			language: null,
		});
		expect(onConflictDoNothing).toHaveBeenCalledOnce();
	});

	it("does not infer acknowledgement for explicit rules", async () => {
		const { transaction, insert } = createTransaction({
			revisionId: "019f94d1-c8ca-7110-b984-b0614ba4db9d",
			acknowledgementMode: "explicit",
		});

		await acknowledgeCurrentRealmRulesOnFollow(transaction, "realm-id", "profile-id");

		expect(insert).not.toHaveBeenCalled();
	});
});
