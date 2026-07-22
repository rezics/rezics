export const AvatarTypeValues = ["image", "emoji", "icon"] as const;
export type AvatarType = (typeof AvatarTypeValues)[number];

/**
 * The Font Awesome release used by both persisted references and metadata
 * searches. Keep the hosted Kit pinned to this same release.
 */
export const FontAwesomeVersion = "7.2.0";
export const FontAwesomeProvider = "font-awesome" as const;
export const FontAwesomeLicenseValues = ["free", "pro"] as const;
export type FontAwesomeLicense = (typeof FontAwesomeLicenseValues)[number];

/**
 * V1 deliberately enables only the two styles configured in the hosted Kit.
 * Add a prefix here only after enabling the matching Kit style and CSS mapping.
 */
export const FontAwesomeIconPrefixValues = ["fas", "fab"] as const;
export type FontAwesomeIconPrefix = (typeof FontAwesomeIconPrefixValues)[number];

const FontAwesomeIconPrefixSet: ReadonlySet<string> = new Set(FontAwesomeIconPrefixValues);
const FontAwesomeLicenseSet: ReadonlySet<string> = new Set(FontAwesomeLicenseValues);
const FontAwesomeClassByPrefix = {
	fas: "fa-solid",
	fab: "fa-brands",
} as const satisfies Record<FontAwesomeIconPrefix, string>;

export const FontAwesomeIconNamePatternSource = "^[a-z0-9]+(?:-[a-z0-9]+)*$";
export const FontAwesomeIconNamePattern = new RegExp(FontAwesomeIconNamePatternSource);

export interface FontAwesomeIconReference {
	readonly provider: typeof FontAwesomeProvider;
	readonly prefix: FontAwesomeIconPrefix;
	readonly name: string;
}

export type AvatarValue<Image> =
	| { readonly type: "image"; readonly image: Image }
	| { readonly type: "emoji"; readonly emoji: string }
	| { readonly type: "icon"; readonly icon: FontAwesomeIconReference };

export type AvatarReference = AvatarValue<{ readonly assetId: string }>;
export type PresentedAvatar = AvatarValue<{ readonly id: string; readonly url: string }>;

export function isFontAwesomeIconPrefix(value: string): value is FontAwesomeIconPrefix {
	return FontAwesomeIconPrefixSet.has(value);
}

export function isFontAwesomeLicense(value: string): value is FontAwesomeLicense {
	return FontAwesomeLicenseSet.has(value);
}

export function isFontAwesomeIconName(value: string): boolean {
	return value.length <= 128 && FontAwesomeIconNamePattern.test(value);
}

const emojiSequencePattern =
	/(?:\p{Emoji_Presentation}|\p{Regional_Indicator}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}\uFE0F)/u;
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Accept exactly one Unicode grapheme containing an emoji sequence. */
export function isSingleEmojiGrapheme(value: string): boolean {
	if (!value || value.length > 64 || !emojiSequencePattern.test(value)) return false;
	const iterator = graphemeSegmenter.segment(value)[Symbol.iterator]();
	if (iterator.next().done) return false;
	return iterator.next().done === true;
}

export function fontAwesomeIconClassNames(
	icon: Pick<FontAwesomeIconReference, "prefix" | "name">,
): readonly [string, string, "fa-fw"] {
	return [FontAwesomeClassByPrefix[icon.prefix], `fa-${icon.name}`, "fa-fw"];
}
