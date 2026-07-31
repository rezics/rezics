import { createLoader, createSerializer, parseAsStringLiteral } from "nuqs/server";

import { realmHref, type AddressableUnit } from "@/features/slugs/unit-route";
import { urlStateOptions } from "@/lib/search-params";
import {
	RealmContentComposerDefaultMode,
	RealmContentComposerModes,
	type RealmContentComposerMode,
} from "../model/realm-content-composer";

export const realmContentComposerModeParser = parseAsStringLiteral(RealmContentComposerModes)
	.withDefault(RealmContentComposerDefaultMode)
	.withOptions(urlStateOptions);

const realmContentCreateRouteParsers = {
	mode: realmContentComposerModeParser,
};
const loadRealmContentCreateSearchParams = createLoader(realmContentCreateRouteParsers);
const serializeRealmContentCreateSearchParams = createSerializer(realmContentCreateRouteParsers);

type SearchParams = Record<string, string | string[] | undefined>;

export async function loadRealmContentCreateRoute(
	searchParams: Promise<SearchParams> | SearchParams,
): Promise<{ readonly mode: RealmContentComposerMode }> {
	return loadRealmContentCreateSearchParams(await searchParams);
}

export function realmContentCreateHref(
	realm: AddressableUnit,
	mode: RealmContentComposerMode = RealmContentComposerDefaultMode,
): string {
	return `${realmHref(realm)}/new${serializeRealmContentCreateSearchParams({ mode })}`;
}

export function realmContentCreateSearch(mode: RealmContentComposerMode): string {
	return serializeRealmContentCreateSearchParams({ mode });
}
