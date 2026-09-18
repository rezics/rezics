import { IriSchema, type SemanticValue } from "../contracts";
import { parseContentLanguageTag } from "@rezics/content-language";
export const XsdNamespace = "http://www.w3.org/2001/XMLSchema#";
const rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const bounds: Record<string, [bigint | null, bigint | null]> = {
	integer: [null, null],
	nonPositiveInteger: [null, 0n],
	negativeInteger: [null, -1n],
	nonNegativeInteger: [0n, null],
	positiveInteger: [1n, null],
	long: [-9223372036854775808n, 9223372036854775807n],
	int: [-2147483648n, 2147483647n],
	short: [-32768n, 32767n],
	byte: [-128n, 127n],
	unsignedLong: [0n, 18446744073709551615n],
	unsignedInt: [0n, 4294967295n],
	unsignedShort: [0n, 65535n],
	unsignedByte: [0n, 255n],
};
const others = [
	"string",
	"normalizedString",
	"token",
	"language",
	"boolean",
	"decimal",
	"float",
	"double",
	"date",
	"dateTime",
	"dateTimeStamp",
	"time",
	"gYear",
	"gYearMonth",
	"gMonth",
	"gDay",
	"gMonthDay",
	"duration",
	"dayTimeDuration",
	"yearMonthDuration",
	"hexBinary",
	"base64Binary",
	"anyURI",
];
/** @alpha Exact selected XSD 1.1 value families; context-dependent XML/QName types remain explicitly unsupported. */
export const datatypeDefinitions = [...Object.keys(bounds), ...others].map((name) => ({
	iri: XsdNamespace + name,
	specification: "https://www.w3.org/TR/xmlschema11-2/",
	version: "1.1",
	lexicalPreservation: "exact",
	comparison:
		name in bounds || name === "decimal"
			? "exact numeric string"
			: name === "float" || name === "double"
				? "IEEE datatype semantics; original lexical form retained"
				: "datatype-specific; no implicit JavaScript Date conversion",
}));
export type DatatypeResult = { status: "valid" | "invalid" | "unsupported"; reason?: string };
const result = (valid: boolean): DatatypeResult =>
	valid
		? { status: "valid" }
		: { status: "invalid", reason: "Literal is outside the selected datatype lexical/value space" };
const collapse = (value: string) => value.replace(/[\t\r\n ]+/g, " ").trim();
const integer = /^[+-]?[0-9]+$/;
const decimal = /^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/;
const xmlChars = (value: string) =>
	!/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF\uD800-\uDFFF]/u.test(value);
function zone(value: string): boolean {
	if (!value || value === "Z") return true;
	const m = /^[+-]([0-9]{2}):([0-9]{2})$/.exec(value);
	return !!m && +m[1]! <= 14 && +m[2]! <= 59 && (+m[1]! < 14 || +m[2]! === 0);
}
const year = "(-?(?:[1-9][0-9]{3,}|0[0-9]{3}))",
	tz = "(Z|[+-][0-9]{2}:[0-9]{2})?";
