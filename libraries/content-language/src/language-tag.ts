import { parse, stringify } from "bcp-47";
import { ianaRegistry } from "./iana-registry.generated";
import type { RegisteredSubtagKind } from "./registry-contract";

export const MaximumContentLanguageTagLength = 255;
export const ContentLanguageRegistryPolicy = `rezics-content-language.1:${ianaRegistry.date}:${ianaRegistry.sha256}`;
declare const ContentLanguageTagProof: unique symbol;

/** An IANA-validated content language tag; private-use identity also requires its namespace. */
export type ContentLanguageTag = string & { readonly [ContentLanguageTagProof]: true };

/** @alpha Registry validation is available; named-form/source adoption remains under implementation. */
export type ParsedContentLanguage =
	| { readonly kind: "registered"; readonly tag: ContentLanguageTag; readonly policy: string }
	| {
			readonly kind: "private-use";
			readonly tag: ContentLanguageTag;
			readonly policy: string;
			readonly namespace: string;
	  };

/** @internal Rejection reasons distinguish invalid tags from unsupported or unscoped representations. */
export class LanguageTagValidationError extends TypeError {
	constructor(
		readonly code:
			| "syntax"
			| "unregistered"
			| "extlang_prefix"
			| "duplicate"
			| "extension_scope"
			| "private_use_namespace",
	) {
		super(`Content language tag rejected: ${code}`);
		this.name = "LanguageTagValidationError";
	}
}

const registered = {
	language: new Set(ianaRegistry.subtags.language.split(" ")),
	extlang: new Set(ianaRegistry.subtags.extlang.split(" ")),
	script: new Set(ianaRegistry.subtags.script.split(" ")),
	region: new Set(ianaRegistry.subtags.region.split(" ")),
	variant: new Set(ianaRegistry.subtags.variant.split(" ")),
};

function subtag(kind: RegisteredSubtagKind, input: string) {
	let value = input.toLowerCase();
	const seen = new Set<string>();
	while (true) {
		if (seen.has(value)) throw new Error("Cyclic IANA preferred value");
		seen.add(value);
		const privateUse = ianaRegistry.privateRanges.some(
			(range) =>
				range.kind === kind &&
				value.length === range.from.length &&
				value >= range.from &&
				value <= range.to,
		);
		if (!registered[kind].has(value) && !privateUse)
			throw new LanguageTagValidationError("unregistered");
		const preferred = ianaRegistry.preferred[`${kind}:${value}`];
		if (preferred && preferred.toLowerCase() !== value) {
			value = preferred.toLowerCase();
			continue;
		}
		return {
			value:
				kind === "script"
					? value[0]!.toUpperCase() + value.slice(1)
					: kind === "region"
						? value.toUpperCase()
						: value,
			privateUse,
		};
	}
}

/**
 * Validate against the pinned IANA policy without CLDR aliasing, likely subtags or script removal.
 * @alpha
 * @remarks Private-use results retain a caller-provided namespace; locale preference extensions
 * are rejected for this content-identity role. Neither validation nor a namespace proves provenance.
 */
export function parseContentLanguageTag(
	input: unknown,
	options: { readonly privateUseNamespace?: string } = {},
): ParsedContentLanguage {
	if (
		typeof input !== "string" ||
		!input.length ||
		input.length > MaximumContentLanguageTagLength ||
		input.trim() !== input
	)
		throw new LanguageTagValidationError("syntax");
	let value = input;
	const wholeSeen = new Set<string>();
	while (ianaRegistry.wholeTags[value.toLowerCase()]?.preferred) {
		if (wholeSeen.has(value.toLowerCase()))
			throw new Error("Cyclic IANA whole-tag preferred value");
		wholeSeen.add(value.toLowerCase());
		value = ianaRegistry.wholeTags[value.toLowerCase()]!.preferred!;
	}
	const whole = ianaRegistry.wholeTags[value.toLowerCase()];
	let privateUse = false;
	let canonical: string;
	if (whole) canonical = whole.canonical;
	else {
		let malformed = false;
		const parsed = parse(value, {
			normalize: false,
			forgiving: false,
			warning: () => {
				malformed = true;
			},
		});
		if (malformed || (!parsed.language && !parsed.privateuse.length))
			throw new LanguageTagValidationError("syntax");
		if (parsed.extensions.length) throw new LanguageTagValidationError("extension_scope");
		if (
			new Set(parsed.variants.map((value) => value.toLowerCase())).size !== parsed.variants.length
		)
			throw new LanguageTagValidationError("duplicate");
		const originalLanguage = parsed.language?.toLowerCase();
		if (originalLanguage) {
			const language = subtag("language", originalLanguage);
			parsed.language = language.value;
			privateUse ||= language.privateUse;
		}
		for (const [index, extlang] of parsed.extendedLanguageSubtags.entries()) {
			subtag("extlang", extlang);
			const prefix = [originalLanguage, ...parsed.extendedLanguageSubtags.slice(0, index)]
				.join("-")
				.toLowerCase();
			if (
				!ianaRegistry.extlangPrefixes[extlang.toLowerCase()]?.some(
					(value) => value.toLowerCase() === prefix,
				)
			)
				throw new LanguageTagValidationError("extlang_prefix");
		}
		if (parsed.extendedLanguageSubtags.length) {
			parsed.language = subtag("language", parsed.extendedLanguageSubtags[0]!).value;
			parsed.extendedLanguageSubtags = parsed.extendedLanguageSubtags.slice(1);
		}
		for (const kind of ["script", "region"] as const) {
			if (!parsed[kind]) continue;
			const result = subtag(kind, parsed[kind]);
			parsed[kind] = result.value;
			privateUse ||= result.privateUse;
		}
		parsed.variants = parsed.variants.map((value) => subtag("variant", value).value);
		if (new Set(parsed.variants).size !== parsed.variants.length)
			throw new LanguageTagValidationError("duplicate");
		privateUse ||= parsed.privateuse.length > 0;
		parsed.privateuse = parsed.privateuse.map((value) => value.toLowerCase());
		canonical = stringify(parsed);
	}
	if (!canonical || canonical.length > MaximumContentLanguageTagLength)
		throw new LanguageTagValidationError("syntax");
	// The grammar, registration, prefixes, uniqueness and role checks above prove this brand.
	const tag = canonical as ContentLanguageTag;
	if (!privateUse) return { kind: "registered", tag, policy: ContentLanguageRegistryPolicy };
	const namespace = options.privateUseNamespace;
	if (
		!namespace ||
		namespace.length > 255 ||
		namespace.trim() !== namespace ||
		/[\u0000-\u001f\u007f]/.test(namespace)
	)
		throw new LanguageTagValidationError("private_use_namespace");
	return { kind: "private-use", tag, namespace, policy: ContentLanguageRegistryPolicy };
}
