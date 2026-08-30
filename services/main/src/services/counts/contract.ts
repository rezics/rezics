import { type StaticDecode, Type } from "typebox";
import { Check } from "typebox/value";

const CountValue = Type.Integer({ minimum: 0 });

/** A count whose accuracy semantics remain explicit at every public boundary. */
export const ExactCountSchema = Type.Object(
	{ kind: Type.Literal("exact"), value: CountValue },
	{ additionalProperties: false },
);
export const EstimateCountSchema = Type.Object(
	{
		kind: Type.Literal("estimate"),
		value: CountValue,
		asOf: Type.String({
			pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?Z$",
		}),
		modifiedSinceAnalyze: Type.Optional(CountValue),
		relativeError: Type.Optional(Type.Number({ minimum: 0 })),
	},
	{ additionalProperties: false },
);
export const LowerBoundCountSchema = Type.Object(
	{ kind: Type.Literal("lower-bound"), value: CountValue },
	{ additionalProperties: false },
);
export const CountResultSchema = Type.Union(
	[ExactCountSchema, EstimateCountSchema, LowerBoundCountSchema],
	{ $id: "CountResult" },
);
export type CountResult = StaticDecode<typeof CountResultSchema>;
export type EstimateCount = StaticDecode<typeof EstimateCountSchema>;

/** Search/facet counts can be exact only after exhaustion; they are never estimates. */
export const SearchCountResultSchema = Type.Union([ExactCountSchema, LowerBoundCountSchema], {
	$id: "SearchCountResult",
});
export type SearchCountResult = StaticDecode<typeof SearchCountResultSchema>;

export function exactCount(value: number): CountResult {
	assertCountValue(value);
	return { kind: "exact", value };
}

export function lowerBoundCount(value: number): CountResult {
	assertCountValue(value);
	return { kind: "lower-bound", value };
}

export function estimateCount(value: number, asOf: Date): EstimateCount {
	assertCountValue(value);
	if (Number.isNaN(asOf.getTime())) throw new RangeError("Count estimate timestamp must be valid");
	return { kind: "estimate", value, asOf: asOf.toISOString() };
}

export function parseCountResult(value: unknown): CountResult {
	if (!Check(CountResultSchema, value)) throw new TypeError("Invalid count result");
	return value;
}

function assertCountValue(value: number): void {
	if (!Number.isSafeInteger(value) || value < 0)
		throw new RangeError("Count values must be non-negative safe integers");
}
