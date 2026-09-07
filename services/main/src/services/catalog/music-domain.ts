import { and, eq, gt, inArray } from "drizzle-orm";
import { z } from "zod";
import { canonicalizeContentLanguageTag } from "@rezics/content-language";
import type { DatabaseTransaction } from "../database";
import { assertMusicMediumFormatCompatibility } from "./music-medium-attributes";
import { catalogDefinition, catalogDefinitionRevision } from "../database/schema/catalog-identity";
import {
	musicDiscToc,
	musicDiscTocOffset,
	musicArtistCredit,
	musicAlternativeTrack,
	musicMedium,
	musicMediumPresentation,
	musicMediumToc,
	musicRelease,
	musicReleasePresentation,
	musicReleaseEvent,
	musicReleaseLabel,
	musicReleaseGroup,
	musicReleaseGroupSecondaryType,
	musicTrackOccurrence,
	musicTrackPresentation,
	musicWork,
	musicWorkLanguage,
} from "../database/schema/catalog-music";
import {
	CatalogPageSchema,
	CatalogPartialDateSchema,
	CatalogReferenceSchema,
	type CatalogReference,
} from "./contracts";
import {
	assertReadableTargets,
	CatalogAccessDenied,
	CatalogReferenceNotFound,
	loadCatalogIdentity,
	recordCatalogChange,
} from "./storage";

const exactInteger = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const language = z
	.string()
	.min(1)
	.max(255)
	.transform((value) => canonicalizeContentLanguageTag(value));
const optionalDefinition = z.uuid().nullable().optional();

async function requireMusic(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	shape: "release" | "work" | "release_group" | "recording",
	write = false,
) {
	const ref = CatalogReferenceSchema.parse({ owner: reference.owner, id: reference.id });
	if (ref.owner !== "music") throw new TypeError("Expected music storage owner");
	const identity = await loadCatalogIdentity(tx, ref, actor, write);
	if (identity.shape !== shape) throw new TypeError(`Expected music ${shape}`);
	return identity;
}

async function requireVocabulary(tx: DatabaseTransaction, revisionId: string | null | undefined) {
	if (revisionId == null) return;
	const [revision] = await tx
		.select({ kind: catalogDefinition.kind })
		.from(catalogDefinitionRevision)
		.innerJoin(catalogDefinition, eq(catalogDefinition.id, catalogDefinitionRevision.definitionId))
		.where(eq(catalogDefinitionRevision.id, revisionId))
		.limit(1);
	if (!revision || revision.kind !== "vocabulary")
		throw new TypeError("Expected a reviewed vocabulary revision");
}

async function requireMedium(tx: DatabaseTransaction, releaseId: string, mediumId: string) {
	z.uuid().parse(mediumId);
	const [medium] = await tx
		.select()
		.from(musicMedium)
		.where(and(eq(musicMedium.releaseId, releaseId), eq(musicMedium.id, mediumId)))
		.limit(1);
	if (!medium) throw new CatalogReferenceNotFound("Music medium is missing from this release");
	return medium;
}

async function requirePresentationCredits(
	tx: DatabaseTransaction,
	actor: string | null,
	input: readonly (string | null | undefined)[],
) {
	const ids = [...new Set(input.filter((id): id is string => id != null))];
	if (!ids.length) return;
	const credits = await tx
		.select()
		.from(musicArtistCredit)
		.where(inArray(musicArtistCredit.id, ids))
		.limit(ids.length);
	if (
		credits.length !== ids.length ||
		credits.some(
			(credit) =>
				!credit.sealedAt ||
				credit.retiredAt ||
				(!credit.publiclyReusable && (actor === null || credit.createdByAuthUserId !== actor)),
		)
	)
		throw new CatalogAccessDenied("Presentation artist credit is not available to this actor");
}

