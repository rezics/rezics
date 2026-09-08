import type { DatabaseTransaction } from "../database";
import type { CatalogReference } from "./contracts";
import type { MusicBrainzRelease } from "./musicbrainz";
import { musicBrainzAliasName } from "./musicbrainz-names";
import { applyCatalogSourceNameDelta, type CatalogSourceNamePlan } from "./source-name-delta";

/** @internal MusicBrainz title/sort slots and unordered aliases have different correspondence semantics. */
export async function applyMusicBrainzNameDelta(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	revision: number,
	source: Parameters<typeof applyCatalogSourceNameDelta>[4],
	incoming: Pick<MusicBrainzRelease, "title" | "aliases"> & { "sort-name"?: string | null },
	primaryPath = "/title",
) {
	const names: CatalogSourceNamePlan[] = [];
	if (incoming.title)
		names.push({
			path: primaryPath,
			value: { kind: "source-primary", value: incoming.title, languageTag: null },
			match: "path",
		});
	if (incoming["sort-name"])
		names.push({
			path: "/sort-name",
			value: { kind: "sort", value: incoming["sort-name"], languageTag: null },
			match: "path",
		});
	for (const [index, alias] of (incoming.aliases ?? []).entries())
		names.push({ path: `/aliases/${index}`, value: musicBrainzAliasName(alias), match: "value" });
	return applyCatalogSourceNameDelta(tx, reference, actor, revision, source, {
		namespace: "musicbrainz.name",
		names,
	});
}
