import { t } from "elysia";

import {
	ApiTokenQuotaOverrideInput,
	PrivilegedApiAccountQuotaOverride,
	PrivilegedApiAccountQuotaPolicyConfiguration,
	PrivilegedApiTokenQuotaPolicyConfiguration,
} from "../../auth/api-quota/policy-schema";
import { ApiQuotaPolicyClassValues, ApiQuotaPolicySubjectKindValues } from "../../database/schema";
import { DateTime, Uuid } from "../schema";
import { ApiAccountQuotaPolicyResponse, ApiTokenQuotaPolicyResponse } from "../tokens/schema";

export const ApiQuotaPolicySummary = t.Object({
	id: Uuid,
	key: t.String(),
	subjectKind: t.UnionEnum(ApiQuotaPolicySubjectKindValues),
	class: t.UnionEnum(ApiQuotaPolicyClassValues),
	schemaVersion: t.Integer({ minimum: 1 }),
	configuration: t.Union([
		PrivilegedApiAccountQuotaPolicyConfiguration,
		PrivilegedApiTokenQuotaPolicyConfiguration,
	]),
	revision: t.Integer({ minimum: 1 }),
	enabled: t.Boolean(),
	updatedAt: DateTime,
});

export const ApiQuotaPolicyListResponse = t.Object({
	items: t.Array(ApiQuotaPolicySummary),
});

const ApiQuotaPolicyKey = t.String({
	minLength: 1,
	maxLength: 64,
	pattern: "^[a-z][a-z0-9_-]{0,63}$",
});

export const ApiQuotaPolicyParams = t.Object({
	policyKey: ApiQuotaPolicyKey,
});

export const CreateApiQuotaPolicyBody = t.Object(
	{
		key: ApiQuotaPolicyKey,
		subjectKind: t.UnionEnum(ApiQuotaPolicySubjectKindValues),
		class: t.UnionEnum(ApiQuotaPolicyClassValues),
		configuration: t.Union([
			PrivilegedApiAccountQuotaPolicyConfiguration,
			PrivilegedApiTokenQuotaPolicyConfiguration,
		]),
		reason: t.String({ minLength: 1, maxLength: 1_000 }),
	},
	{ additionalProperties: false },
);

export const ReviseApiQuotaPolicyBody = t.Object(
	{
		expectedRevision: t.Integer({ minimum: 1 }),
		configuration: t.Union([
			PrivilegedApiAccountQuotaPolicyConfiguration,
			PrivilegedApiTokenQuotaPolicyConfiguration,
		]),
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

export const ApiAccountTokenQuotaParams = t.Object({ userId: Uuid, tokenId: Uuid });

export const AssignApiTokenQuotaBody = t.Object(
	{
		expectedRevision: t.Integer({ minimum: 0 }),
		policyKey: t.String({ minLength: 1, maxLength: 64 }),
		validUntil: t.Optional(DateTime),
		reason: t.String({ minLength: 1, maxLength: 1_000 }),
		configurationOverride: t.Optional(ApiTokenQuotaOverrideInput),
	},
	{ additionalProperties: false },
);

export const ResetApiTokenQuotaBody = t.Object(
	{ expectedRevision: t.Integer({ minimum: 1 }) },
	{ additionalProperties: false },
);

export const ManagedApiTokenQuotaSummary = t.Object({
	id: Uuid,
	name: t.String(),
	tokenPrefix: t.String(),
	enabled: t.Boolean(),
	expiresAt: t.Nullable(DateTime),
	lastUsedAt: t.Nullable(DateTime),
	createdAt: DateTime,
	updatedAt: DateTime,
	quota: ApiTokenQuotaPolicyResponse,
});

export const ManagedApiTokenQuotaListResponse = t.Object({
	items: t.Array(ManagedApiTokenQuotaSummary),
});

export { ApiAccountQuotaPolicyResponse, ApiTokenQuotaPolicyResponse };
