import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { publishingSerialization } from "../database/schema/catalog-publishing";
import { programEpisode, programSeason, programVersion } from "../database/schema/catalog-program";
import { musicRelease } from "../database/schema/catalog-music";
import { softwareVersion } from "../database/schema/catalog-software";
import { CatalogNameTables } from "../database/schema/catalog-names";
import { CatalogAccessDenied, CatalogReferenceNotFound, loadCatalogIdentity } from "./storage";
import {
	ContentLanguageDeclarationReferenceSchema,
	ConsumptionLanguagesSchema,
	readCatalogContentLanguageSupport,
	type ContentLanguageDeclarationReference,
} from "./content-language-declaration";

export const CatalogContentLanguageEvidenceSchema = z.strictObject({
	currentContentLanguageSupport: ConsumptionLanguagesSchema,
	items: z
		.array(
			z.strictObject({
				source: z.literal("native_link"),
				reference: ContentLanguageDeclarationReferenceSchema,
				name: z
					.strictObject({ value: z.string().max(500), languageTag: z.string().nullable() })
					.nullable(),
				contentLanguageSupport: ConsumptionLanguagesSchema,
			}),
		)
		.max(2),
	nextCursor: z.null(),
});
/** Single-parent/at-most-two-parent evidence only. It never implies inheritance or creates source-derived declarations. */
export async function listCatalogContentLanguageEvidence(
	tx: DatabaseTransaction,
	reference: ContentLanguageDeclarationReference,
	actor: string | null,
) {
	const current = await readCatalogContentLanguageSupport(tx, reference, actor);
	const identity = await loadCatalogIdentity(tx, reference, actor, false);
	const parents: ContentLanguageDeclarationReference[] = [];
	if (reference.owner === "publishing" && identity.shape === "serialization") {
		const [row] = await tx
			.select({ id: publishingSerialization.textVersionId })
			.from(publishingSerialization)
			.where(eq(publishingSerialization.id, reference.id))
			.limit(1);
		if (row?.id) parents.push({ owner: "publishing", id: row.id });
	} else if (reference.owner === "program") {
		if (identity.shape === "season") {
			const [row] = await tx
				.select({ id: programSeason.programId })
				.from(programSeason)
				.where(eq(programSeason.id, reference.id))
				.limit(1);
			if (row?.id) parents.push({ owner: "program", id: row.id });
		}
		if (identity.shape === "program_version") {
			const [row] = await tx
				.select({ id: programVersion.programId })
				.from(programVersion)
				.where(eq(programVersion.id, reference.id))
				.limit(1);
			if (row?.id) parents.push({ owner: "program", id: row.id });
		}
		if (identity.shape === "episode") {
			const [row] = await tx
				.select({ programId: programEpisode.programId, seasonId: programEpisode.seasonId })
				.from(programEpisode)
				.where(eq(programEpisode.id, reference.id))
				.limit(1);
			for (const id of [row?.programId, row?.seasonId])
				if (id) parents.push({ owner: "program", id });
		}
	} else if (reference.owner === "music" && identity.shape === "release") {
		const [row] = await tx
			.select({ id: musicRelease.releaseGroupId })
			.from(musicRelease)
			.where(eq(musicRelease.id, reference.id))
			.limit(1);
		if (row?.id) parents.push({ owner: "music", id: row.id });
	} else if (reference.owner === "software" && identity.shape === "version") {
		const [row] = await tx
			.select({ id: softwareVersion.contentId })
			.from(softwareVersion)
			.where(eq(softwareVersion.id, reference.id))
			.limit(1);
		if (row?.id) parents.push({ owner: "software", id: row.id });
	}
	const items: z.output<typeof CatalogContentLanguageEvidenceSchema>["items"] = [];
	for (const parent of parents) {
		try {
			const declaration = await readCatalogContentLanguageSupport(tx, parent, actor);
			if (!declaration.value.length) continue;
			const named = CatalogNameTables[parent.owner].name;
			const [name] = await tx
				.select({ value: sql<string>`left(${named.value},500)`, languageTag: named.languageTag })
				.from(named)
				.where(
					and(
						eq(named.ownerId, parent.id),
						eq(named.state, "active"),
						eq(named.spoiler, 0),
						isNull(named.scopeOwnerId),
					),
				)
				.orderBy(named.id)
				.limit(1);
			items.push({
				source: "native_link",
				reference: parent,
				name: name ?? null,
				contentLanguageSupport: declaration.value,
			});
		} catch (error) {
			if (!(error instanceof CatalogAccessDenied) && !(error instanceof CatalogReferenceNotFound))
				throw error;
		}
	}
	return { currentContentLanguageSupport: current.value, items, nextCursor: null };
}
