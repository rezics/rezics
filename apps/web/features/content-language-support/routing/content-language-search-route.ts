import {
	canonicalizeContentLanguageTag,
	ContentLanguageChannelValues,
	type ContentLanguageChannel,
	type ContentLanguageTag,
} from "@rezics/content-language";
import type { UnitPredicate } from "@rezics/filter";
import { createParser, createSerializer, parseAsStringLiteral } from "nuqs/server";

import { type ContentLanguageSupportUnitType } from "../model/content-language-support";

const ContentKindByUnitType = {
	book: "unit:book",
	software: "unit:software",
	media: "unit:media",
	video: "unit:video",
	audio: "unit:audio",
	release: "unit:release",
} as const satisfies Record<
	ContentLanguageSupportUnitType,
	`unit:${ContentLanguageSupportUnitType}`
>;

export const ContentLanguageSearchContentKindValues = [
	"unit:book",
	"unit:software",
	"unit:media",
	"unit:video",
	"unit:audio",
	"unit:release",
] as const;

const UnitTypeByContentKind = {
	"unit:book": "book",
	"unit:software": "software",
	"unit:media": "media",
	"unit:video": "video",
	"unit:audio": "audio",
	"unit:release": "release",
} as const satisfies Record<
	(typeof ContentLanguageSearchContentKindValues)[number],
	ContentLanguageSupportUnitType
>;

const canonicalLanguageTagParser = createParser({
	parse(value): ContentLanguageTag | null {
		try {
			return canonicalizeContentLanguageTag(value);
		} catch {
			return null;
		}
	},
	serialize: String,
});

const routeOptions = {
	clearOnDefault: true,
	history: "push",
	shallow: true,
	scroll: false,
} as const;

export const contentLanguageSearchRouteParsers = {
	content: parseAsStringLiteral(ContentLanguageSearchContentKindValues).withOptions(routeOptions),
	consumptionLanguage: canonicalLanguageTagParser.withOptions(routeOptions),
	consumptionChannel: parseAsStringLiteral(ContentLanguageChannelValues).withOptions(routeOptions),
};

const serializeContentLanguageSearchRoute = createSerializer(contentLanguageSearchRouteParsers);

export function contentLanguageSearchHref(input: {
	readonly unitType: ContentLanguageSupportUnitType;
	readonly languageTag: ContentLanguageTag;
	readonly channel?: ContentLanguageChannel;
}): string {
	return `/search${serializeContentLanguageSearchRoute({
		content: ContentKindByUnitType[input.unitType],
		consumptionLanguage: input.languageTag,
		consumptionChannel: input.channel ?? null,
	})}`;
}

export function createContentLanguageSearchPredicate(input: {
	readonly content: (typeof ContentLanguageSearchContentKindValues)[number];
	readonly languageTag: ContentLanguageTag;
	readonly channel?: ContentLanguageChannel;
}): UnitPredicate {
	return {
		all: [
			{ kind: { in: [UnitTypeByContentKind[input.content]] } },
			{
				contentLanguageSupport: {
					some: {
						languageTag: input.languageTag,
						...(input.channel ? { channel: input.channel } : {}),
					},
				},
			},
		],
	};
}
