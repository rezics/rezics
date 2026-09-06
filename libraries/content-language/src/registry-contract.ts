/** @internal Runtime lookup data generated from one bounded, checksummed IANA snapshot. */
export type RegisteredSubtagKind = "language" | "extlang" | "script" | "region" | "variant";

/** @internal Missing preferred values intentionally do not infer a macrolanguage alias. */
export interface LanguageRegistry {
	readonly date: string;
	readonly sha256: string;
	readonly recordCount: number;
	readonly subtags: Readonly<Record<RegisteredSubtagKind, string>>;
	readonly preferred: Readonly<Record<string, string>>;
	readonly extlangPrefixes: Readonly<Record<string, readonly string[]>>;
	readonly wholeTags: Readonly<
		Record<string, { readonly canonical: string; readonly preferred?: string }>
	>;
	readonly privateRanges: readonly {
		readonly kind: RegisteredSubtagKind;
		readonly from: string;
		readonly to: string;
	}[];
}
