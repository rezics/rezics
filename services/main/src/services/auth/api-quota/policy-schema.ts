import { Value } from "@sinclair/typebox/value";
import { type Static, t } from "elysia";

import type { ApiQuotaPolicyClass, ApiQuotaPolicySubjectKind } from "../../database/schema";
import { ApiQuotaOperationIds, type ApiQuotaOperationId } from "./operation";

export const ApiQuotaPolicySchemaVersion = 1 as const;
const ApiQuotaMaximumSafeInteger = Number.MAX_SAFE_INTEGER;

export const ApiQuotaOperationIdSchema = t.UnionEnum(ApiQuotaOperationIds);

const ApiQuotaRequestRate = t.Object(
	{
		requestsPerMinute: t.Integer({ minimum: 1, maximum: ApiQuotaMaximumSafeInteger }),
		burstCapacity: t.Integer({ minimum: 1, maximum: ApiQuotaMaximumSafeInteger }),
	},
	{ additionalProperties: false },
);

export const StandardApiQuotaLimits = t.Object(
	{
		requestRate: ApiQuotaRequestRate,
		maxConcurrentRequests: t.Integer({ minimum: 1, maximum: ApiQuotaMaximumSafeInteger }),
		dailyCostUnits: t.Integer({ minimum: 1, maximum: ApiQuotaMaximumSafeInteger }),
	},
	{ additionalProperties: false },
);

