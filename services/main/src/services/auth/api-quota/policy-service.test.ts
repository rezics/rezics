import { describe, expect, it } from "vitest";

import type { DatabaseExecutor } from "../../database";
import { DefaultApiQuotaPolicies } from "./policy-schema";
import { resolveApiAccountQuotaPolicy, resolveApiTokenQuotaPolicy } from "./policy-service";

const now = new Date("2026-07-31T10:00:00.000Z");

const standardPolicy = {
	id: "01983000-0000-7000-8000-000000000001",
	key: DefaultApiQuotaPolicies.accountStandard.key,
	subjectKind: "account" as const,
	class: "standard" as const,
	currentRevision: 1,
	enabled: true,
	createdAt: new Date("2026-07-01T00:00:00.000Z"),
	updatedAt: new Date("2026-07-01T00:00:00.000Z"),
};

const standardRevision = {
	policyId: standardPolicy.id,
	revision: 1,
	schemaVersion: 1,
	configuration: DefaultApiQuotaPolicies.accountStandard.configuration,
	changeReason: "Initial policy",
	createdByProfileId: null,
	createdAt: new Date("2026-07-01T00:00:00.000Z"),
};

const privilegedPolicy = {
	...standardPolicy,
	id: "01983000-0000-7000-8000-000000000002",
	key: DefaultApiQuotaPolicies.accountPrivileged.key,
	class: "privileged" as const,
};

const privilegedRevision = {
	...standardRevision,
	policyId: privilegedPolicy.id,
	configuration: DefaultApiQuotaPolicies.accountPrivileged.configuration,
};

const privilegedBinding = {
	userId: "01983000-0000-7000-8000-000000000010",
	policyId: privilegedPolicy.id,
	policySubjectKind: "account" as const,
	configurationOverride: {},
	validUntil: new Date("2026-08-01T10:00:00.000Z"),
	assignmentReason: "Reviewed integration workload",
	assignedByProfileId: "01983000-0000-7000-8000-000000000020",
	revision: 1,
	createdAt: new Date("2026-07-30T10:00:00.000Z"),
	updatedAt: new Date("2026-07-30T10:00:00.000Z"),
};

function queuedSelectExecutor(...responses: unknown[][]): DatabaseExecutor {
	let cursor = 0;
	return {
		select() {
			const builder = {
				from() {
					return builder;
				},
				innerJoin() {
					return builder;
				},
				where() {
					return builder;
				},
				limit() {
					return Promise.resolve(responses[cursor++] ?? []);
				},
			};
			return builder;
		},
	} as unknown as DatabaseExecutor;
}

describe("API account quota policy resolution", () => {
	it("uses the Standard policy when an account has no binding", async () => {
		const resolved = await resolveApiAccountQuotaPolicy(privilegedBinding.userId, {
			executor: queuedSelectExecutor(
				[],
				[{ policy: standardPolicy, revision: standardRevision }],
			),
			now,
		});

		expect(resolved.source).toBe("standard_default");
		expect(resolved.class).toBe("standard");
		expect(resolved.configuration).toEqual(
			DefaultApiQuotaPolicies.accountStandard.configuration,
		);
	});

	it("applies an account override without changing the source policy revision", async () => {
		const binding = {
			...privilegedBinding,
			configurationOverride: { limits: { dailyCostUnits: 20_000 } },
		};
		const resolved = await resolveApiAccountQuotaPolicy(binding.userId, {
			executor: queuedSelectExecutor([
				{ binding, policy: privilegedPolicy, revision: privilegedRevision },
			]),
			now,
		});

		expect(resolved.source).toBe("assigned");
		expect(resolved.policyRevision).toBe(1);
		expect(resolved.bindingRevision).toBe(1);
		expect(resolved.configurationOverride).toEqual({
			limits: { dailyCostUnits: 20_000 },
		});
		expect(resolved.configuration.limits.dailyCostUnits).toBe(20_000);
	});

	it("ignores a privileged override after the assignment expires", async () => {
		const binding = {
			...privilegedBinding,
			configurationOverride: { limits: { dailyCostUnits: 999_999 } },
			validUntil: new Date("2026-07-31T09:59:59.999Z"),
		};
		const resolved = await resolveApiAccountQuotaPolicy(binding.userId, {
			executor: queuedSelectExecutor(
				[{ binding, policy: privilegedPolicy, revision: privilegedRevision }],
				[{ policy: standardPolicy, revision: standardRevision }],
			),
			now,
		});

		expect(resolved.source).toBe("privileged_fallback");
		expect(resolved.class).toBe("standard");
		expect(resolved.bindingRevision).toBe(binding.revision);
		expect(resolved.configurationOverride).toEqual({});
		expect(resolved.configuration.limits.dailyCostUnits).toBe(2_000);
	});
});

describe("API token quota policy resolution", () => {
	it("uses an independent Standard token policy when a token has no binding", async () => {
		const tokenStandardPolicy = {
			...standardPolicy,
			id: "01983000-0000-7000-8000-000000000030",
			key: DefaultApiQuotaPolicies.tokenStandard.key,
			subjectKind: "token" as const,
		};
		const tokenStandardRevision = {
			...standardRevision,
			policyId: tokenStandardPolicy.id,
			configuration: DefaultApiQuotaPolicies.tokenStandard.configuration,
		};
		const resolved = await resolveApiTokenQuotaPolicy("01983000-0000-7000-8000-000000000031", {
			executor: queuedSelectExecutor(
				[],
				[{ policy: tokenStandardPolicy, revision: tokenStandardRevision }],
			),
			now,
		});

		expect(resolved.source).toBe("standard_default");
		expect(resolved.configuration).toEqual(DefaultApiQuotaPolicies.tokenStandard.configuration);
	});
});