/** @alpha @remarks Native authoring contract; callers supply an authenticated actor and transaction. */
export const MusicReleaseMetadataSchema = z
	.strictObject({
		statusRevisionId: optionalDefinition,
		packagingRevisionId: optionalDefinition,
		languageTag: language.nullable().optional(),
		scriptCode: z
			.string()
			.regex(/^[A-Z][a-z]{3}$/u)
			.nullable()
			.optional(),
		barcode: z.string().max(512).nullable().optional(),
	})
	.refine(
		(value) => Object.values(value).some((entry) => entry !== undefined),
		"No metadata changes supplied",
	);

/** @alpha @remarks Edits native release metadata independently of source imports. */
export async function editMusicReleaseMetadata(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string,
	expectedVersion: number,
	input: z.input<typeof MusicReleaseMetadataSchema>,
) {
	const value = MusicReleaseMetadataSchema.parse(input);
	await requireMusic(tx, release, actor, "release", true);
	await requireVocabulary(tx, value.statusRevisionId);
	await requireVocabulary(tx, value.packagingRevisionId);
	const revision = await recordCatalogChange(
		tx,
		release,
		actor,
		expectedVersion,
		"music.release.metadata.edit",
	);
	await tx.update(musicRelease).set(value).where(eq(musicRelease.id, release.id));
	return { revision };
}

/** @alpha @remarks One indexed native release lookup with related group visibility enforced. */
export async function readMusicReleaseMetadata(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string | null,
) {
	const identity = await requireMusic(tx, release, actor, "release");
	const [row] = await tx
		.select()
		.from(musicRelease)
		.where(eq(musicRelease.id, release.id))
		.limit(1);
	if (!row) throw new CatalogReferenceNotFound("Music release is missing");
	if (row.releaseGroupId)
		await assertReadableTargets(tx, [{ owner: "music", id: row.releaseGroupId }], actor);
	await requirePresentationCredits(tx, actor, [row.artistCreditId]);
	return { ...row, revision: identity.revision };
}

/** @alpha @remarks Changes one medium under the owning release revision lock. */
export async function editMusicMedium(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string,
	expectedVersion: number,
	mediumId: string,
	input: { name?: string | null; formatRevisionId?: string | null },
) {
	const value = z
		.strictObject({
			name: z.string().max(131_072).nullable().optional(),
			formatRevisionId: optionalDefinition,
		})
		.refine(
			(entry) => Object.values(entry).some((item) => item !== undefined),
			"No medium changes supplied",
		)
		.parse(input);
	await requireMusic(tx, release, actor, "release", true);
	await requireMedium(tx, release.id, mediumId);
	await requireVocabulary(tx, value.formatRevisionId);
	if (value.formatRevisionId !== undefined)
		await assertMusicMediumFormatCompatibility(tx, release.id, mediumId, value.formatRevisionId);
	const revision = await recordCatalogChange(
		tx,
		release,
		actor,
		expectedVersion,
		"music.medium.edit",
	);
	await tx
		.update(musicMedium)
		.set(value)
		.where(and(eq(musicMedium.releaseId, release.id), eq(musicMedium.id, mediumId)));
	return { revision };
}

/** @alpha @remarks Physical CD TOCs contain at most 99 ordered frame offsets, excluding leadout. */
export const MusicDiscTocInputSchema = z
	.strictObject({
		discId: z.string().min(1).max(512).nullable().optional(),
		freeDbId: z.string().min(1).max(512).nullable().optional(),
		leadoutOffset: exactInteger,
		offsets: z.array(exactInteger).min(1).max(99),
	})
	.superRefine((value, context) => {
		let previous = -1;
		for (const [position, offset] of value.offsets.entries()) {
			if (offset >= value.leadoutOffset || offset <= previous)
				context.addIssue({
					code: "custom",
					path: ["offsets", position],
					message: "Offsets must increase strictly and precede leadout",
				});
			previous = offset;
		}
	});

