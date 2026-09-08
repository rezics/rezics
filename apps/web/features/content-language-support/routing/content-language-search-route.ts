import {
	canonicalizeContentLanguageTag,
	ContentLanguageChannelValues,
	type ContentLanguageChannel,
	type ContentLanguageTag,
} from "@rezics/content-language";
import { parseUnitPredicate, type UnitPredicate } from "@rezics/filter";
import { createParser, createSerializer, parseAsStringLiteral } from "nuqs/server";

import {
	ContentLanguageSupportOwnerValues,
	type ContentLanguageSupportOwner,
} from "../model/content-language-support";

const shapeParser = createParser({
	parse: (value) => (/^[a-z][a-z0-9_.-]{0,95}$/.test(value) ? value : null),
	serialize: String,
});

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
	contentOwner: parseAsStringLiteral(ContentLanguageSupportOwnerValues).withOptions(routeOptions),
	contentShape: shapeParser.withOptions(routeOptions),
	consumptionLanguage: canonicalLanguageTagParser.withOptions(routeOptions),
	consumptionChannel: parseAsStringLiteral(ContentLanguageChannelValues).withOptions(routeOptions),
};

const serializeContentLanguageSearchRoute = createSerializer(contentLanguageSearchRouteParsers);

export function contentLanguageSearchHref(input: {
	readonly owner: ContentLanguageSupportOwner;
	readonly shape?: string;
	readonly languageTag: ContentLanguageTag;
	readonly channel?: ContentLanguageChannel;
}): string {
	createContentLanguageSearchPredicate(input);
	return `/search${serializeContentLanguageSearchRoute({
		contentOwner: input.owner,
		contentShape: input.shape ?? null,
		consumptionLanguage: input.languageTag,
		consumptionChannel: input.channel ?? null,
	})}`;
}

export function createContentLanguageSearchPredicate(input: {
	readonly owner: ContentLanguageSupportOwner;
	readonly shape?: string;
	readonly languageTag: ContentLanguageTag;
	readonly channel?: ContentLanguageChannel;
}): UnitPredicate {
	return parseUnitPredicate({
		all: [
			{
				owner: { in: [input.owner] },
				...(input.shape === undefined ? {} : { shape: { in: [input.shape] } }),
			},
			{
				contentLanguageSupport: {
					some: {
						languageTag: input.languageTag,
						...(input.channel ? { channel: input.channel } : {}),
					},
				},
			},
		],
	});
}
