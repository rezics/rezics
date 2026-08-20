import type { ContentLanguageSupport } from "@rezics/content-language";
import type { ContentLanguage } from "@rezics/i18n";
import { and, asc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";

import type { Authorization } from "../authorization";
import { getUnitReadCondition } from "../authorization/unit/query";
import { database } from "../database";
import {
	contentStructure,
	contentStructureNode,
	release,
	unit,
	videoAudioTrack,
	unitVariant,
	type ContentLanguageEvidenceSource,
	ContentLanguageEvidenceSourceValues,
	ContentLanguageSupportUnitKindValues,
	type ContentLanguageSupportUnitKind,
	MaximumContentLanguageEvidencePageSize,
} from "../database/schema";
import { InvalidPaginationCursor } from "../pagination/errors";
import { resolvedUnitLocalizationLanguage, resolvedUnitLocalizationTitle } from "./localization";
import { UnitNotFound } from "./errors";
import {
	getUnitContentLanguageSupport,
	getUnitContentLanguageSupportByUnitIds,
	isContentLanguageSupportUnitKind,
	presentContentLanguageSupport,
} from "./content-language-support";

export { ContentLanguageEvidenceSourceValues, MaximumContentLanguageEvidencePageSize };
type EvidenceOwnerUnitKind = ContentLanguageSupportUnitKind;

export function contentLanguageEvidenceSourcesForUnitKind(
	unitKind: EvidenceOwnerUnitKind,
): readonly ContentLanguageEvidenceSource[] {
	switch (unitKind) {
		case "release":
			return ["parent"];
		case "book":
			return ["main", "variant"];
		case "software":
			return ["main", "variant", "release"];
		case "media":
			return ["main", "variant", "occurrence"];
		case "video":
			return ["adapted_audio"];
		case "audio":
			return [];
	}
}

const ParentCursorSchema = z
	.object({ version: z.literal(1), source: z.literal("parent"), ownerUnitId: z.string().uuid() })
	.strict();
const MainCursorSchema = z
	.object({ version: z.literal(1), source: z.literal("main"), ownerUnitId: z.string().uuid() })
	.strict();
const VariantCursorSchema = z
	.object({
		version: z.literal(1),
		source: z.literal("variant"),
		ownerUnitId: z.string().uuid(),
		createdAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
		unitId: z.string().uuid(),
	})
	.strict();
const ReleaseCursorSchema = z
	.object({
		version: z.literal(1),
		source: z.literal("release"),
		ownerUnitId: z.string().uuid(),
		releasedOn: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/)
			.nullable(),
		unitId: z.string().uuid(),
	})
	.strict();
const OccurrenceCursorSchema = z
	.object({
		version: z.literal(1),
		source: z.literal("occurrence"),
		ownerUnitId: z.string().uuid(),
		structureId: z.string().uuid(),
		nodeId: z.string().uuid(),
	})
	.strict();
const AdaptedAudioCursorSchema = z
	.object({
		version: z.literal(1),
		source: z.literal("adapted_audio"),
		ownerUnitId: z.string().uuid(),
		unitId: z.string().uuid(),
	})
	.strict();
const EvidenceCursorSchema = z.discriminatedUnion("source", [
	ParentCursorSchema,
	MainCursorSchema,
	VariantCursorSchema,
	ReleaseCursorSchema,
	OccurrenceCursorSchema,
	AdaptedAudioCursorSchema,
]);
export type ContentLanguageEvidenceCursor = z.infer<typeof EvidenceCursorSchema>;

