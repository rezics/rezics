import { describe, expect, it } from "vitest";

import {
	ApiTokenPolicyDocumentInvalid,
	DefaultApiTokenPolicies,
	decodeTokenPolicyConfiguration,
	decodeTokenPolicyOverride,
	mergeTokenPolicy,
	resolveTokenOperationLimits,
} from "./policy-schema";

describe("API token policy schemas", () => {
	it("accepts the configured defaults through their runtime schemas", () => {
		for (const definition of Object.values(DefaultApiTokenPolicies)) {
			expect(
				decodeTokenPolicyConfiguration(
					definition.kind,
					definition.schemaVersion,
					definition.configuration,
				),
			).toEqual(definition.configuration);
		}
	});

	it("uses different safety bounds for standard and Staff Trusted tokens", () => {
		const trustedOverride = {
			limits: { requestsPerMinute: 1_000, maxConcurrentRequests: 16 },
		};
		expect(decodeTokenPolicyOverride("staff_trusted", 1, trustedOverride)).toEqual(
			trustedOverride,
		);
		expect(() => decodeTokenPolicyOverride("standard", 1, trustedOverride)).toThrow(
			ApiTokenPolicyDocumentInvalid,
		);
	});

	it("merges explicit token and operation overrides without generic deep-merge semantics", () => {
		const configuration = mergeTokenPolicy(DefaultApiTokenPolicies.standard.configuration, {
			limits: { requestsPerMinute: 30 },
			operations: {
				getApiUnits: { requestsPerMinute: 10, maxConcurrentRequests: 1 },
			},
		});

		expect(configuration.limits).toEqual({
			requestsPerMinute: 30,
			maxConcurrentRequests: 2,
			dailyCostUnits: 2_000,
		});
		expect(resolveTokenOperationLimits(configuration, "getApiUnits")).toEqual({
			global: configuration.limits,
			operation: {
				requestsPerMinute: 10,
				maxConcurrentRequests: 1,
				dailyCostUnits: 2_000,
			},
		});
	});

	it("rejects unknown schema versions and unknown fields", () => {
		expect(() => decodeTokenPolicyOverride("standard", 2, {})).toThrow(
			ApiTokenPolicyDocumentInvalid,
		);
		expect(() => decodeTokenPolicyOverride("standard", 1, { unlimited: true })).toThrow(
			ApiTokenPolicyDocumentInvalid,
		);
	});
});