function dateValid(y: string, m: string, d: string): boolean {
	const month = Number(m),
		day = Number(d),
		number = BigInt(y),
		leap = number % 4n === 0n && (number % 100n !== 0n || number % 400n === 0n);
	return (
		month >= 1 &&
		month <= 12 &&
		day >= 1 &&
		day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!
	);
}
function timeValid(
	hour: string,
	minute: string,
	second: string,
	fraction: string | undefined,
): boolean {
	return (
		Number(minute) <= 59 &&
		Number(second) <= 59 &&
		(Number(hour) < 24 ||
			(Number(hour) === 24 &&
				Number(minute) === 0 &&
				Number(second) === 0 &&
				(!fraction || /^0+$/.test(fraction))))
	);
}
function calendar(name: string, value: string): boolean {
	if (name === "date" || name === "dateTime" || name === "dateTimeStamp") {
		const time = name === "date" ? "" : "T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\\.([0-9]+))?";
		const match = new RegExp(`^${year}-([0-9]{2})-([0-9]{2})${time}${tz}$`).exec(value);
		if (!match) return false;
		const timezone = match[name === "date" ? 4 : 8] ?? "";
		return (
			dateValid(match[1]!, match[2]!, match[3]!) &&
			zone(timezone) &&
			(name === "date" || timeValid(match[4]!, match[5]!, match[6]!, match[7])) &&
			(name !== "dateTimeStamp" || timezone !== "")
		);
	}
	if (name === "time") {
		const m = new RegExp(`^([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\\.([0-9]+))?${tz}$`).exec(value);
		return !!m && timeValid(m[1]!, m[2]!, m[3]!, m[4]) && zone(m[5] ?? "");
	}
	if (name === "gYear") {
		const m = new RegExp(`^${year}${tz}$`).exec(value);
		return !!m && zone(m[2] ?? "");
	}
	if (name === "gYearMonth") {
		const m = new RegExp(`^${year}-([0-9]{2})${tz}$`).exec(value);
		return !!m && +m[2]! >= 1 && +m[2]! <= 12 && zone(m[3] ?? "");
	}
	if (name === "gMonth") {
		const m = new RegExp(`^--([0-9]{2})${tz}$`).exec(value);
		return !!m && +m[1]! >= 1 && +m[1]! <= 12 && zone(m[2] ?? "");
	}
	if (name === "gDay") {
		const m = new RegExp(`^---([0-9]{2})${tz}$`).exec(value);
		return !!m && +m[1]! >= 1 && +m[1]! <= 31 && zone(m[2] ?? "");
	}
	const m = new RegExp(`^--([0-9]{2})-([0-9]{2})${tz}$`).exec(value);
	return !!m && dateValid("2000", m[1]!, m[2]!) && zone(m[3] ?? "");
}
function duration(name: string, value: string): boolean {
	const match =
		/^-?P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
			value,
		);
	if (
		!match ||
		!match.slice(1).some((v) => v !== undefined) ||
		(value.includes("T") && !match.slice(4).some((v) => v !== undefined))
	)
		return false;
	return name === "yearMonthDuration"
		? !match.slice(3).some((v) => v !== undefined)
		: name === "dayTimeDuration"
			? !match.slice(1, 3).some((v) => v !== undefined)
			: true;
}
/** @alpha Validate without coercing or rewriting the stored lexical form. Unsupported datatypes never become silently valid. */
export function validateDatatype(
	datatype: string,
	lexical: string,
	language?: string,
): DatatypeResult {
	if (lexical.length > 65_536)
		return { status: "invalid", reason: "Literal exceeds the scalar lexical budget" };
	if (datatype === rdf + "langString") {
		if (!language || !xmlChars(lexical)) return result(false);
		try {
			parseContentLanguageTag(language);
			return result(true);
		} catch {
			return result(false);
		}
	}
	if (language !== undefined)
		return { status: "invalid", reason: "Only rdf:langString carries a language tag" };
	if (!datatype.startsWith(XsdNamespace))
		return {
			status: "unsupported",
			reason:
				"No selected datatype implementation; preserve the original literal without native adoption",
		};
	const name = datatype.slice(XsdNamespace.length),
		value = collapse(lexical);
	if (!xmlChars(lexical)) return result(false);
	if (name in bounds) {
		if (!integer.test(value)) return result(false);
		const [min, max] = bounds[name]!,
			number = BigInt(value);
		return result((min === null || number >= min) && (max === null || number <= max));
	}
	if (["string", "normalizedString", "token", "anyURI"].includes(name)) return result(true);
	if (name === "language") return result(/^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$/.test(value));
	if (name === "boolean") return result(["true", "false", "1", "0"].includes(value));
	if (name === "decimal") return result(decimal.test(value));
	if (name === "float" || name === "double")
		return result(
			value === "NaN" ||
				/^[+-]?(?:INF|(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?)$/.test(value),
		);
	if (
		[
			"date",
			"dateTime",
			"dateTimeStamp",
			"time",
			"gYear",
			"gYearMonth",
			"gMonth",
			"gDay",
			"gMonthDay",
		].includes(name)
	)
		return result(calendar(name, value));
	if (["duration", "yearMonthDuration", "dayTimeDuration"].includes(name))
		return result(duration(name, value));
	if (name === "hexBinary") return result(/^(?:[0-9a-fA-F]{2})*$/.test(value));
	if (name === "base64Binary") {
		const encoded = value.replaceAll(" ", "");
		if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
			return result(false);
		const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
		return result(
			encoded.endsWith("==")
				? alphabet.indexOf(encoded.at(-3)!) % 16 === 0
				: encoded.endsWith("=")
					? alphabet.indexOf(encoded.at(-2)!) % 4 === 0
					: true,
		);
	}
	return {
		status: "unsupported",
		reason: "Datatype is not part of the reviewed XSD runtime subset",
	};
}
/** @alpha Validate primitive graph values; model rules independently restrict allowed kinds and datatypes. */
export function validateSemanticValue(value: SemanticValue): DatatypeResult {
	if (value.kind === "literal")
		return validateDatatype(value.datatype, value.value, value.language);
	if (value.kind === "iri") return result(IriSchema.safeParse(value.iri).success);
	return { status: "valid" };
}
