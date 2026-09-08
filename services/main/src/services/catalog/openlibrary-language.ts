import { canonicalizeContentLanguageTag } from "@rezics/content-language";
import { z } from "zod";
import aliases from "./source-contracts/musicbrainz-language-map.json";
const isoAliases: Readonly<Record<string, string>> = aliases.aliases;
/** @internal Exact ISO bibliographic/terminologic aliases reuse the reviewed shared language map, not locale fallback preferences. */
export function openLibraryLanguageTag(key: string) {
	const code = z
		.string()
		.regex(/^\/languages\/[a-z]{3}$/u)
		.parse(key)
		.slice("/languages/".length);
	return canonicalizeContentLanguageTag(isoAliases[code] ?? code);
}
