import enData from "emojibase-data/en/data.json";
import enMessages from "emojibase-data/en/messages.json";
import zhHantData from "emojibase-data/zh-hant/data.json";
import zhHantMessages from "emojibase-data/zh-hant/messages.json";

import { AvatarEmojiDataVersion } from "../model/avatar-emoji-data";

export { AvatarEmojiDataVersion };

const documents = {
	en: {
		"data.json": JSON.stringify(enData),
		"messages.json": JSON.stringify(enMessages),
	},
	"zh-hant": {
		"data.json": JSON.stringify(zhHantData),
		"messages.json": JSON.stringify(zhHantMessages),
	},
} as const;

type AvatarEmojiDataLocale = keyof typeof documents;
type AvatarEmojiDataFile = keyof (typeof documents)[AvatarEmojiDataLocale];

function isAvatarEmojiDataLocale(value: string): value is AvatarEmojiDataLocale {
	return value === "en" || value === "zh-hant";
}

function isAvatarEmojiDataFile(value: string): value is AvatarEmojiDataFile {
	return value === "data.json" || value === "messages.json";
}

export function createAvatarEmojiDataResponse({
	version,
	locale,
	file,
}: {
	readonly version: string;
	readonly locale: string;
	readonly file: string;
}): Response {
	if (
		version !== AvatarEmojiDataVersion ||
		!isAvatarEmojiDataLocale(locale) ||
		!isAvatarEmojiDataFile(file)
	)
		return new Response(null, { status: 404 });

	return new Response(documents[locale][file], {
		headers: {
			"Cache-Control": "public, max-age=31536000, immutable",
			"Content-Type": "application/json; charset=utf-8",
		},
	});
}
