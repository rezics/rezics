import { describe, expect, it } from "vitest";

import type { DatabaseExecutor, DatabaseTransaction } from "../../database";
import { DefaultApiQuotaPolicies } from "./policy-schema";
import {
	createApiQuotaPolicy,
	resolveApiAccountQuotaPolicy,
	resolveApiTokenQuotaPolicy,
} from "./policy-service";

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

function createPolicyTransaction(options: { readonly conflict?: boolean } = {}) {
	const insertedValues: unknown[] = [];
	let insertIndex = 0;
	const policy = {
		id: "01983000-0000-7000-8000-000000000040",
		key: "partner-account",
		subjectKind: "account" as const,
		class: "standard" as const,
		currentRevision: 1,
		enabled: true,
		createdAt: now,
		updatedAt: now,
	};
	const revision = {
		policyId: policy.id,
		revision: 1,
		schemaVersion: 1,
		configuration: {
			limits: {
				requestRate: { requestsPerMinute: 25_000, burstCapacity: 2_500 },
				maxConcurrentRequests: 128,
				dailyCostUnits: 5_000_000,
			},
			maxActiveTokens: 100,
			operations: {},
		},
		changeReason: "Partner workload",
		createdByProfileId: "01983000-0000-7000-8000-000000000020",
		createdAt: now,
	};
	const transaction = {
		insert() {
			const currentIndex = insertIndex++;
			return {
				values(values: unknown) {
					insertedValues.push(values);
					if (currentIndex === 0)
						return {
							onConflictDoNothing() {
								return {
									returning: async () => (options.conflict ? [] : [policy]),
								};
							},
						};
					return { returning: async () => [revision] };
				},
			};
		},
	} as unknown as DatabaseTransaction;
	return { insertedValues, transaction };
}

describe("API quota policy creation", () => {
	it("creates an account policy and immutable initial revision atomically", async () => {
		const { insertedValues, transaction } = createPolicyTransaction();
		const created = await createApiQuotaPolicy(transaction, {
			key: "partner-account",
			subjectKind: "account",
			class: "standard",
			configuration: {
				limits: {
					requestRate: { requestsPerMinute: 25_000, burstCapacity: 2_500 },
					maxConcurrentRequests: 128,
					dailyCostUnits: 5_000_000,
				},
				maxActiveTokens: 100,
				operations: {},
			},
			reason: " Partner workload ",
			actorProfileId: "01983000-0000-7000-8000-000000000020",
		});

		expect(created).toMatchObject({
			key: "partner-account",
			subjectKind: "account",
			class: "standard",
			revision: 1,
			configuration: {
				limits: { requestRate: { requestsPerMinute: 25_000 } },
			},
		});
		expect(insertedValues).toHaveLength(2);
		expect(insertedValues[1]).toMatchObject({
			revision: 1,
			changeReason: "Partner workload",
		});
	});

	it("reports a duplicate key without creating an orphan revision", async () => {
		const { insertedValues, transaction } = createPolicyTransaction({ conflict: true });
		expect(
			await createApiQuotaPolicy(transaction, {
				key: "partner-account",
				subjectKind: "account",
				class: "standard",
				configuration: DefaultApiQuotaPolicies.accountStandard.configuration,
				reason: "Duplicate",
				actorProfileId: "01983000-0000-7000-8000-000000000020",
			}),
		).toBeUndefined();
		expect(insertedValues).toHaveLength(1);
	});
});

describe("API account quota policy resolution", () => {
	it("uses the Standard policy when an account has no binding", async () => {
		const resolved = await resolveApiAccountQuotaPolicy(privilegedBinding.userId, {
			executor: queuedSelectExecutor([], [{ policy: standardPolicy, revision: standardRevision }]),
			now,
		});

		expect(resolved.source).toBe("standard_default");
		expect(resolved.class).toBe("standard");
		expect(resolved.configuration).toEqual(DefaultApiQuotaPolicies.accountStandard.configuration);
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
