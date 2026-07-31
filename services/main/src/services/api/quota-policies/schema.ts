import { t } from "elysia";

import {
	PrivilegedApiAccountQuotaOverride,
	PrivilegedApiQuotaPolicyConfiguration,
} from "../../auth/api-quota/policy-schema";
import { ApiQuotaPolicyClassValues } from "../../database/schema";
import { DateTime, Uuid } from "../schema";
import { ApiAccountQuotaPolicyResponse } from "../tokens/schema";

export const ApiQuotaPolicySummary = t.Object({
	id: Uuid,
	key: t.String(),
	class: t.UnionEnum(ApiQuotaPolicyClassValues),
	schemaVersion: t.Integer({ minimum: 1 }),
	configuration: PrivilegedApiQuotaPolicyConfiguration,
	revision: t.Integer({ minimum: 1 }),
	enabled: t.Boolean(),
	updatedAt: DateTime,
});

export const ApiQuotaPolicyListResponse = t.Object({
	items: t.Array(ApiQuotaPolicySummary),
});

export const ApiQuotaPolicyParams = t.Object({
	policyKey: t.String({ minLength: 1, maxLength: 64 }),
});

export const ReviseApiQuotaPolicyBody = t.Object(
	{
		expectedRevision: t.Integer({ minimum: 1 }),
		configuration: PrivilegedApiQuotaPolicyConfiguration,
		reason: t.String({ minLength: 1, maxLength: 1_000 }),
	},
	{ additionalProperties: false },
);

export const ApiAccountQuotaParams = t.Object({ userId: Uuid });

export const AssignApiAccountQuotaBody = t.Object(
	{
		expectedRevision: t.Integer({ minimum: 0 }),
		policyKey: t.String({ minLength: 1, maxLength: 64 }),
		validUntil: t.Optional(DateTime),
		reason: t.String({ minLength: 1, maxLength: 1_000 }),
		configurationOverride: t.Optional(PrivilegedApiAccountQuotaOverride),
	},
	{ additionalProperties: false },
);

export const ResetApiAccountQuotaBody = t.Object(
	{ expectedRevision: t.Integer({ minimum: 1 }) },
	{ additionalProperties: false },
);

export { ApiAccountQuotaPolicyResponse };
