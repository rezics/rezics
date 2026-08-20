export const ContentLanguageChannelValues = ["text", "audio", "subtitle", "interface"] as const;
export type ContentLanguageChannel = (typeof ContentLanguageChannelValues)[number];

export const MaximumContentLanguageSupportEntries = 64;
export const MaximumContentLanguageTagLength = 255;

declare const ContentLanguageTagProof: unique symbol;

/** A structurally valid canonical BCP 47 language tag proven at runtime. */
export type ContentLanguageTag = string & { readonly [ContentLanguageTagProof]: true };

export type ContentLanguageSupportEntry = {
	readonly languageTag: ContentLanguageTag;
	/** Omitted when support is known only at the language level. */
	readonly channels?: readonly ContentLanguageChannel[];
};

export type ContentLanguageSupport = readonly ContentLanguageSupportEntry[];

const ContentLanguageChannelSet: ReadonlySet<string> = new Set(ContentLanguageChannelValues);
const ContentLanguageChannelOrder = new Map(
	ContentLanguageChannelValues.map((channel, index) => [channel, index]),
);

export class ContentLanguageSupportValidationError extends TypeError {
	constructor(
		message: string,
		readonly path: string,
	) {
		super(message);
		this.name = "ContentLanguageSupportValidationError";
	}
}

export function canonicalizeContentLanguageTag(value: unknown): ContentLanguageTag {
	if (
		typeof value !== "string" ||
		value.length === 0 ||
		value.length > MaximumContentLanguageTagLength ||
		value.trim() !== value ||
		value.includes("_")
	)
		throw new ContentLanguageSupportValidationError(
			"Language must be a well-formed BCP 47 tag",
			"/languageTag",
		);

	let canonical: string;
	try {
		canonical = new Intl.Locale(value).toString();
	} catch {
		throw new ContentLanguageSupportValidationError(
			"Language must be a well-formed BCP 47 tag",
			"/languageTag",
		);
	}
	if (canonical.length > MaximumContentLanguageTagLength)
		throw new ContentLanguageSupportValidationError(
			"Canonical language tag is too long",
			"/languageTag",
		);
	return canonical as ContentLanguageTag;
}

export function isCanonicalContentLanguageTag(value: unknown): value is ContentLanguageTag {
	if (typeof value !== "string") return false;
	try {
		return canonicalizeContentLanguageTag(value) === value;
	} catch {
		return false;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeChannels(value: unknown, path: string): readonly ContentLanguageChannel[] {
	if (
		!Array.isArray(value) ||
		value.length === 0 ||
		value.length > ContentLanguageChannelValues.length
	)
		throw new ContentLanguageSupportValidationError(
			"Channels must be a non-empty array of supported channel names",
			path,
		);
	const channels = new Set<ContentLanguageChannel>();
	for (const channel of value) {
		if (typeof channel !== "string" || !ContentLanguageChannelSet.has(channel))
			throw new ContentLanguageSupportValidationError("Unknown content channel", path);
		if (channels.has(channel as ContentLanguageChannel))
			throw new ContentLanguageSupportValidationError("Content channels must be unique", path);
		channels.add(channel as ContentLanguageChannel);
	}
	return Object.freeze(
		[...channels].sort(
			(left, right) =>
				(ContentLanguageChannelOrder.get(left) ?? 0) -
				(ContentLanguageChannelOrder.get(right) ?? 0),
		),
	);
}

/**
 * Proves and canonicalizes the complete persisted/API field.
 *
 * Canonical language order and channel order make equality, revision hashing,
 * caches, and conditional writes independent of client input order.
 */
export function normalizeContentLanguageSupport(value: unknown): ContentLanguageSupport {
	if (!Array.isArray(value) || value.length > MaximumContentLanguageSupportEntries)
		throw new ContentLanguageSupportValidationError(
			`Content language support must be an array with at most ${MaximumContentLanguageSupportEntries} entries`,
			"/",
		);

	const languages = new Set<ContentLanguageTag>();
	const entries: ContentLanguageSupportEntry[] = [];
	for (const [index, candidate] of value.entries()) {
		const path = `/${index}`;
		if (!isRecord(candidate))
			throw new ContentLanguageSupportValidationError("Entry must be an object", path);
		const keys = Object.keys(candidate);
		if (keys.some((key) => key !== "languageTag" && key !== "channels"))
			throw new ContentLanguageSupportValidationError("Entry contains an unknown field", path);
		if (!Object.hasOwn(candidate, "languageTag"))
			throw new ContentLanguageSupportValidationError(
				"Entry requires a language tag",
				`${path}/languageTag`,
			);

		let languageTag: ContentLanguageTag;
		try {
			languageTag = canonicalizeContentLanguageTag(candidate.languageTag);
		} catch (error) {
			if (error instanceof ContentLanguageSupportValidationError)
				throw new ContentLanguageSupportValidationError(error.message, `${path}/languageTag`);
			throw error;
		}
		if (languages.has(languageTag))
			throw new ContentLanguageSupportValidationError(
				"Languages must be unique after BCP 47 canonicalization",
				`${path}/languageTag`,
			);
		languages.add(languageTag);

		const channels = Object.hasOwn(candidate, "channels")
			? normalizeChannels(candidate.channels, `${path}/channels`)
			: undefined;
		entries.push(
			Object.freeze({
				languageTag,
				...(channels ? { channels } : {}),
			}),
		);
	}

	entries.sort((left, right) =>
		left.languageTag < right.languageTag ? -1 : left.languageTag > right.languageTag ? 1 : 0,
	);
	return Object.freeze(entries);
}
