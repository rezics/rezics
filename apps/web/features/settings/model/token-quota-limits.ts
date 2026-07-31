export const TokenQuotaLimitNames = [
	"requestsPerMinute",
	"burstCapacity",
	"maxConcurrentRequests",
	"dailyCostUnits",
] as const;

export type TokenQuotaLimitName = (typeof TokenQuotaLimitNames)[number];

export type TokenQuotaLimitRanges = Readonly<
	Record<TokenQuotaLimitName, Readonly<{ minimum: number; maximum: number }>>
>;

export type TokenQuotaLimitValues = Record<TokenQuotaLimitName, string>;
export type ValidTokenQuotaLimits = Record<TokenQuotaLimitName, number>;

export type ParsedTokenQuotaLimit =
	{ kind: "empty" } | { kind: "invalid" } | { kind: "valid"; value: number };

export const StandardTokenQuotaLimitRanges = {
	requestsPerMinute: { minimum: 1, maximum: 300 },
	burstCapacity: { minimum: 1, maximum: 300 },
	maxConcurrentRequests: { minimum: 1, maximum: 4 },
	dailyCostUnits: { minimum: 1, maximum: 10_000 },
} as const satisfies TokenQuotaLimitRanges;

export const PrivilegedTokenQuotaLimitRanges = {
	requestsPerMinute: { minimum: 1, maximum: 5_000 },
	burstCapacity: { minimum: 1, maximum: 5_000 },
	maxConcurrentRequests: { minimum: 1, maximum: 64 },
	dailyCostUnits: { minimum: 1, maximum: 1_000_000 },
} as const satisfies TokenQuotaLimitRanges;

export function getTokenQuotaLimitRanges(kind: "standard" | "privileged"): TokenQuotaLimitRanges {
	return kind === "privileged" ? PrivilegedTokenQuotaLimitRanges : StandardTokenQuotaLimitRanges;
}

export function parseTokenQuotaLimit(
	input: string,
	range: TokenQuotaLimitRanges[TokenQuotaLimitName],
): ParsedTokenQuotaLimit {
	if (input.trim() === "") return { kind: "empty" };
	const value = Number(input);
	return Number.isInteger(value) && value >= range.minimum && value <= range.maximum
		? { kind: "valid", value }
		: { kind: "invalid" };
}

export function parseTokenQuotaLimits(
	inputs: TokenQuotaLimitValues,
	ranges: TokenQuotaLimitRanges,
): { valid: true; values: ValidTokenQuotaLimits } | { valid: false } {
	const requestsPerMinute = parseTokenQuotaLimit(
		inputs.requestsPerMinute,
		ranges.requestsPerMinute,
	);
	const maxConcurrentRequests = parseTokenQuotaLimit(
		inputs.maxConcurrentRequests,
		ranges.maxConcurrentRequests,
	);
	const burstCapacity = parseTokenQuotaLimit(inputs.burstCapacity, ranges.burstCapacity);
	const dailyCostUnits = parseTokenQuotaLimit(inputs.dailyCostUnits, ranges.dailyCostUnits);
	if (
		requestsPerMinute.kind !== "valid" ||
		burstCapacity.kind !== "valid" ||
		maxConcurrentRequests.kind !== "valid" ||
		dailyCostUnits.kind !== "valid"
	)
		return { valid: false };
	return {
		valid: true,
		values: {
			requestsPerMinute: requestsPerMinute.value,
			burstCapacity: burstCapacity.value,
			maxConcurrentRequests: maxConcurrentRequests.value,
			dailyCostUnits: dailyCostUnits.value,
		},
	};
}