/** @alpha @remarks Adds a new immutable TOC and attaches it only to an authorized medium. */
export async function attachMusicDiscToc(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string,
	expectedVersion: number,
	mediumId: string,
	input: z.input<typeof MusicDiscTocInputSchema>,
) {
	const value = MusicDiscTocInputSchema.parse(input);
	await requireMusic(tx, release, actor, "release", true);
	await requireMedium(tx, release.id, mediumId);
	const revision = await recordCatalogChange(
		tx,
		release,
		actor,
		expectedVersion,
		"music.medium.toc.attach",
	);
	const [toc] = await tx
		.insert(musicDiscToc)
		.values({
			discId: value.discId,
			freeDbId: value.freeDbId,
			trackCount: value.offsets.length,
			leadoutOffset: value.leadoutOffset,
		})
		.returning({ id: musicDiscToc.id });
	if (!toc) throw new Error("Disc TOC insertion returned no row");
	await tx
		.insert(musicDiscTocOffset)
		.values(value.offsets.map((offset, position) => ({ tocId: toc.id, position, offset })));
	await tx.insert(musicMediumToc).values({ releaseId: release.id, mediumId, tocId: toc.id });
	return { id: toc.id, revision };
}

/** @alpha @remarks Pages TOC headers; offsets are fetched separately to keep response fan-out bounded. */
export async function listMusicDiscTocs(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string | null,
	mediumId: string,
	input: z.input<typeof CatalogPageSchema> = {},
) {
	const page = CatalogPageSchema.parse(input);
	await requireMusic(tx, release, actor, "release");
	await requireMedium(tx, release.id, mediumId);
	return tx
		.select({
			id: musicDiscToc.id,
			discId: musicDiscToc.discId,
			freeDbId: musicDiscToc.freeDbId,
			trackCount: musicDiscToc.trackCount,
			leadoutOffset: musicDiscToc.leadoutOffset,
		})
		.from(musicMediumToc)
		.innerJoin(musicDiscToc, eq(musicDiscToc.id, musicMediumToc.tocId))
		.where(
			and(
				eq(musicMediumToc.releaseId, release.id),
				eq(musicMediumToc.mediumId, mediumId),
				page.afterId ? gt(musicMediumToc.tocId, page.afterId) : undefined,
			),
		)
		.orderBy(musicMediumToc.tocId)
		.limit(page.limit);
}

/** @alpha @remarks Reads at most 99 offsets after checking the release-scoped TOC attachment. */
export async function readMusicDiscToc(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string | null,
	mediumId: string,
	tocId: string,
) {
	z.uuid().parse(mediumId);
	z.uuid().parse(tocId);
	await requireMusic(tx, release, actor, "release");
	const [toc] = await tx
		.select({
			id: musicDiscToc.id,
			discId: musicDiscToc.discId,
			freeDbId: musicDiscToc.freeDbId,
			trackCount: musicDiscToc.trackCount,
			leadoutOffset: musicDiscToc.leadoutOffset,
		})
		.from(musicMediumToc)
		.innerJoin(musicDiscToc, eq(musicDiscToc.id, musicMediumToc.tocId))
		.where(
			and(
				eq(musicMediumToc.releaseId, release.id),
				eq(musicMediumToc.mediumId, mediumId),
				eq(musicMediumToc.tocId, tocId),
			),
		)
		.limit(1);
	if (!toc) throw new CatalogReferenceNotFound("Disc TOC is not attached to this medium");
	const rows = await tx
		.select()
		.from(musicDiscTocOffset)
		.where(eq(musicDiscTocOffset.tocId, tocId))
		.orderBy(musicDiscTocOffset.position)
		.limit(100);
	if (rows.length !== toc.trackCount || rows.some((row, index) => row.position !== index))
		throw new Error("Disc TOC offsets are incomplete");
	const value = MusicDiscTocInputSchema.parse({
		discId: toc.discId,
		freeDbId: toc.freeDbId,
		leadoutOffset: toc.leadoutOffset,
		offsets: rows.map((row) => row.offset),
	});
	return { id: toc.id, trackCount: toc.trackCount, ...value };
}

const labelInput = z
	.strictObject({
		label: CatalogReferenceSchema.nullable(),
		catalogNumber: z.string().min(1).max(4096).nullable(),
	})
	.refine(
		(value) => value.label !== null || value.catalogNumber !== null,
		"A label or catalog number is required",
	);

