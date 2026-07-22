import { t } from "elysia";

import {
	ApiTokenOperationId,
	ApiTokenPolicyOverrideInput,
	StaffTrustedTokenOperationLimits,
	StaffTrustedTokenPolicyConfiguration,
	StaffTrustedTokenPolicyLimits,
} from "../../auth/api-token/policy-schema";
import { ApiTokenPolicyKindValues } from "../../database/schema";
import { DateTime, Uuid } from "../schema";

const PolicyConfiguration = t.Object({
	limits: StaffTrustedTokenPolicyLimits,
	operations: t.Record(ApiTokenOperationId, StaffTrustedTokenOperationLimits),
});

export const ApiAccessPolicySummary = t.Object({
	id: Uuid,
	key: t.String(),
	kind: t.UnionEnum(ApiTokenPolicyKindValues),
	schemaVersion: t.Integer({ minimum: 1 }),
	configuration: PolicyConfiguration,
	revision: t.Integer({ minimum: 1 }),
	enabled: t.Boolean(),
	updatedAt: DateTime,
});

export const ApiAccessPolicyListResponse = t.Object({ items: t.Array(ApiAccessPolicySummary) });

export const ApiAccessPolicyParams = t.Object({ policyKey: t.String({ minLength: 1 }) });

export const ReplaceApiAccessPolicyBody = t.Object(
	{
		expectedRevision: t.Integer({ minimum: 1 }),
		configuration: StaffTrustedTokenPolicyConfiguration,
	},
	{ additionalProperties: false },
);

export const ApiTokenPolicyBindingParams = t.Object({ tokenId: Uuid });

export const AssignApiTokenPolicyBody = t.Object(
	{
		policyKey: t.String({ minLength: 1, maxLength: 64 }),
		validUntil: t.Optional(DateTime),
		reason: t.String({ minLength: 1, maxLength: 500 }),
		configurationOverride: t.Optional(ApiTokenPolicyOverrideInput),
	},
	{ additionalProperties: false },
);
