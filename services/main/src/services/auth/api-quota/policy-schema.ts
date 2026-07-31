import { Value } from "@sinclair/typebox/value";
import { type Static, t } from "elysia";

import type { ApiQuotaPolicyClass } from "../../database/schema";
import { ApiQuotaOperationIds, type ApiQuotaOperationId } from "./operation";

export const ApiQuotaPolicySchemaVersion = 1 as const;

export const ApiQuotaOperationIdSchema = t.UnionEnum(ApiQuotaOperationIds);

const StandardRequestRate = t.Object(
	{
		requestsPerMinute: t.Integer({ minimum: 1, maximum: 300 }),
		burstCapacity: t.Integer({ minimum: 1, maximum: 300 }),
	},
	{ additionalProperties: false },
);

const PrivilegedRequestRate = t.Object(
	{
		requestsPerMinute: t.Integer({ minimum: 1, maximum: 5_000 }),
		burstCapacity: t.Integer({ minimum: 1, maximum: 5_000 }),
	},
	{ additionalProperties: false },
);

export const StandardApiQuotaLimits = t.Object(
	{
		requestRate: StandardRequestRate,
		maxConcurrentRequests: t.Integer({ minimum: 1, maximum: 4 }),
		dailyCostUnits: t.Integer({ minimum: 1, maximum: 10_000 }),
	},
	{ additionalProperties: false },
);

export const PrivilegedApiQuotaLimits = t.Object(
	{
		requestRate: PrivilegedRequestRate,
		maxConcurrentRequests: t.Integer({ minimum: 1, maximum: 64 }),
		dailyCostUnits: t.Integer({ minimum: 1, maximum: 1_000_000 }),
	},
	{ additionalProperties: false },
);

export const StandardApiQuotaLimitOverride = t.Partial(StandardApiQuotaLimits, {
	additionalProperties: false,
	minProperties: 1,
});
export const PrivilegedApiQuotaLimitOverride = t.Partial(PrivilegedApiQuotaLimits, {
	additionalProperties: false,
	minProperties: 1,
});

const StandardOperationProperties = {
	"search.execute": StandardApiQuotaLimitOverride,
	"image.upload": StandardApiQuotaLimitOverride,
} satisfies Record<ApiQuotaOperationId, typeof StandardApiQuotaLimitOverride>;
const PrivilegedOperationProperties = {
	"search.execute": PrivilegedApiQuotaLimitOverride,
	"image.upload": PrivilegedApiQuotaLimitOverride,
} satisfies Record<ApiQuotaOperationId, typeof PrivilegedApiQuotaLimitOverride>;

export const StandardApiQuotaOperations = t.Partial(t.Object(StandardOperationProperties), {
	additionalProperties: false,
});
export const PrivilegedApiQuotaOperations = t.Partial(t.Object(PrivilegedOperationProperties), {
	additionalProperties: false,
});

export const StandardApiQuotaPolicyConfiguration = t.Object(
	{
		limits: StandardApiQuotaLimits,
		maxActiveTokens: t.Integer({ minimum: 1, maximum: 20 }),
		operations: StandardApiQuotaOperations,
	},
	{ additionalProperties: false },
);

export const PrivilegedApiQuotaPolicyConfiguration = t.Object(
	{
		limits: PrivilegedApiQuotaLimits,
		maxActiveTokens: t.Integer({ minimum: 1, maximum: 50 }),
		operations: PrivilegedApiQuotaOperations,
	},
	{ additionalProperties: false },
);

export const StandardApiAccountQuotaOverride = t.Object(
	{
		limits: t.Optional(StandardApiQuotaLimitOverride),
		maxActiveTokens: t.Optional(t.Integer({ minimum: 1, maximum: 20 })),
		operations: t.Optional(StandardApiQuotaOperations),
	},
	{ additionalProperties: false },
);

export const PrivilegedApiAccountQuotaOverride = t.Object(
	{
		limits: t.Optional(PrivilegedApiQuotaLimitOverride),
		maxActiveTokens: t.Optional(t.Integer({ minimum: 1, maximum: 50 })),
		operations: t.Optional(PrivilegedApiQuotaOperations),
	},
	{ additionalProperties: false },
);

export const ApiTokenQuotaOverrideInput = t.Object(
	{
		limits: t.Optional(PrivilegedApiQuotaLimitOverride),
		operations: t.Optional(PrivilegedApiQuotaOperations),
	},
	{ additionalProperties: false },
);

export type ApiQuotaLimits = Static<typeof PrivilegedApiQuotaLimits>;
export type ApiQuotaLimitOverride = Static<typeof PrivilegedApiQuotaLimitOverride>;
export type ApiQuotaPolicyConfiguration = {
	limits: ApiQuotaLimits;
	maxActiveTokens: number;
	operations: Partial<Record<ApiQuotaOperationId, ApiQuotaLimitOverride>>;
};
export type ApiAccountQuotaOverride = {
	limits?: ApiQuotaLimitOverride;
	maxActiveTokens?: number;
	operations?: Partial<Record<ApiQuotaOperationId, ApiQuotaLimitOverride>>;
};
export type ApiTokenQuotaOverride = {
	limits?: ApiQuotaLimitOverride;
	operations?: Partial<Record<ApiQuotaOperationId, ApiQuotaLimitOverride>>;
};

