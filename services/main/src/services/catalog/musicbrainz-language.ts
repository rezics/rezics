import { z } from "zod";
import { canonicalizeContentLanguageTag } from "@rezics/content-language";
import mapping from "./source-contracts/musicbrainz-language-map.json";

const aliases: Readonly<Record<string, string>> = mapping.aliases;

/**
 * @internal MusicBrainz emits ISO language codes; the native contract requires registered BCP47.
 * @remarks Preserve language identity (hbs/sh, tgl/tl and twi/tw); locale-preference fallbacks
 * can change that identity. Codes without an ISO639-1 equivalent retain their registered subtag.
 */
export function musicBrainzLanguageTag(value: string) {
	const code = z
		.string()
		.regex(/^[A-Za-z]{2,3}$/u)
		.parse(value)
		.toLowerCase();
	return canonicalizeContentLanguageTag(aliases[code] ?? code);
}
