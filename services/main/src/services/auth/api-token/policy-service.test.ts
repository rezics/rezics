import { describe, expect, it } from "vitest";

import type { DatabaseExecutor } from "../../database";
import { ApiTokenPolicyDocumentInvalid, DefaultApiTokenPolicies } from "./policy-schema";
import { resolveApiTokenPolicy } from "./policy-service";

const now = new Date("2026-07-22T10:00:00.000Z");

const standardPolicy = {
	id: "01983000-0000-7000-8000-000000000001",
	key: DefaultApiTokenPolicies.standard.key,
	kind: "standard" as const,
	schemaVersion: 1,
	configuration: DefaultApiTokenPolicies.standard.configuration,
	revision: 1,
	enabled: true,
	updatedByProfileId: null,
	createdAt: new Date("2026-07-01T00:00:00.000Z"),
	updatedAt: new Date("2026-07-01T00:00:00.000Z"),
};

const trustedPolicy = {
	...standardPolicy,
	id: "01983000-0000-7000-8000-000000000002",
	key: DefaultApiTokenPolicies.privileged.key,
	kind: "privileged" as const,
	configuration: DefaultApiTokenPolicies.privileged.configuration,
};

const trustedBinding = {
	tokenId: "01983000-0000-7000-8000-000000000010",
	policyId: trustedPolicy.id,
	configurationOverride: {},
	validUntil: new Date("2026-07-23T10:00:00.000Z"),
	assignedByProfileId: "01983000-0000-7000-8000-000000000020",
	assignmentReason: "Reviewed import workload",
	revision: 1,
	createdAt: new Date("2026-07-21T10:00:00.000Z"),
	updatedAt: new Date("2026-07-21T10:00:00.000Z"),
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

describe("API token policy resolution", () => {
	it("uses the database Standard policy when a token has no binding", async () => {
		const policy = await resolveApiTokenPolicy(trustedBinding.tokenId, {
			executor: queuedSelectExecutor([], [standardPolicy]),
			now,
		});

		expect(policy.source).toBe("standard_default");
		expect(policy.kind).toBe("standard");
		expect(policy.configuration).toEqual(DefaultApiTokenPolicies.standard.configuration);
	});

	it("falls back to Standard after a Privileged assignment expires", async () => {
		const expiredBinding = {
			...trustedBinding,
			validUntil: new Date("2026-07-22T09:59:59.999Z"),
		};
		const policy = await resolveApiTokenPolicy(trustedBinding.tokenId, {
			executor: queuedSelectExecutor(
				[{ binding: expiredBinding, policy: trustedPolicy }],
				[standardPolicy],
			),
			now,
		});

		expect(policy.source).toBe("trusted_fallback");
		expect(policy.kind).toBe("standard");
		expect(policy.bindingRevision).toBe(expiredBinding.revision);
		expect(policy.validUntil).toEqual(expiredBinding.validUntil);
	});

	it("falls back when a Privileged JSON document fails runtime validation", async () => {
		const invalidTrusted = { ...trustedPolicy, configuration: { unlimited: true } };
		const policy = await resolveApiTokenPolicy(trustedBinding.tokenId, {
			executor: queuedSelectExecutor(
				[{ binding: trustedBinding, policy: invalidTrusted }],
				[standardPolicy],
			),
			now,
		});

		expect(policy.source).toBe("trusted_fallback");
		expect(policy.kind).toBe("standard");
	});

	it("fails closed when an assigned Standard document is invalid", async () => {
		const standardBinding = {
			...trustedBinding,
			policyId: standardPolicy.id,
			validUntil: null,
		};
		const invalidStandard = { ...standardPolicy, configuration: { unlimited: true } };

		await expect(
			resolveApiTokenPolicy(trustedBinding.tokenId, {
				executor: queuedSelectExecutor([
					{ binding: standardBinding, policy: invalidStandard },
				]),
				now,
			}),
		).rejects.toBeInstanceOf(ApiTokenPolicyDocumentInvalid);
	});
});
