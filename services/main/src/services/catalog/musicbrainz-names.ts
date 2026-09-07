import { z } from "zod";
import { createHash } from "node:crypto";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import type { CatalogReference } from "./contracts";
import { MusicBrainzAliasSchema, musicBrainzDate } from "./musicbrainz";
import { addCatalogName, bindCatalogNameSourceOccurrence } from "./names";
import type { recordCatalogSourceDocument } from "./source-observations";

/** @internal Alias dates, sorting and primary-locale preference stay on the same named form. */
export function musicBrainzAliasName(input: z.input<typeof MusicBrainzAliasSchema>) {
	const alias = MusicBrainzAliasSchema.parse(input);
	return {
		kind:
			alias.type === "Search hint"
				? "search-hint"
				: alias.type === "Legal name"
					? "legal"
					: "alias",
		value: alias.name,
		languageTag: alias.locale?.replaceAll("_", "-") || null,
		sortName: alias["sort-name"] || null,
		primaryForLanguage: alias.primary ?? null,
		begin: alias.begin ? musicBrainzDate(alias.begin) : null,
		end: alias.end ? musicBrainzDate(alias.end) : null,
		ended: alias.ended ?? null,
	};
}

/** @internal Names have native identity and exact snapshot support, independently of display selection. */
export async function adoptMusicBrainzAliases(
	tx: DatabaseTransaction,
	actor: string,
	reference: CatalogReference,
	revision: number,
	observation: Awaited<ReturnType<typeof recordCatalogSourceDocument>>,
	aliases: readonly z.input<typeof MusicBrainzAliasSchema>[],
	path = "/aliases",
) {
	z.array(MusicBrainzAliasSchema).max(8192).parse(aliases);
	for (const [index, alias] of aliases.entries()) {
		const added = await addCatalogName(tx, reference, actor, revision, musicBrainzAliasName(alias));
		revision = added.revision;
		await bindCatalogNameSourceOccurrence(tx, reference, actor, {
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
			namespace: "musicbrainz.name",
			localKey: `alias:${createHash("sha256")
				.update(
					JSON.stringify([observation.snapshot.id, reference.owner, reference.id, path, index]),
				)
				.digest("hex")}`,
			nameId: added.id,
			nameRevision: added.nameRevision,
			sourcePath: `${path}/${index}`,
		});
		await tx.insert(CatalogFactTables[reference.owner].support).values({
			ownerId: reference.id,
			namedFormId: added.id,
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
			sourcePath: `${path}/${index}`,
		});
	}
	return revision;
}

/** @internal The source's title owns an exact named-form revision, independent of alias ordering. */
export async function adoptMusicBrainzTitle(
	tx: DatabaseTransaction,
	actor: string,
	reference: CatalogReference,
	revision: number,
	observation: Awaited<ReturnType<typeof recordCatalogSourceDocument>>,
	title: string,
) {
	const added = await addCatalogName(tx, reference, actor, revision, {
		kind: "source-primary",
		value: title,
		languageTag: null,
	});
	await bindCatalogNameSourceOccurrence(tx, reference, actor, {
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		namespace: "musicbrainz.name",
		localKey: "primary",
		nameId: added.id,
		nameRevision: added.nameRevision,
		sourcePath: "/title",
	});
	await tx.insert(CatalogFactTables[reference.owner].support).values({
		ownerId: reference.id,
		namedFormId: added.id,
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		sourcePath: "/title",
	});
	return added.revision;
}