export const DefaultApiQuotaPolicies = {
	standard: {
		key: "standard-default",
		class: "standard",
		schemaVersion: ApiQuotaPolicySchemaVersion,
		configuration: {
			limits: {
				requestRate: { requestsPerMinute: 60, burstCapacity: 10 },
				maxConcurrentRequests: 2,
				dailyCostUnits: 2_000,
			},
			maxActiveTokens: 10,
			operations: {},
		},
	},
	privileged: {
		key: "privileged-default",
		class: "privileged",
		schemaVersion: ApiQuotaPolicySchemaVersion,
		configuration: {
			limits: {
				requestRate: { requestsPerMinute: 600, burstCapacity: 100 },
				maxConcurrentRequests: 16,
				dailyCostUnits: 100_000,
			},
			maxActiveTokens: 25,
			operations: {},
		},
	},
} as const satisfies Record<
	"standard" | "privileged",
	{
		key: string;
		class: ApiQuotaPolicyClass;
		schemaVersion: typeof ApiQuotaPolicySchemaVersion;
		configuration: ApiQuotaPolicyConfiguration;
	}
>;

export class ApiQuotaPolicyDocumentInvalid extends Error {
	constructor(
		readonly policyClass: ApiQuotaPolicyClass | "token",
		readonly schemaVersion: number,
		readonly document: "configuration" | "account_override" | "token_override",
		options?: ErrorOptions,
	) {
		super(`Invalid ${policyClass} API quota ${document} version ${schemaVersion}`, options);
		this.name = "ApiQuotaPolicyDocumentInvalid";
	}
}

function schemaForConfiguration(policyClass: ApiQuotaPolicyClass) {
	return policyClass === "standard"
		? StandardApiQuotaPolicyConfiguration
		: PrivilegedApiQuotaPolicyConfiguration;
}

function schemaForAccountOverride(policyClass: ApiQuotaPolicyClass) {
	return policyClass === "standard"
		? StandardApiAccountQuotaOverride
		: PrivilegedApiAccountQuotaOverride;
}

function requireSupportedVersion(
	policyClass: ApiQuotaPolicyClass | "token",
	schemaVersion: number,
	document: ApiQuotaPolicyDocumentInvalid["document"],
) {
	if (schemaVersion !== ApiQuotaPolicySchemaVersion)
		throw new ApiQuotaPolicyDocumentInvalid(policyClass, schemaVersion, document);
}

export function decodeApiQuotaPolicyConfiguration(
	policyClass: ApiQuotaPolicyClass,
	schemaVersion: number,
	value: unknown,
): ApiQuotaPolicyConfiguration {
	requireSupportedVersion(policyClass, schemaVersion, "configuration");
	try {
		return Value.Decode(schemaForConfiguration(policyClass), value);
	} catch (cause) {
		throw new ApiQuotaPolicyDocumentInvalid(policyClass, schemaVersion, "configuration", {
			cause,
		});
	}
}

export function decodeApiAccountQuotaOverride(
	policyClass: ApiQuotaPolicyClass,
	schemaVersion: number,
	value: unknown,
): ApiAccountQuotaOverride {
	requireSupportedVersion(policyClass, schemaVersion, "account_override");
	try {
		return Value.Decode(schemaForAccountOverride(policyClass), value);
	} catch (cause) {
		throw new ApiQuotaPolicyDocumentInvalid(policyClass, schemaVersion, "account_override", {
			cause,
		});
	}
}

export function decodeApiTokenQuotaOverride(value: unknown): ApiTokenQuotaOverride {
	try {
		return Value.Decode(ApiTokenQuotaOverrideInput, value);
	} catch (cause) {
		throw new ApiQuotaPolicyDocumentInvalid(
			"token",
			ApiQuotaPolicySchemaVersion,
			"token_override",
			{ cause },
		);
	}
}

export function applyApiAccountQuotaOverride(
	configuration: ApiQuotaPolicyConfiguration,
	override: ApiAccountQuotaOverride,
): ApiQuotaPolicyConfiguration {
	const operations: ApiQuotaPolicyConfiguration["operations"] = {
		...configuration.operations,
	};
	for (const operationId of ApiQuotaOperationIds) {
		const operationOverride = override.operations?.[operationId];
		if (!operationOverride) continue;
		operations[operationId] = {
			...operations[operationId],
			...operationOverride,
		};
	}
	return {
		limits: { ...configuration.limits, ...override.limits },
		maxActiveTokens: override.maxActiveTokens ?? configuration.maxActiveTokens,
		operations,
	};
}

export function resolveApiQuotaLimits(
	configuration: ApiQuotaPolicyConfiguration,
	operationId: ApiQuotaOperationId | null,
): { global: ApiQuotaLimits; operation?: ApiQuotaLimits } {
	if (!operationId) return { global: configuration.limits };
	const operation = configuration.operations[operationId];
	return operation
		? { global: configuration.limits, operation: { ...configuration.limits, ...operation } }
		: { global: configuration.limits };
}

export function resolveApiTokenQuotaLimits(
	override: ApiTokenQuotaOverride | undefined,
	operationId: ApiQuotaOperationId | null,
): { global?: ApiQuotaLimitOverride; operation?: ApiQuotaLimitOverride } {
	if (!override) return {};
	const operation = operationId ? override.operations?.[operationId] : undefined;
	return {
		...(override.limits ? { global: override.limits } : {}),
		...(operation ? { operation: { ...override.limits, ...operation } } : {}),
	};
}
