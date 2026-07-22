import { Value } from "@sinclair/typebox/value";
import { type Static, t } from "elysia";

import type { ApiTokenPolicyKind } from "../../database/schema";

export const ApiTokenPolicySchemaVersion = 1 as const;

export const ApiTokenOperationId = t.String({
	minLength: 1,
	maxLength: 200,
	pattern: "^[A-Za-z][A-Za-z0-9_-]*$",
});

export const StandardTokenPolicyLimits = t.Object(
	{
		requestsPerMinute: t.Integer({ minimum: 1, maximum: 300 }),
		maxConcurrentRequests: t.Integer({ minimum: 1, maximum: 4 }),
		dailyCostUnits: t.Integer({ minimum: 1, maximum: 10_000 }),
	},
	{ additionalProperties: false },
);

export const StaffTrustedTokenPolicyLimits = t.Object(
	{
		requestsPerMinute: t.Integer({ minimum: 1, maximum: 5_000 }),
		maxConcurrentRequests: t.Integer({ minimum: 1, maximum: 64 }),
		dailyCostUnits: t.Integer({ minimum: 1, maximum: 1_000_000 }),
	},
	{ additionalProperties: false },
);

export const StandardTokenOperationLimits = t.Partial(StandardTokenPolicyLimits, {
	additionalProperties: false,
	minProperties: 1,
});
export const StaffTrustedTokenOperationLimits = t.Partial(StaffTrustedTokenPolicyLimits, {
	additionalProperties: false,
	minProperties: 1,
});

export const StandardTokenPolicyConfiguration = t.Object(
	{
		limits: StandardTokenPolicyLimits,
		operations: t.Record(ApiTokenOperationId, StandardTokenOperationLimits),
	},
	{ additionalProperties: false },
);

export const StaffTrustedTokenPolicyConfiguration = t.Object(
	{
		limits: StaffTrustedTokenPolicyLimits,
		operations: t.Record(ApiTokenOperationId, StaffTrustedTokenOperationLimits),
	},
	{ additionalProperties: false },
);

export const StandardTokenPolicyOverride = t.Object(
	{
		limits: t.Optional(StandardTokenOperationLimits),
		operations: t.Optional(t.Record(ApiTokenOperationId, StandardTokenOperationLimits)),
	},
	{ additionalProperties: false },
);

export const StaffTrustedTokenPolicyOverride = t.Object(
	{
		limits: t.Optional(StaffTrustedTokenOperationLimits),
		operations: t.Optional(t.Record(ApiTokenOperationId, StaffTrustedTokenOperationLimits)),
	},
	{ additionalProperties: false },
);

/** The widest transport shape. The assigned policy kind applies the authoritative validator. */
export const ApiTokenPolicyOverrideInput = StaffTrustedTokenPolicyOverride;

export type TokenPolicyLimits = Static<typeof StaffTrustedTokenPolicyLimits>;
export type TokenOperationLimits = Partial<TokenPolicyLimits>;
export type TokenPolicyConfiguration = {
	limits: TokenPolicyLimits;
	operations: Record<string, TokenOperationLimits>;
};
export type TokenPolicyOverride = {
	limits?: TokenOperationLimits;
	operations?: Record<string, TokenOperationLimits>;
};

export const DefaultApiTokenPolicies = {
	standard: {
		key: "standard-default",
		kind: "standard",
		schemaVersion: ApiTokenPolicySchemaVersion,
		configuration: {
			limits: {
				requestsPerMinute: 60,
				maxConcurrentRequests: 2,
				dailyCostUnits: 2_000,
			},
			operations: {},
		},
	},
	staffTrusted: {
		key: "staff-trusted-default",
		kind: "staff_trusted",
		schemaVersion: ApiTokenPolicySchemaVersion,
		configuration: {
			limits: {
				requestsPerMinute: 600,
				maxConcurrentRequests: 16,
				dailyCostUnits: 100_000,
			},
			operations: {},
		},
	},
} as const satisfies Record<
	"standard" | "staffTrusted",
	{
		key: string;
		kind: ApiTokenPolicyKind;
		schemaVersion: typeof ApiTokenPolicySchemaVersion;
		configuration: TokenPolicyConfiguration;
	}
>;

export class ApiTokenPolicyDocumentInvalid extends Error {
	constructor(
		readonly kind: ApiTokenPolicyKind,
		readonly schemaVersion: number,
		readonly document: "configuration" | "override",
		options?: ErrorOptions,
	) {
		super(`Invalid ${kind} API token policy ${document} version ${schemaVersion}`, options);
		this.name = "ApiTokenPolicyDocumentInvalid";
	}
}

function schemaForConfiguration(kind: ApiTokenPolicyKind) {
	return kind === "standard"
		? StandardTokenPolicyConfiguration
		: StaffTrustedTokenPolicyConfiguration;
}

function schemaForOverride(kind: ApiTokenPolicyKind) {
	return kind === "standard" ? StandardTokenPolicyOverride : StaffTrustedTokenPolicyOverride;
}

function assertSupportedVersion(
	kind: ApiTokenPolicyKind,
	schemaVersion: number,
	document: "configuration" | "override",
) {
	if (schemaVersion !== ApiTokenPolicySchemaVersion)
		throw new ApiTokenPolicyDocumentInvalid(kind, schemaVersion, document);
}

export function decodeTokenPolicyConfiguration(
	kind: ApiTokenPolicyKind,
	schemaVersion: number,
	value: unknown,
): TokenPolicyConfiguration {
	assertSupportedVersion(kind, schemaVersion, "configuration");
	try {
		return Value.Decode(schemaForConfiguration(kind), value);
	} catch (cause) {
		throw new ApiTokenPolicyDocumentInvalid(kind, schemaVersion, "configuration", {
			cause,
		});
	}
}

export function decodeTokenPolicyOverride(
	kind: ApiTokenPolicyKind,
	schemaVersion: number,
	value: unknown,
): TokenPolicyOverride {
	assertSupportedVersion(kind, schemaVersion, "override");
	try {
		return Value.Decode(schemaForOverride(kind), value);
	} catch (cause) {
		throw new ApiTokenPolicyDocumentInvalid(kind, schemaVersion, "override", { cause });
	}
}

export function mergeTokenPolicy(
	configuration: TokenPolicyConfiguration,
	override: TokenPolicyOverride,
): TokenPolicyConfiguration {
	const operations: Record<string, TokenOperationLimits> = { ...configuration.operations };
	for (const [operationId, operationOverride] of Object.entries(override.operations ?? {})) {
		operations[operationId] = {
			...operations[operationId],
			...operationOverride,
		};
	}
	return {
		limits: { ...configuration.limits, ...override.limits },
		operations,
	};
}

export function resolveTokenOperationLimits(
	configuration: TokenPolicyConfiguration,
	operationId: string,
): { global: TokenPolicyLimits; operation?: TokenPolicyLimits } {
	const operation = configuration.operations[operationId];
	return operation
		? { global: configuration.limits, operation: { ...configuration.limits, ...operation } }
		: { global: configuration.limits };
}
