import { describe, expect, it } from "vitest";

import { resolveApiQuotaOperation } from "./operation";
import { DefaultApiQuotaPolicies } from "./policy-schema";
import {
	ApiQuotaRateUnitScale,
	buildApiQuotaConstraints,
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
	configuration: DefaultApiQuotaPolicies.standard.configuration,
	source: "standard_default" as const,
};

describe("API quota admission model", () => {
	it("always includes an account constraint even when a token has its own safeguards", () => {
		const constraints = buildApiQuotaConstraints({
			accountUserId: accountPolicy.userId,
			tokenId: "01983000-0000-7000-8000-000000000003",
			operation: resolveApiQuotaOperation("getApiUnits"),
			accountPolicy,
			tokenOverride: {
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
});