export const PrivilegedApiQuotaLimits = t.Object(
	{
		requestRate: ApiQuotaRequestRate,
		maxConcurrentRequests: t.Integer({ minimum: 1, maximum: ApiQuotaMaximumSafeInteger }),
		dailyCostUnits: t.Integer({ minimum: 1, maximum: ApiQuotaMaximumSafeInteger }),
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

export const StandardApiTokenQuotaPolicyConfiguration = t.Object(
	{
		limits: StandardApiQuotaLimits,
		operations: StandardApiQuotaOperations,
	},
	{ additionalProperties: false },
);

export const PrivilegedApiTokenQuotaPolicyConfiguration = t.Object(
	{
		limits: PrivilegedApiQuotaLimits,
		operations: PrivilegedApiQuotaOperations,
	},
	{ additionalProperties: false },
);

export const StandardApiAccountQuotaPolicyConfiguration = t.Object(
	{
		limits: StandardApiQuotaLimits,
		maxActiveTokens: t.Integer({ minimum: 1, maximum: ApiQuotaMaximumSafeInteger }),
		operations: StandardApiQuotaOperations,
	},
	{ additionalProperties: false },
);

export const PrivilegedApiAccountQuotaPolicyConfiguration = t.Object(
	{
		limits: PrivilegedApiQuotaLimits,
		maxActiveTokens: t.Integer({ minimum: 1, maximum: ApiQuotaMaximumSafeInteger }),
		operations: PrivilegedApiQuotaOperations,
	},
	{ additionalProperties: false },
);

export const StandardApiAccountQuotaOverride = t.Object(
	{
		limits: t.Optional(StandardApiQuotaLimitOverride),
		maxActiveTokens: t.Optional(t.Integer({ minimum: 1, maximum: ApiQuotaMaximumSafeInteger })),
		operations: t.Optional(StandardApiQuotaOperations),
	},
	{ additionalProperties: false },
);

export const PrivilegedApiAccountQuotaOverride = t.Object(
	{
		limits: t.Optional(PrivilegedApiQuotaLimitOverride),
		maxActiveTokens: t.Optional(t.Integer({ minimum: 1, maximum: ApiQuotaMaximumSafeInteger })),
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
export type ApiTokenQuotaPolicyConfiguration = {
	limits: ApiQuotaLimits;
	operations: Partial<Record<ApiQuotaOperationId, ApiQuotaLimitOverride>>;
};
export type ApiAccountQuotaPolicyConfiguration = ApiTokenQuotaPolicyConfiguration & {
	maxActiveTokens: number;
};
export type ApiQuotaPolicyConfiguration =
	ApiAccountQuotaPolicyConfiguration | ApiTokenQuotaPolicyConfiguration;
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
	accountStandard: {
		key: "standard-default",
		subjectKind: "account",
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
	accountPrivileged: {
		key: "privileged-default",
		subjectKind: "account",
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
	tokenStandard: {
		key: "token-standard-default",
		subjectKind: "token",
		class: "standard",
		schemaVersion: ApiQuotaPolicySchemaVersion,
		configuration: {
			limits: {
				requestRate: { requestsPerMinute: 60, burstCapacity: 10 },
				maxConcurrentRequests: 2,
				dailyCostUnits: 2_000,
			},
			operations: {},
		},
	},
	tokenPrivileged: {
		key: "token-privileged-default",
		subjectKind: "token",
		class: "privileged",
		schemaVersion: ApiQuotaPolicySchemaVersion,
		configuration: {
			limits: {
				requestRate: { requestsPerMinute: 600, burstCapacity: 100 },
				maxConcurrentRequests: 16,
				dailyCostUnits: 100_000,
			},
			operations: {},
		},
	},
} as const satisfies Record<
	"accountStandard" | "accountPrivileged" | "tokenStandard" | "tokenPrivileged",
	{
		key: string;
		subjectKind: ApiQuotaPolicySubjectKind;
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
	subjectKind: ApiQuotaPolicySubjectKind,
	policyClass: ApiQuotaPolicyClass,
	schemaVersion: number,
	value: unknown,
): ApiQuotaPolicyConfiguration {
	return subjectKind === "account"
		? decodeApiAccountQuotaPolicyConfiguration(policyClass, schemaVersion, value)
		: decodeApiTokenQuotaPolicyConfiguration(policyClass, schemaVersion, value);
}

export function decodeApiAccountQuotaPolicyConfiguration(
	policyClass: ApiQuotaPolicyClass,
	schemaVersion: number,
	value: unknown,
): ApiAccountQuotaPolicyConfiguration {
	requireSupportedVersion(policyClass, schemaVersion, "configuration");
	try {
		return Value.Decode(
			policyClass === "standard"
				? StandardApiAccountQuotaPolicyConfiguration
				: PrivilegedApiAccountQuotaPolicyConfiguration,
			value,
		);
	} catch (cause) {
		throw new ApiQuotaPolicyDocumentInvalid(policyClass, schemaVersion, "configuration", {
			cause,
		});
	}
}

export function decodeApiTokenQuotaPolicyConfiguration(
	policyClass: ApiQuotaPolicyClass,
	schemaVersion: number,
	value: unknown,
): ApiTokenQuotaPolicyConfiguration {
	requireSupportedVersion(policyClass, schemaVersion, "configuration");
	try {
		return Value.Decode(
			policyClass === "standard"
				? StandardApiTokenQuotaPolicyConfiguration
				: PrivilegedApiTokenQuotaPolicyConfiguration,
			value,
		);
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

function applyOperationsOverride(
	configuration: ApiTokenQuotaPolicyConfiguration,
	override: ApiTokenQuotaOverride,
): ApiTokenQuotaPolicyConfiguration["operations"] {
	const operations: ApiTokenQuotaPolicyConfiguration["operations"] = {
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
	return operations;
}

export function applyApiAccountQuotaOverride(
	configuration: ApiAccountQuotaPolicyConfiguration,
	override: ApiAccountQuotaOverride,
): ApiAccountQuotaPolicyConfiguration {
	return {
		limits: { ...configuration.limits, ...override.limits },
		maxActiveTokens: override.maxActiveTokens ?? configuration.maxActiveTokens,
		operations: applyOperationsOverride(configuration, override),
	};
}

export function applyApiTokenQuotaOverride(
	configuration: ApiTokenQuotaPolicyConfiguration,
	override: ApiTokenQuotaOverride,
): ApiTokenQuotaPolicyConfiguration {
	return {
		limits: { ...configuration.limits, ...override.limits },
		operations: applyOperationsOverride(configuration, override),
	};
}

function capLimits(limits: ApiQuotaLimits, cap: ApiQuotaLimitOverride | undefined): ApiQuotaLimits {
	if (!cap) return limits;
	return {
		requestRate: cap.requestRate
			? {
					requestsPerMinute: Math.min(
						limits.requestRate.requestsPerMinute,
						cap.requestRate.requestsPerMinute,
					),
					burstCapacity: Math.min(
						limits.requestRate.burstCapacity,
						cap.requestRate.burstCapacity,
					),
				}
			: limits.requestRate,
		maxConcurrentRequests:
			cap.maxConcurrentRequests === undefined
				? limits.maxConcurrentRequests
				: Math.min(limits.maxConcurrentRequests, cap.maxConcurrentRequests),
		dailyCostUnits:
			cap.dailyCostUnits === undefined
				? limits.dailyCostUnits
				: Math.min(limits.dailyCostUnits, cap.dailyCostUnits),
	};
}

/** Applies an owner-managed token safeguard without allowing it to widen platform policy. */
export function applyApiTokenQuotaSafeguard(
	configuration: ApiTokenQuotaPolicyConfiguration,
	safeguard: ApiTokenQuotaOverride | undefined,
): ApiTokenQuotaPolicyConfiguration {
	if (!safeguard) return configuration;
	const limits = capLimits(configuration.limits, safeguard.limits);
	const operations: ApiTokenQuotaPolicyConfiguration["operations"] = {
		...configuration.operations,
	};
	for (const operationId of ApiQuotaOperationIds) {
		const operationCap = safeguard.operations?.[operationId];
		if (!operationCap) continue;
		const policyOperationLimits = {
			...configuration.limits,
			...configuration.operations[operationId],
		};
		operations[operationId] = capLimits(policyOperationLimits, {
			...safeguard.limits,
			...operationCap,
		});
	}
	return { limits, operations };
}

export function resolveApiQuotaLimits(
	configuration: ApiTokenQuotaPolicyConfiguration,
	operationId: ApiQuotaOperationId | null,
): { global: ApiQuotaLimits; operation?: ApiQuotaLimits } {
	if (!operationId) return { global: configuration.limits };
	const operation = configuration.operations[operationId];
	return operation
		? { global: configuration.limits, operation: { ...configuration.limits, ...operation } }
		: { global: configuration.limits };
}
