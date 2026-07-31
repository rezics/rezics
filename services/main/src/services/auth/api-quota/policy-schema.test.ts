import { describe, expect, it } from "vitest";

import {
	ApiQuotaPolicyDocumentInvalid,
	DefaultApiQuotaPolicies,
	applyApiAccountQuotaOverride,
	applyApiTokenQuotaSafeguard,
	decodeApiAccountQuotaOverride,
	decodeApiAccountQuotaPolicyConfiguration,
	decodeApiTokenQuotaOverride,
	resolveApiQuotaLimits,
} from "./policy-schema";

describe("API quota policy documents", () => {
	it("decodes the default policy and applies an account override", () => {
		const configuration = decodeApiAccountQuotaPolicyConfiguration(
			"standard",
			1,
			DefaultApiQuotaPolicies.accountStandard.configuration,
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
			DefaultApiQuotaPolicies.accountStandard.configuration,
			{
				operations: {
					"search.execute": {
						requestRate: { requestsPerMinute: 10, burstCapacity: 2 },
					},
				},
			},
		);
		expect(resolveApiQuotaLimits(configuration, "search.execute")).toEqual({
			global: DefaultApiQuotaPolicies.accountStandard.configuration.limits,
			operation: {
				...DefaultApiQuotaPolicies.accountStandard.configuration.limits,
				requestRate: { requestsPerMinute: 10, burstCapacity: 2 },
			},
		});
	});

	it("only lets an owner-managed token safeguard tighten the token policy", () => {
		const override = decodeApiTokenQuotaOverride({
			limits: { requestRate: { requestsPerMinute: 300, burstCapacity: 5 } },
			operations: { "image.upload": { dailyCostUnits: 50 } },
		});
		const effective = applyApiTokenQuotaSafeguard(
			DefaultApiQuotaPolicies.tokenStandard.configuration,
			override,
		);
		expect(resolveApiQuotaLimits(effective, "image.upload")).toEqual({
			global: {
				...DefaultApiQuotaPolicies.tokenStandard.configuration.limits,
				requestRate: { requestsPerMinute: 60, burstCapacity: 5 },
			},
			operation: {
				...DefaultApiQuotaPolicies.tokenStandard.configuration.limits,
				requestRate: { requestsPerMinute: 60, burstCapacity: 5 },
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
