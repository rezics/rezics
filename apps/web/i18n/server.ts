import { create } from "native-i18n/next/server";
import { resources } from "@rezics/i18n/resources";
import { matchUiLocaleTag } from "@rezics/i18n";
import type { NamespaceSelection } from "native-i18n";

const nativeI18n = create(resources);
type Selection = NamespaceSelection<typeof resources>;

function matchProductLocaleTags(tags: readonly string[]): string[] {
	return tags.map((tag) => matchUiLocaleTag(tag) ?? tag);
}

export async function getLocaleTags(): Promise<string[]> {
	return matchProductLocaleTags(await nativeI18n.getLocaleTags());
}

export function matchLocale(tags: readonly string[]) {
	return nativeI18n.matchLocale(matchProductLocaleTags(tags));
}

export async function getTranslation<const Selected extends Selection>(
	selection: Selected,
	tags?: readonly string[],
) {
	return nativeI18n.getTranslation(
		selection,
		matchProductLocaleTags(tags ?? (await nativeI18n.getLocaleTags())),
	);
}

export async function preload<const Selected extends Selection>(
	selection: Selected,
	tags?: readonly string[],
) {
	return nativeI18n.preload(
		selection,
		matchProductLocaleTags(tags ?? (await nativeI18n.getLocaleTags())),
	);
}
