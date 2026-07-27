export const TokenPolicyLimitNames = [
	"requestsPerMinute",
	"maxConcurrentRequests",
	"dailyCostUnits",
] as const;

export type TokenPolicyLimitName = (typeof TokenPolicyLimitNames)[number];

export type TokenPolicyLimitRanges = Readonly<
	Record<TokenPolicyLimitName, Readonly<{ minimum: number; maximum: number }>>
>;

export type TokenPolicyLimitValues = Record<TokenPolicyLimitName, string>;
export type ValidTokenPolicyLimits = Record<TokenPolicyLimitName, number>;

export type ParsedTokenPolicyLimit =
	{ kind: "empty" } | { kind: "invalid" } | { kind: "valid"; value: number };

export const StandardTokenPolicyLimitRanges = {
	requestsPerMinute: { minimum: 1, maximum: 300 },
	maxConcurrentRequests: { minimum: 1, maximum: 4 },
	dailyCostUnits: { minimum: 1, maximum: 10_000 },
} as const satisfies TokenPolicyLimitRanges;

export const PrivilegedTokenPolicyLimitRanges = {
	requestsPerMinute: { minimum: 1, maximum: 5_000 },
	maxConcurrentRequests: { minimum: 1, maximum: 64 },
	dailyCostUnits: { minimum: 1, maximum: 1_000_000 },
} as const satisfies TokenPolicyLimitRanges;

export function getTokenPolicyLimitRanges(kind: "standard" | "privileged"): TokenPolicyLimitRanges {
	return kind === "privileged"
		? PrivilegedTokenPolicyLimitRanges
		: StandardTokenPolicyLimitRanges;
}

export function parseTokenPolicyLimit(
	input: string,
	range: TokenPolicyLimitRanges[TokenPolicyLimitName],
): ParsedTokenPolicyLimit {
	if (input.trim() === "") return { kind: "empty" };
	const value = Number(input);
	return Number.isInteger(value) && value >= range.minimum && value <= range.maximum
		? { kind: "valid", value }
		: { kind: "invalid" };
}

export function parseTokenPolicyLimits(
	inputs: TokenPolicyLimitValues,
	ranges: TokenPolicyLimitRanges,
): { valid: true; values: ValidTokenPolicyLimits } | { valid: false } {
	const requestsPerMinute = parseTokenPolicyLimit(
		inputs.requestsPerMinute,
		ranges.requestsPerMinute,
	);
	const maxConcurrentRequests = parseTokenPolicyLimit(
		inputs.maxConcurrentRequests,
		ranges.maxConcurrentRequests,
	);
	const dailyCostUnits = parseTokenPolicyLimit(inputs.dailyCostUnits, ranges.dailyCostUnits);
	if (
		requestsPerMinute.kind !== "valid" ||
		maxConcurrentRequests.kind !== "valid" ||
		dailyCostUnits.kind !== "valid"
	)
		return { valid: false };
	return {
		valid: true,
		values: {
			requestsPerMinute: requestsPerMinute.value,
			maxConcurrentRequests: maxConcurrentRequests.value,
			dailyCostUnits: dailyCostUnits.value,
		},
	};
}