/** @alpha @remarks Adds a label association without inventing an organization for an unknown label. */
export async function addMusicReleaseLabel(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string,
	expectedVersion: number,
	input: z.input<typeof labelInput>,
) {
	const value = labelInput.parse(input);
	await requireMusic(tx, release, actor, "release", true);
	if (value.label) {
		if (value.label.owner !== "entity") throw new TypeError("Expected an entity label identity");
		await assertReadableTargets(tx, [value.label], actor);
	}
	const revision = await recordCatalogChange(
		tx,
		release,
		actor,
		expectedVersion,
		"music.release.label.add",
	);
	const [row] = await tx
		.insert(musicReleaseLabel)
		.values({
			releaseId: release.id,
			labelId: value.label?.id ?? null,
			catalogNumber: value.catalogNumber,
		})
		.returning({ id: musicReleaseLabel.id });
	if (!row) throw new Error("Release label insertion returned no row");
	return { id: row.id, revision };
}

/** @alpha @remarks Bounded keyset traversal with related label visibility enforced in one batch. */
export async function listMusicReleaseLabels(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string | null,
	input: z.input<typeof CatalogPageSchema> = {},
) {
	const page = CatalogPageSchema.parse(input);
	await requireMusic(tx, release, actor, "release");
	const rows = await tx
		.select()
		.from(musicReleaseLabel)
		.where(
			and(
				eq(musicReleaseLabel.releaseId, release.id),
				page.afterId ? gt(musicReleaseLabel.id, page.afterId) : undefined,
			),
		)
		.orderBy(musicReleaseLabel.id)
		.limit(page.limit);
	await assertReadableTargets(
		tx,
		rows.flatMap((row): CatalogReference[] =>
			row.labelId ? [{ owner: "entity", id: row.labelId }] : [],
		),
		actor,
	);
	return rows;
}

/** @alpha @remarks Removes one release label association under optimistic revision control. */
export async function removeMusicReleaseLabel(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string,
	expectedVersion: number,
	labelAssociationId: string,
) {
	z.uuid().parse(labelAssociationId);
	await requireMusic(tx, release, actor, "release", true);
	const revision = await recordCatalogChange(
		tx,
		release,
		actor,
		expectedVersion,
		"music.release.label.remove",
	);
	const rows = await tx
		.delete(musicReleaseLabel)
		.where(
			and(
				eq(musicReleaseLabel.releaseId, release.id),
				eq(musicReleaseLabel.id, labelAssociationId),
			),
		)
		.returning({ id: musicReleaseLabel.id });
	if (!rows.length) throw new CatalogReferenceNotFound("Release label association is missing");
	return { revision };
}

/** @alpha @remarks Bounded native date traversal, preserving independently unknown date parts. */
export async function listMusicReleaseEvents(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string | null,
	input: z.input<typeof CatalogPageSchema> = {},
) {
	const page = CatalogPageSchema.parse(input);
	await requireMusic(tx, release, actor, "release");
	const rows = await tx
		.select()
		.from(musicReleaseEvent)
		.where(
			and(
				eq(musicReleaseEvent.releaseId, release.id),
				page.afterId ? gt(musicReleaseEvent.id, page.afterId) : undefined,
			),
		)
		.orderBy(musicReleaseEvent.id)
		.limit(page.limit);
	await assertReadableTargets(
		tx,
		rows.flatMap((row): CatalogReference[] =>
			row.areaId ? [{ owner: "reference", id: row.areaId }] : [],
		),
		actor,
	);
	return rows;
}

