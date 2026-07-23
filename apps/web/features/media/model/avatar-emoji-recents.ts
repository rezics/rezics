import { isSingleEmojiGrapheme } from "@rezics/avatar";

export type AvatarEmojiLocale = "en" | "zh-hant";

const RecentEmojiStorageKeyPrefix = "rezics-avatar-recent-emojis-v1";
const RecentChoiceLimit = 18;

export interface RecentEmojiChoice {
	readonly emoji: string;
	readonly label: string;
}

function recentEmojiStorageKey(locale: AvatarEmojiLocale): string {
	return `${RecentEmojiStorageKeyPrefix}:${locale}`;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null
		? (value as Record<string, unknown>)
		: undefined;
}

function readStoredItems(storage: Storage, key: string): readonly unknown[] {
	try {
		const document = objectValue(JSON.parse(storage.getItem(key) ?? "null"));
		return document?.version === 1 && Array.isArray(document.items) ? document.items : [];
	} catch {
		return [];
	}
}

function writeStoredItems(storage: Storage, key: string, items: readonly unknown[]): void {
	try {
		storage.setItem(key, JSON.stringify({ version: 1, items }));
	} catch {
		// Avatar selection remains usable when browser storage is unavailable.
	}
}

function parseRecentEmojiChoice(value: unknown): RecentEmojiChoice | undefined {
	const candidate = objectValue(value);
	const emoji = candidate?.emoji;
	const label = candidate?.label;
	if (
		typeof emoji !== "string" ||
		!isSingleEmojiGrapheme(emoji) ||
		typeof label !== "string" ||
		label.length === 0 ||
		label.length > 200
	)
		return undefined;
	return { emoji, label };
}

export function readRecentEmojiChoices(
	storage: Storage,
	locale: AvatarEmojiLocale,
): readonly RecentEmojiChoice[] {
	const choices: RecentEmojiChoice[] = [];
	const seen = new Set<string>();
	for (const item of readStoredItems(storage, recentEmojiStorageKey(locale))) {
		const choice = parseRecentEmojiChoice(item);
		if (!choice || seen.has(choice.emoji)) continue;
		seen.add(choice.emoji);
		choices.push(choice);
		if (choices.length === RecentChoiceLimit) break;
	}
	return choices;
}

export function rememberRecentEmojiChoice(
	storage: Storage,
	locale: AvatarEmojiLocale,
	choice: RecentEmojiChoice,
): void {
	const verified = parseRecentEmojiChoice(choice);
	if (!verified) return;
	writeStoredItems(
		storage,
		recentEmojiStorageKey(locale),
		[
			verified,
			...readRecentEmojiChoices(storage, locale).filter(
				({ emoji }) => emoji !== verified.emoji,
			),
		].slice(0, RecentChoiceLimit),
	);
}
