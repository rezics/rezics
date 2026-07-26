export type PortableTextMentionPrefix = "u" | "t" | "e" | "r" | "z";

const PortableTextMentionSearchCategoryByPrefix = {
	u: "users",
	t: "tags",
	e: "entity",
	r: "realms",
	z: "units",
} as const satisfies Record<PortableTextMentionPrefix, string>;

export type PortableTextMentionSearchCategory =
	(typeof PortableTextMentionSearchCategoryByPrefix)[PortableTextMentionPrefix];

export function portableTextMentionSearchCategory(
	prefix: PortableTextMentionPrefix,
): PortableTextMentionSearchCategory {
	return PortableTextMentionSearchCategoryByPrefix[prefix];
}

export type PortableTextSlashToken =
	| {
			readonly kind: "block";
			readonly query: string;
			readonly start: number;
			readonly end: number;
	  }
	| {
			readonly kind: "mention";
			readonly prefix: PortableTextMentionPrefix;
			readonly query: string;
			readonly start: number;
			readonly end: number;
	  };

export function parsePortableTextSlashToken(
	textBeforeCaret: string,
): PortableTextSlashToken | null {
	const mentionMatch = /(?:^|\s)([uterz])\/([^\n]*)$/u.exec(textBeforeCaret);
	if (mentionMatch) {
		const prefix = mentionMatch[1] as PortableTextMentionPrefix;
		const query = mentionMatch[2] ?? "";
		const tokenLength = prefix.length + 1 + query.length;
		return {
			kind: "mention",
			prefix,
			query,
			start: textBeforeCaret.length - tokenLength,
			end: textBeforeCaret.length,
		};
	}

	const blockMatch = /^\/([^\n]*)$/u.exec(textBeforeCaret);
	if (!blockMatch) return null;
	return {
		kind: "block",
		query: blockMatch[1] ?? "",
		start: 0,
		end: textBeforeCaret.length,
	};
}
