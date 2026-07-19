const IntegerText = /^-?(?:0|[1-9]\d*)$/;

/** Converts a PostgreSQL integer only after proving it is lossless in JavaScript. */
export function toSafeInteger(value: unknown, name: string): number {
	let integer: bigint;
	if (typeof value === "bigint") integer = value;
	else if (typeof value === "number" && Number.isSafeInteger(value)) integer = BigInt(value);
	else if (typeof value === "string" && IntegerText.test(value)) integer = BigInt(value);
	else throw new TypeError(`${name} is not an integer`);

	if (integer < BigInt(Number.MIN_SAFE_INTEGER) || integer > BigInt(Number.MAX_SAFE_INTEGER))
		throw new RangeError(`${name} exceeds the JavaScript safe integer range`);
	return Number(integer);
}