/** @alpha @remarks Updates one release date; addReleaseDate provides source-free creation. */
export async function editMusicReleaseEvent(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string,
	expectedVersion: number,
	eventId: string,
	input: {
		date: z.input<typeof CatalogPartialDateSchema>;
		dateText?: string | null;
		area: CatalogReference | null;
	},
) {
	z.uuid().parse(eventId);
	const value = z
		.strictObject({
			date: CatalogPartialDateSchema,
			dateText: z.string().max(4096).nullable().optional(),
			area: CatalogReferenceSchema.nullable(),
		})
		.parse(input);
	await requireMusic(tx, release, actor, "release", true);
	if (value.area) {
		if (value.area.owner !== "reference") throw new TypeError("Expected reference area");
		const area = await loadCatalogIdentity(tx, value.area, actor, false);
		if (area.shape !== "area") throw new TypeError("Expected reference area");
	}
	const revision = await recordCatalogChange(
		tx,
		release,
		actor,
		expectedVersion,
		"music.release.date.edit",
	);
	const rows = await tx
		.update(musicReleaseEvent)
		.set({
			dateYear: value.date.year,
			dateMonth: value.date.month,
			dateDay: value.date.day,
			dateText: value.dateText ?? null,
			areaId: value.area?.id ?? null,
		})
		.where(and(eq(musicReleaseEvent.releaseId, release.id), eq(musicReleaseEvent.id, eventId)))
		.returning({ id: musicReleaseEvent.id });
	if (!rows.length) throw new CatalogReferenceNotFound("Release event is missing");
	return { revision };
}

/** @alpha @remarks Changes a work's reviewed type without source-specific classification fields. */
export async function setMusicWorkType(
	tx: DatabaseTransaction,
	work: CatalogReference,
	actor: string,
	expectedVersion: number,
	typeRevisionId: string | null,
) {
	z.uuid().nullable().parse(typeRevisionId);
	await requireMusic(tx, work, actor, "work", true);
	await requireVocabulary(tx, typeRevisionId);
	const revision = await recordCatalogChange(
		tx,
		work,
		actor,
		expectedVersion,
		"music.work.type.set",
	);
	await tx.update(musicWork).set({ typeRevisionId }).where(eq(musicWork.id, work.id));
	return { revision };
}

/** @alpha @remarks Native work header; languages and identifier claims use their own bounded pages. */
export async function readMusicWorkMetadata(
	tx: DatabaseTransaction,
	work: CatalogReference,
	actor: string | null,
) {
	const identity = await requireMusic(tx, work, actor, "work");
	const [row] = await tx.select().from(musicWork).where(eq(musicWork.id, work.id)).limit(1);
	if (!row) throw new CatalogReferenceNotFound("Music work is missing");
	return { ...row, revision: identity.revision };
}

/** @alpha @remarks Adds or removes a single language; corpus-scale sets are never replaced wholesale. */
export async function setMusicWorkLanguage(
	tx: DatabaseTransaction,
	work: CatalogReference,
	actor: string,
	expectedVersion: number,
	languageTag: string,
	present: boolean,
) {
	const tag = language.parse(languageTag);
	z.boolean().parse(present);
	await requireMusic(tx, work, actor, "work", true);
	const revision = await recordCatalogChange(
		tx,
		work,
		actor,
		expectedVersion,
		"music.work.language.set",
	);
	if (present)
		await tx
			.insert(musicWorkLanguage)
			.values({ workId: work.id, languageTag: tag })
			.onConflictDoNothing();
	else
		await tx
			.delete(musicWorkLanguage)
			.where(and(eq(musicWorkLanguage.workId, work.id), eq(musicWorkLanguage.languageTag, tag)));
	return { revision };
}

/** @alpha @remarks Bounded language traversal using the work/language primary key. */
export async function listMusicWorkLanguages(
	tx: DatabaseTransaction,
	work: CatalogReference,
	actor: string | null,
	input: { afterLanguageTag?: string; limit?: number } = {},
) {
	const page = z
		.strictObject({
			afterLanguageTag: language.optional(),
			limit: z.number().int().min(1).max(100).default(50),
		})
		.parse(input);
	await requireMusic(tx, work, actor, "work");
	return tx
		.select()
		.from(musicWorkLanguage)
		.where(
			and(
				eq(musicWorkLanguage.workId, work.id),
				page.afterLanguageTag
					? gt(musicWorkLanguage.languageTag, page.afterLanguageTag)
					: undefined,
			),
		)
		.orderBy(musicWorkLanguage.languageTag)
		.limit(page.limit);
}

