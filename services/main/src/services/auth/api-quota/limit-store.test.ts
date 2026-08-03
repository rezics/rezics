import { describe, expect, it, vi } from "vitest";
import { getActiveObservability } from "@rezics/observability";

import { database } from "../../database";
import { resolveApiQuotaOperation } from "./operation";
import { DefaultApiQuotaPolicies } from "./policy-schema";
import {
	ApiQuotaRequestLeaseDurationMilliseconds,
	ApiQuotaRateUnitScale,
	buildApiQuotaConstraints,
	enforceApiQuota,
	refillApiQuotaRateState,
} from "./limit-store";

const accountPolicy = {
	userId: "01983000-0000-7000-8000-000000000001",
	policyId: "01983000-0000-7000-8000-000000000002",
	key: "standard-default",
	class: "standard" as const,
	schemaVersion: 1,
	policyRevision: 1,
	bindingRevision: null,
	validUntil: null,
	assignmentReason: null,
	configurationOverride: {},
	configuration: DefaultApiQuotaPolicies.accountStandard.configuration,
	source: "standard_default" as const,
};

const tokenPolicy = {
	tokenId: "01983000-0000-7000-8000-000000000003",
	policyId: "01983000-0000-7000-8000-000000000004",
	key: "token-standard-default",
	class: "standard" as const,
	schemaVersion: 1,
	policyRevision: 1,
	bindingRevision: null,
	validUntil: null,
	assignmentReason: null,
	configurationOverride: {},
	configuration: DefaultApiQuotaPolicies.tokenStandard.configuration,
	source: "standard_default" as const,
};

describe("API quota admission model", () => {
	it("always includes an account constraint even when a token has its own safeguards", () => {
		const constraints = buildApiQuotaConstraints({
			accountUserId: accountPolicy.userId,
			tokenId: tokenPolicy.tokenId,
			operation: resolveApiQuotaOperation("getApiUnits"),
			accountPolicy,
			tokenPolicy,
			tokenSafeguard: {
				limits: { requestRate: { requestsPerMinute: 5, burstCapacity: 2 } },
			},
		});

		expect(constraints).toHaveLength(2);
		expect(constraints.map(({ subject }) => subject.kind)).toEqual(["account", "token"]);
	});

	it("makes different tokens share the same account constraint identity", () => {
		const common = {
			accountUserId: accountPolicy.userId,
			operation: resolveApiQuotaOperation("getApiUnits"),
			accountPolicy,
			tokenPolicy,
		};
		const first = buildApiQuotaConstraints({ ...common, tokenId: "token-a" });
		const second = buildApiQuotaConstraints({ ...common, tokenId: "token-b" });

		expect(first[0]?.subject).toEqual(second[0]?.subject);
		expect(first[0]?.subject).toEqual({ kind: "account", id: accountPolicy.userId });
	});

	it("starts at burst capacity and refills continuously at the configured RPM", () => {
		const startedAt = new Date("2026-07-31T10:00:00.000Z");
		const rate = { requestsPerMinute: 60, burstCapacity: 10 };
		const initial = refillApiQuotaRateState(undefined, rate, startedAt);
		expect(initial.availableRateUnits).toBe(10 * ApiQuotaRateUnitScale);

		const refilled = refillApiQuotaRateState(
			{
				availableRateUnits: initial.availableRateUnits - ApiQuotaRateUnitScale,
				refilledAt: startedAt,
			},
			rate,
			new Date(startedAt.getTime() + 1_000),
		);
		expect(refilled.availableRateUnits).toBe(initial.availableRateUnits);
	});

	it("keeps a two-minute crash-recovery expiry", () => {
		expect(ApiQuotaRequestLeaseDurationMilliseconds).toBe(120_000);
	});

	it("logs a failed release once and leaves expiry as the fallback", async () => {
		const failure = new Error("database unavailable");
		const transaction = vi.spyOn(database, "transaction").mockResolvedValue(undefined);
		const where = vi.fn(async () => {
			throw failure;
		});
		// The release path consumes only `where`; the test double deliberately exposes no other query powers.
		const deleteLease = vi.spyOn(database, "delete").mockReturnValue({ where } as never);
		const logError = vi
			.spyOn(getActiveObservability().logger, "error")
			.mockImplementation(() => undefined);
		const lease = await enforceApiQuota({
			accountUserId: accountPolicy.userId,
			tokenId: tokenPolicy.tokenId,
			operation: resolveApiQuotaOperation("getApiUnits"),
			accountPolicy,
			tokenPolicy,
		});

		await lease.release();
		await lease.release();

		expect(transaction).toHaveBeenCalledOnce();
		expect(deleteLease).toHaveBeenCalledOnce();
		expect(where).toHaveBeenCalledOnce();
		expect(logError).toHaveBeenCalledWith(
			"Failed to release API quota concurrency leases",
			expect.objectContaining({
				eventName: "api_quota.lease.release_failed",
				errorCode: "ApiQuotaLeaseReleaseFailed",
				error: failure,
			}),
		);
	});
});
