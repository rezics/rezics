import { describe, expect, it } from "vitest";

import {
	ApiQuotaPolicyDocumentInvalid,
	DefaultApiQuotaPolicies,
	applyApiAccountQuotaOverride,
	decodeApiAccountQuotaOverride,
	decodeApiQuotaPolicyConfiguration,
	decodeApiTokenQuotaOverride,
	resolveApiQuotaLimits,
	resolveApiTokenQuotaLimits,
} from "./policy-schema";

describe("API quota policy documents", () => {
	it("decodes the default policy and applies an account override", () => {
		const configuration = decodeApiQuotaPolicyConfiguration(
			"standard",
			1,
			DefaultApiQuotaPolicies.standard.configuration,
		);
		const override = decodeApiAccountQuotaOverride("standard", 1, {
			limits: { requestRate: { requestsPerMinute: 120, burstCapacity: 10 } },
			operations: { "search.execute": { maxConcurrentRequests: 1 } },
		});
		expect(applyApiAccountQuotaOverride(configuration, override)).toMatchObject({
			limits: { requestRate: { requestsPerMinute: 120, burstCapacity: 10 } },
			maxActiveTokens: 10,
			operations: { "search.execute": { maxConcurrentRequests: 1 } },
		});
	});

	it("rejects unknown operation IDs at the persisted boundary", () => {
		expect(() =>
			decodeApiAccountQuotaOverride("standard", 1, {
				operations: {
					typoOperation: { requestRate: { requestsPerMinute: 1, burstCapacity: 1 } },
				},
			}),
		).toThrow(ApiQuotaPolicyDocumentInvalid);
	});

	it("rejects account overrides outside the assigned policy class", () => {
		expect(() =>
			decodeApiAccountQuotaOverride("standard", 1, {
				limits: { requestRate: { requestsPerMinute: 301, burstCapacity: 10 } },
			}),
		).toThrow(ApiQuotaPolicyDocumentInvalid);
	});

	it("resolves account global and operation constraints together", () => {
		const configuration = applyApiAccountQuotaOverride(
			DefaultApiQuotaPolicies.standard.configuration,
			{
				operations: {
					"search.execute": {
						requestRate: { requestsPerMinute: 10, burstCapacity: 2 },
					},
				},
			},
		);
		expect(resolveApiQuotaLimits(configuration, "search.execute")).toEqual({
			global: DefaultApiQuotaPolicies.standard.configuration.limits,
			operation: {
				...DefaultApiQuotaPolicies.standard.configuration.limits,
				requestRate: { requestsPerMinute: 10, burstCapacity: 2 },
			},
		});
	});

	it("keeps token safeguards independent from the account policy", () => {
		const override = decodeApiTokenQuotaOverride({
			limits: { requestRate: { requestsPerMinute: 30, burstCapacity: 5 } },
			operations: { "image.upload": { dailyCostUnits: 50 } },
		});
		expect(resolveApiTokenQuotaLimits(override, "image.upload")).toEqual({
			global: { requestRate: { requestsPerMinute: 30, burstCapacity: 5 } },
			operation: {
				requestRate: { requestsPerMinute: 30, burstCapacity: 5 },
				dailyCostUnits: 50,
			},
		});
	});

	it("requires a complete rate constraint whenever a partial override sets one", () => {
		expect(() =>
			decodeApiTokenQuotaOverride({
				limits: { requestRate: { requestsPerMinute: 30 } },
			}),
		).toThrow(ApiQuotaPolicyDocumentInvalid);
	});
});