export function encodeContentLanguageEvidenceCursor(cursor: ContentLanguageEvidenceCursor): string {
	return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeContentLanguageEvidenceCursor(
	cursor?: string,
	expectedOwnerUnitId?: string,
): ContentLanguageEvidenceCursor | undefined {
	if (!cursor) return undefined;
	try {
		const parsed = EvidenceCursorSchema.parse(
			JSON.parse(Buffer.from(cursor, "base64url").toString()),
		);
		if (expectedOwnerUnitId && parsed.ownerUnitId !== expectedOwnerUnitId)
			throw new InvalidPaginationCursor();
		return parsed;
	} catch {
		throw new InvalidPaginationCursor();
	}
}

const SourceRank = {
	parent: 0,
	main: 1,
	variant: 2,
	release: 3,
	occurrence: 4,
	adapted_audio: 5,
} as const satisfies Record<ContentLanguageEvidenceSource, number>;

type EvidenceCandidate = {
	readonly source: ContentLanguageEvidenceSource;
	readonly unitId: string;
	readonly unitKind: ContentLanguageSupportUnitKind;
	readonly occurrence: { readonly structureId: string; readonly nodeId: string } | null;
	readonly cursor: ContentLanguageEvidenceCursor;
};

export type ContentLanguageEvidenceItem = {
	readonly source: ContentLanguageEvidenceSource;
	readonly unit: {
		readonly id: string;
		readonly kind: ContentLanguageSupportUnitKind;
		readonly language: ContentLanguage | null;
		readonly title: string | null;
	};
	readonly contentLanguageSupport: ReturnType<typeof presentContentLanguageSupport>;
	readonly occurrence: { readonly structureId: string; readonly nodeId: string } | null;
};

type ContentLanguageEvidencePresentation = {
	readonly id: string;
	readonly kind: string;
	readonly language: ContentLanguage | null;
	readonly title: string | null;
};

function sourceCanRun(
	source: ContentLanguageEvidenceSource,
	cursor: ContentLanguageEvidenceCursor | undefined,
): boolean {
	return !cursor || SourceRank[cursor.source] <= SourceRank[source];
}

/** One direct, authorized Release-parent lookup. @internal */
export function releaseParentContentLanguageEvidenceQuery(input: {
	readonly releaseUnitId: string;
	readonly profileId?: string;
}) {
	return database
		.select({ id: unit.id, kind: unit.kind })
		.from(release)
		.innerJoin(unit, eq(unit.id, release.parentUnitId))
		.where(
			and(
				eq(release.id, input.releaseUnitId),
				inArray(unit.kind, ContentLanguageSupportUnitKindValues),
				getUnitReadCondition(input.profileId),
			),
		)
		.limit(1);
}

/**
 * Finalizes one raw candidate page after the second authorization projection.
 *
 * A candidate that became unreadable, deleted, or changed kind between the
 * source query and hydration is omitted. Pagination still advances through
 * the raw candidate boundary, so the race can produce a short page but cannot
 * leak support or make the caller retry the same inaccessible row forever.
 *
 * @internal
 */
export function finalizeContentLanguageEvidencePage(input: {
	readonly candidates: readonly EvidenceCandidate[];
	readonly limit: number;
	readonly presentations: readonly ContentLanguageEvidencePresentation[];
	readonly supportByUnitId: ReadonlyMap<string, ContentLanguageSupport>;
}): { readonly items: ContentLanguageEvidenceItem[]; readonly nextCursor: string | null } {
	const pageCandidates = input.candidates.slice(0, input.limit);
	const presentationByUnitId = new Map(
		input.presentations.map((presentation) => [presentation.id, presentation] as const),
	);
	const items: ContentLanguageEvidenceItem[] = [];
	for (const candidate of pageCandidates) {
		const presentation = presentationByUnitId.get(candidate.unitId);
		if (!presentation || presentation.kind !== candidate.unitKind) continue;
		items.push({
			source: candidate.source,
			unit: {
				id: candidate.unitId,
				kind: candidate.unitKind,
				language: presentation.language,
				title: presentation.title,
			},
			contentLanguageSupport: presentContentLanguageSupport(
				input.supportByUnitId.get(candidate.unitId) ?? [],
			),
			occurrence: candidate.occurrence,
		});
	}
	const last = pageCandidates.at(-1);
	return {
		items,
		nextCursor:
			input.candidates.length > input.limit && last
				? encodeContentLanguageEvidenceCursor(last.cursor)
				: null,
	};
}

/**
 * Bounded, non-recursive evidence for the editing UI.
 *
 * Every source is one indexed hop and fetches at most `limit + 1` rows. The
 * request performs at most one parent lookup, one Main lookup, one Variant
 * range, one direct Release range, one direct Media occurrence range, and two
 * bounded batch projections, independent of corpus size at 500M or 3B rows.
 */
export async function listContentLanguageEvidence(input: {
	readonly unitId: string;
	readonly unitKind: EvidenceOwnerUnitKind;
	readonly authorization: Authorization<string>;
	readonly localizationLanguages: readonly ContentLanguage[];
	readonly cursor?: string;
	readonly limit: number;
}): Promise<{
	readonly currentContentLanguageSupport: ReturnType<typeof presentContentLanguageSupport>;
	readonly items: ContentLanguageEvidenceItem[];
	readonly nextCursor: string | null;
}> {
	const cursor = decodeContentLanguageEvidenceCursor(input.cursor, input.unitId);
	if (
		!Number.isInteger(input.limit) ||
		input.limit < 1 ||
		input.limit > MaximumContentLanguageEvidencePageSize
	)
		throw new RangeError(
			`Content language evidence page size must be between 1 and ${MaximumContentLanguageEvidencePageSize}`,
		);
	const supportedSources = contentLanguageEvidenceSourcesForUnitKind(input.unitKind);
	await input.authorization.unit.ensureCanUpdate(input.unitId, [["unit"], [input.unitKind]]);
	const [current] = await database
		.select({ id: unit.id, kind: unit.kind })
		.from(unit)
		.where(and(eq(unit.id, input.unitId), eq(unit.kind, input.unitKind), isNull(unit.deletedAt)))
		.limit(1);
	if (!current) throw new UnitNotFound(input.unitKind);

	const targetCount = input.limit + 1;
	const candidates: EvidenceCandidate[] = [];
	const remaining = () => targetCount - candidates.length;

	if (!cursor && input.unitKind === "release" && supportedSources.includes("parent")) {
		const [parent] = await releaseParentContentLanguageEvidenceQuery({
			releaseUnitId: input.unitId,
			profileId: input.authorization.profileId,
		});
		if (parent) {
			if (!isContentLanguageSupportUnitKind(parent.kind))
				throw new Error("Release parent content language evidence kind proof was lost");
			candidates.push({
				source: "parent",
				unitId: parent.id,
				unitKind: parent.kind,
				occurrence: null,
				cursor: { version: 1, source: "parent", ownerUnitId: input.unitId },
			});
		}
	}
	const [variantRelation] =
		input.unitKind === "book" || input.unitKind === "software" || input.unitKind === "media"
			? await database
					.select({ mainUnitId: unitVariant.mainUnitId })
					.from(unitVariant)
					.where(eq(unitVariant.variantUnitId, input.unitId))
					.limit(1)
			: [];
	const mainUnitId = variantRelation?.mainUnitId ?? input.unitId;

	if (!cursor && variantRelation && supportedSources.includes("main")) {
		const [readableMain] = await database
			.select({ id: unit.id, kind: unit.kind })
			.from(unit)
			.where(
				and(
					eq(unit.id, variantRelation.mainUnitId),
					eq(unit.kind, input.unitKind),
					getUnitReadCondition(input.authorization.profileId),
				),
			)
			.limit(1);
		if (readableMain)
			candidates.push({
				source: "main",
				unitId: readableMain.id,
				unitKind: input.unitKind,
				occurrence: null,
				cursor: { version: 1, source: "main", ownerUnitId: input.unitId },
			});
	}

	if (
		remaining() > 0 &&
		supportedSources.includes("variant") &&
		sourceCanRun("variant", cursor) &&
		(input.unitKind === "book" || input.unitKind === "software" || input.unitKind === "media")
	) {
		const variantCursor = cursor?.source === "variant" ? cursor : undefined;
		const rows = await database
			.select({
				unitId: unitVariant.variantUnitId,
				unitKind: unitVariant.unitKind,
				createdAt: unitVariant.createdAt,
			})
			.from(unitVariant)
			.innerJoin(unit, eq(unit.id, unitVariant.variantUnitId))
			.where(
				and(
					eq(unitVariant.mainUnitId, mainUnitId),
					ne(unitVariant.variantUnitId, input.unitId),
					getUnitReadCondition(input.authorization.profileId),
					variantCursor
						? or(
								gt(unitVariant.createdAt, new Date(variantCursor.createdAt)),
								and(
									eq(unitVariant.createdAt, new Date(variantCursor.createdAt)),
									gt(unitVariant.variantUnitId, variantCursor.unitId),
								),
							)
						: undefined,
				),
			)
			.orderBy(asc(unitVariant.createdAt), asc(unitVariant.variantUnitId))
			.limit(remaining());
		candidates.push(
			...rows.map((row): EvidenceCandidate => {
				if (row.unitKind !== input.unitKind)
					throw new Error("Variant content language evidence kind proof was lost");
				return {
					source: "variant",
					unitId: row.unitId,
					unitKind: input.unitKind,
					occurrence: null,
					cursor: {
						version: 1,
						source: "variant",
						ownerUnitId: input.unitId,
						createdAt: row.createdAt.toISOString(),
						unitId: row.unitId,
					},
				};
			}),
		);
	}

	if (
		remaining() > 0 &&
		supportedSources.includes("adapted_audio") &&
		sourceCanRun("adapted_audio", cursor) &&
		input.unitKind === "video"
	) {
		const adaptedAudioCursor = cursor?.source === "adapted_audio" ? cursor : undefined;
		const rows = await database
			.select({ unitId: videoAudioTrack.audioUnitId, unitKind: unit.kind })
			.from(videoAudioTrack)
			.innerJoin(unit, eq(unit.id, videoAudioTrack.audioUnitId))
			.where(
				and(
					eq(videoAudioTrack.videoUnitId, input.unitId),
					eq(unit.kind, "audio"),
					getUnitReadCondition(input.authorization.profileId),
					adaptedAudioCursor
						? gt(videoAudioTrack.audioUnitId, adaptedAudioCursor.unitId)
						: undefined,
				),
			)
			.orderBy(asc(videoAudioTrack.audioUnitId))
			.limit(remaining());
		candidates.push(
			...rows.map((row): EvidenceCandidate => {
				if (row.unitKind !== "audio")
					throw new Error("Adapted Audio content language evidence kind proof was lost");
				return {
					source: "adapted_audio",
					unitId: row.unitId,
					unitKind: row.unitKind,
					occurrence: null,
					cursor: {
						version: 1,
						source: "adapted_audio",
						ownerUnitId: input.unitId,
						unitId: row.unitId,
					},
				};
			}),
		);
	}

	if (
		remaining() > 0 &&
		supportedSources.includes("release") &&
		sourceCanRun("release", cursor) &&
		input.unitKind === "software"
	) {
		const releaseCursor = cursor?.source === "release" ? cursor : undefined;
		const rows = await database
			.select({ unitId: release.id, releasedOn: release.releasedOn })
			.from(release)
			.innerJoin(unit, eq(unit.id, release.id))
			.where(
				and(
					eq(release.parentUnitId, input.unitId),
					getUnitReadCondition(input.authorization.profileId),
					releaseCursor
						? releaseCursor.releasedOn === null
							? and(isNull(release.releasedOn), gt(release.id, releaseCursor.unitId))
							: or(
									gt(release.releasedOn, releaseCursor.releasedOn),
									and(
										eq(release.releasedOn, releaseCursor.releasedOn),
										gt(release.id, releaseCursor.unitId),
									),
									isNull(release.releasedOn),
								)
						: undefined,
				),
			)
			.orderBy(sql`${release.releasedOn} asc nulls last`, asc(release.id))
			.limit(remaining());
		candidates.push(
			...rows.map(
				(row): EvidenceCandidate => ({
					source: "release",
					unitId: row.unitId,
					unitKind: "release",
					occurrence: null,
					cursor: {
						version: 1,
						source: "release",
						ownerUnitId: input.unitId,
						releasedOn: row.releasedOn,
						unitId: row.unitId,
					},
				}),
			),
		);
	}

	if (
		remaining() > 0 &&
		supportedSources.includes("occurrence") &&
		sourceCanRun("occurrence", cursor) &&
		input.unitKind === "media"
	) {
		const occurrenceCursor = cursor?.source === "occurrence" ? cursor : undefined;
		const rows = await database
			.select({
				structureId: contentStructureNode.structureId,
				nodeId: contentStructureNode.id,
				unitId: contentStructureNode.contentUnitId,
				unitKind: unit.kind,
			})
			.from(contentStructure)
			.innerJoin(
				contentStructureNode,
				and(
					eq(contentStructureNode.structureId, contentStructure.id),
					eq(contentStructureNode.ownerUnitId, contentStructure.ownerUnitId),
				),
			)
			.innerJoin(unit, eq(unit.id, contentStructureNode.contentUnitId))
			.where(
				and(
					eq(contentStructure.ownerUnitId, input.unitId),
					eq(contentStructure.kind, "media.contents"),
					isNull(contentStructure.deletedAt),
					isNull(contentStructureNode.deletedAt),
					inArray(unit.kind, ["video", "audio"]),
					getUnitReadCondition(input.authorization.profileId),
					occurrenceCursor
						? or(
								gt(contentStructureNode.structureId, occurrenceCursor.structureId),
								and(
									eq(contentStructureNode.structureId, occurrenceCursor.structureId),
									gt(contentStructureNode.id, occurrenceCursor.nodeId),
								),
							)
						: undefined,
				),
			)
			.orderBy(asc(contentStructureNode.structureId), asc(contentStructureNode.id))
			.limit(remaining());
		candidates.push(
			...rows.map((row): EvidenceCandidate => {
				if (row.unitKind !== "video" && row.unitKind !== "audio")
					throw new Error("Media content language evidence kind proof was lost");
				return {
					source: "occurrence",
					unitId: row.unitId,
					unitKind: row.unitKind,
					occurrence: { structureId: row.structureId, nodeId: row.nodeId },
					cursor: {
						version: 1,
						source: "occurrence",
						ownerUnitId: input.unitId,
						structureId: row.structureId,
						nodeId: row.nodeId,
					},
				};
			}),
		);
	}

	const pageCandidates = candidates.slice(0, input.limit);
	const relatedIds = [...new Set(pageCandidates.map(({ unitId }) => unitId))];
	const [presentations, supportByUnitId, currentContentLanguageSupport] = await Promise.all([
		relatedIds.length
			? database
					.select({
						id: unit.id,
						kind: unit.kind,
						language: resolvedUnitLocalizationLanguage(unit.id, input.localizationLanguages),
						title: resolvedUnitLocalizationTitle(unit.id, input.localizationLanguages),
					})
					.from(unit)
					.where(
						and(inArray(unit.id, relatedIds), getUnitReadCondition(input.authorization.profileId)),
					)
			: [],
		getUnitContentLanguageSupportByUnitIds(relatedIds),
		getUnitContentLanguageSupport(input.unitId),
	]);
	const finalizedPage = finalizeContentLanguageEvidencePage({
		candidates,
		limit: input.limit,
		presentations,
		supportByUnitId,
	});
	return {
		currentContentLanguageSupport: presentContentLanguageSupport(currentContentLanguageSupport),
		...finalizedPage,
	};
}