/** @alpha @remarks Primary type is singular; secondary types remain independently addressable rows. */
export async function setMusicReleaseGroupPrimaryType(
	tx: DatabaseTransaction,
	group: CatalogReference,
	actor: string,
	expectedVersion: number,
	primaryTypeRevisionId: string | null,
) {
	z.uuid().nullable().parse(primaryTypeRevisionId);
	await requireMusic(tx, group, actor, "release_group", true);
	await requireVocabulary(tx, primaryTypeRevisionId);
	const revision = await recordCatalogChange(
		tx,
		group,
		actor,
		expectedVersion,
		"music.release_group.primary_type.set",
	);
	await tx
		.update(musicReleaseGroup)
		.set({ primaryTypeRevisionId })
		.where(eq(musicReleaseGroup.id, group.id));
	return { revision };
}

/** @alpha @remarks Native group header; secondary types use a separately bounded page. */
export async function readMusicReleaseGroupMetadata(
	tx: DatabaseTransaction,
	group: CatalogReference,
	actor: string | null,
) {
	const identity = await requireMusic(tx, group, actor, "release_group");
	const [row] = await tx
		.select()
		.from(musicReleaseGroup)
		.where(eq(musicReleaseGroup.id, group.id))
		.limit(1);
	if (!row) throw new CatalogReferenceNotFound("Music release group is missing");
	await requirePresentationCredits(tx, actor, [row.artistCreditId]);
	return { ...row, revision: identity.revision };
}

/** @alpha @remarks Adds or removes one reviewed secondary classification. */
export async function setMusicReleaseGroupSecondaryType(
	tx: DatabaseTransaction,
	group: CatalogReference,
	actor: string,
	expectedVersion: number,
	typeRevisionId: string,
	present: boolean,
) {
	z.uuid().parse(typeRevisionId);
	z.boolean().parse(present);
	await requireMusic(tx, group, actor, "release_group", true);
	await requireVocabulary(tx, typeRevisionId);
	const revision = await recordCatalogChange(
		tx,
		group,
		actor,
		expectedVersion,
		"music.release_group.secondary_type.set",
	);
	if (present)
		await tx
			.insert(musicReleaseGroupSecondaryType)
			.values({ releaseGroupId: group.id, typeRevisionId })
			.onConflictDoNothing();
	else
		await tx
			.delete(musicReleaseGroupSecondaryType)
			.where(
				and(
					eq(musicReleaseGroupSecondaryType.releaseGroupId, group.id),
					eq(musicReleaseGroupSecondaryType.typeRevisionId, typeRevisionId),
				),
			);
	return { revision };
}

/** @alpha @remarks Pages secondary types using the release-group/type primary key. */
export async function listMusicReleaseGroupSecondaryTypes(
	tx: DatabaseTransaction,
	group: CatalogReference,
	actor: string | null,
	input: z.input<typeof CatalogPageSchema> = {},
) {
	const page = CatalogPageSchema.parse(input);
	await requireMusic(tx, group, actor, "release_group");
	return tx
		.select()
		.from(musicReleaseGroupSecondaryType)
		.where(
			and(
				eq(musicReleaseGroupSecondaryType.releaseGroupId, group.id),
				page.afterId ? gt(musicReleaseGroupSecondaryType.typeRevisionId, page.afterId) : undefined,
			),
		)
		.orderBy(musicReleaseGroupSecondaryType.typeRevisionId)
		.limit(page.limit);
}

/** @alpha @remarks Native export traverses ordered media separately from the release header and track pages. */
export async function listMusicMedia(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string | null,
	input: { afterPosition?: number; limit?: number } = {},
) {
	const page = z
		.strictObject({
			afterPosition: z.number().int().min(-1).max(Number.MAX_SAFE_INTEGER).default(-1),
			limit: z.number().int().min(1).max(100).default(50),
		})
		.parse(input);
	await requireMusic(tx, release, actor, "release");
	return tx
		.select()
		.from(musicMedium)
		.where(and(eq(musicMedium.releaseId, release.id), gt(musicMedium.position, page.afterPosition)))
		.orderBy(musicMedium.position)
		.limit(page.limit);
}

