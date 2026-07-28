import enData from "emojibase-data/en/data.json";
import enMessages from "emojibase-data/en/messages.json";
import deData from "emojibase-data/de/data.json";
import deMessages from "emojibase-data/de/messages.json";
import esData from "emojibase-data/es/data.json";
import esMessages from "emojibase-data/es/messages.json";
import frData from "emojibase-data/fr/data.json";
import frMessages from "emojibase-data/fr/messages.json";
import jaData from "emojibase-data/ja/data.json";
import jaMessages from "emojibase-data/ja/messages.json";
import koData from "emojibase-data/ko/data.json";
import koMessages from "emojibase-data/ko/messages.json";
import zhData from "emojibase-data/zh/data.json";
import zhMessages from "emojibase-data/zh/messages.json";
import zhHantData from "emojibase-data/zh-hant/data.json";
import zhHantMessages from "emojibase-data/zh-hant/messages.json";

import { AvatarEmojiDataVersion } from "../model/avatar-emoji-data";

export { AvatarEmojiDataVersion };

const documents = {
	de: {
		"data.json": JSON.stringify(deData),
		"messages.json": JSON.stringify(deMessages),
	},
	en: {
		"data.json": JSON.stringify(enData),
		"messages.json": JSON.stringify(enMessages),
	},
	es: {
		"data.json": JSON.stringify(esData),
		"messages.json": JSON.stringify(esMessages),
	},
	fr: {
		"data.json": JSON.stringify(frData),
		"messages.json": JSON.stringify(frMessages),
	},
	ja: {
		"data.json": JSON.stringify(jaData),
		"messages.json": JSON.stringify(jaMessages),
	},
	ko: {
		"data.json": JSON.stringify(koData),
		"messages.json": JSON.stringify(koMessages),
	},
	zh: {
		"data.json": JSON.stringify(zhData),
		"messages.json": JSON.stringify(zhMessages),
	},
	"zh-hant": {
		"data.json": JSON.stringify(zhHantData),
		"messages.json": JSON.stringify(zhHantMessages),
	},
} as const;

type AvatarEmojiDataLocale = keyof typeof documents;
type AvatarEmojiDataFile = keyof (typeof documents)[AvatarEmojiDataLocale];

function isAvatarEmojiDataLocale(value: string): value is AvatarEmojiDataLocale {
	return Object.hasOwn(documents, value);
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