const releasePresentationInput = z.strictObject({
	name: z.string().min(1).max(131_072).nullable().optional(),
	artistCreditId: z.uuid().nullable().optional(),
	languageTag: language.nullable().optional(),
	scriptCode: z
		.string()
		.regex(/^[A-Z][a-z]{3}$/u)
		.nullable()
		.optional(),
	typeRevisionId: optionalDefinition,
	comment: z.string().max(131_072).nullable().optional(),
});

/** @alpha @remarks Alternative language or naming presentations retain their release-scoped identity. */
export async function addMusicReleasePresentation(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string,
	expectedVersion: number,
	input: z.input<typeof releasePresentationInput>,
) {
	const value = releasePresentationInput.parse(input);
	await requireMusic(tx, release, actor, "release", true);
	await requirePresentationCredits(tx, actor, [value.artistCreditId]);
	await requireVocabulary(tx, value.typeRevisionId);
	const revision = await recordCatalogChange(
		tx,
		release,
		actor,
		expectedVersion,
		"music.release.presentation.add",
	);
	const [row] = await tx
		.insert(musicReleasePresentation)
		.values({ releaseId: release.id, ...value })
		.returning({ id: musicReleasePresentation.id });
	if (!row) throw new Error("Release presentation insertion returned no row");
	return { id: row.id, revision };
}

/** @alpha @remarks Bounded alternative release presentation export with credit access checks. */
export async function listMusicReleasePresentations(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string | null,
	input: z.input<typeof CatalogPageSchema> = {},
) {
	const page = CatalogPageSchema.parse(input);
	await requireMusic(tx, release, actor, "release");
	const rows = await tx
		.select()
		.from(musicReleasePresentation)
		.where(
			and(
				eq(musicReleasePresentation.releaseId, release.id),
				page.afterId ? gt(musicReleasePresentation.id, page.afterId) : undefined,
			),
		)
		.orderBy(musicReleasePresentation.id)
		.limit(page.limit);
	await requirePresentationCredits(
		tx,
		actor,
		rows.map((row) => row.artistCreditId),
	);
	return rows;
}

/** @alpha @remarks A medium presentation can only reference a medium and presentation of the same release. */
export async function addMusicMediumPresentation(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string,
	expectedVersion: number,
	input: { releasePresentationId: string; mediumId: string; name?: string | null },
) {
	const value = z
		.strictObject({
			releasePresentationId: z.uuid(),
			mediumId: z.uuid(),
			name: z.string().min(1).max(131_072).nullable().optional(),
		})
		.parse(input);
	await requireMusic(tx, release, actor, "release", true);
	await requireMedium(tx, release.id, value.mediumId);
	const [parent] = await tx
		.select({ id: musicReleasePresentation.id })
		.from(musicReleasePresentation)
		.where(
			and(
				eq(musicReleasePresentation.releaseId, release.id),
				eq(musicReleasePresentation.id, value.releasePresentationId),
			),
		)
		.limit(1);
	if (!parent)
		throw new CatalogReferenceNotFound("Release presentation is missing from this release");
	const revision = await recordCatalogChange(
		tx,
		release,
		actor,
		expectedVersion,
		"music.medium.presentation.add",
	);
	const [row] = await tx
		.insert(musicMediumPresentation)
		.values({ releaseId: release.id, ...value })
		.returning({ id: musicMediumPresentation.id });
	if (!row) throw new Error("Medium presentation insertion returned no row");
	return { id: row.id, revision };
}

/** @alpha @remarks Exports a presentation's media using its release/presentation/id index. */
export async function listMusicMediumPresentations(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string | null,
	releasePresentationId: string,
	input: z.input<typeof CatalogPageSchema> = {},
) {
	z.uuid().parse(releasePresentationId);
	const page = CatalogPageSchema.parse(input);
	await requireMusic(tx, release, actor, "release");
	return tx
		.select()
		.from(musicMediumPresentation)
		.where(
			and(
				eq(musicMediumPresentation.releaseId, release.id),
				eq(musicMediumPresentation.releasePresentationId, releasePresentationId),
				page.afterId ? gt(musicMediumPresentation.id, page.afterId) : undefined,
			),
		)
		.orderBy(musicMediumPresentation.id)
		.limit(page.limit);
}

/** @alpha @remarks Alternate track text and credit attach to an existing track occurrence, never a new recording. */
export async function addMusicTrackPresentation(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string,
	expectedVersion: number,
	input: {
		mediumPresentationId: string;
		trackId: string;
		name?: string | null;
		artistCreditId?: string | null;
	},
) {
	const value = z
		.strictObject({
			mediumPresentationId: z.uuid(),
			trackId: z.uuid(),
			name: z.string().min(1).max(131_072).nullable().optional(),
			artistCreditId: z.uuid().nullable().optional(),
		})
		.refine(
			(item) => item.name != null || item.artistCreditId != null,
			"Alternate track requires a name or artist credit",
		)
		.parse(input);
	await requireMusic(tx, release, actor, "release", true);
	await requirePresentationCredits(tx, actor, [value.artistCreditId]);
	const [medium] = await tx
		.select({ mediumId: musicMediumPresentation.mediumId })
		.from(musicMediumPresentation)
		.where(
			and(
				eq(musicMediumPresentation.releaseId, release.id),
				eq(musicMediumPresentation.id, value.mediumPresentationId),
			),
		)
		.limit(1);
	if (!medium)
		throw new CatalogReferenceNotFound("Medium presentation is missing from this release");
	const [track] = await tx
		.select({ id: musicTrackOccurrence.id })
		.from(musicTrackOccurrence)
		.where(
			and(
				eq(musicTrackOccurrence.releaseId, release.id),
				eq(musicTrackOccurrence.id, value.trackId),
				eq(musicTrackOccurrence.mediumId, medium.mediumId),
			),
		)
		.limit(1);
	if (!track) throw new CatalogReferenceNotFound("Track does not belong to the presented medium");
	const revision = await recordCatalogChange(
		tx,
		release,
		actor,
		expectedVersion,
		"music.track.presentation.add",
	);
	const [alternative] = await tx
		.insert(musicAlternativeTrack)
		.values({ name: value.name, artistCreditId: value.artistCreditId })
		.returning({ id: musicAlternativeTrack.id });
	if (!alternative) throw new Error("Alternative track insertion returned no row");
	await tx.insert(musicTrackPresentation).values({
		releaseId: release.id,
		mediumPresentationId: value.mediumPresentationId,
		mediumId: medium.mediumId,
		trackId: value.trackId,
		alternativeTrackId: alternative.id,
	});
	return { id: alternative.id, revision };
}

/** @alpha @remarks Pages alternate track occurrences with bounded joins and batched credit authorization. */
export async function listMusicTrackPresentations(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string | null,
	mediumPresentationId: string,
	input: z.input<typeof CatalogPageSchema> = {},
) {
	z.uuid().parse(mediumPresentationId);
	const page = CatalogPageSchema.parse(input);
	await requireMusic(tx, release, actor, "release");
	const rows = await tx
		.select({
			trackId: musicTrackPresentation.trackId,
			alternativeTrackId: musicAlternativeTrack.id,
			name: musicAlternativeTrack.name,
			artistCreditId: musicAlternativeTrack.artistCreditId,
		})
		.from(musicTrackPresentation)
		.innerJoin(
			musicAlternativeTrack,
			eq(musicAlternativeTrack.id, musicTrackPresentation.alternativeTrackId),
		)
		.where(
			and(
				eq(musicTrackPresentation.releaseId, release.id),
				eq(musicTrackPresentation.mediumPresentationId, mediumPresentationId),
				page.afterId ? gt(musicTrackPresentation.trackId, page.afterId) : undefined,
			),
		)
		.orderBy(musicTrackPresentation.trackId)
		.limit(page.limit);
	await requirePresentationCredits(
		tx,
		actor,
		rows.map((row) => row.artistCreditId),
	);
	return rows;
}
