import type { ContentLanguageSupport } from "@rezics/content-language";
import type { ContentLanguage } from "@rezics/i18n";
import { and, asc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Authorization } from "../authorization";
import { getUnitReadCondition } from "../authorization/unit/query";
import { database } from "../database";
import {
	audio,
	video,
	videoAudioTrack,
	MaximumContentLanguageEvidencePageSize,
} from "../database/schema";
import { InvalidPaginationCursor } from "../pagination/errors";
import { resolvedUnitLocalizationLanguage, resolvedUnitLocalizationTitle } from "./localization";
import { UnitNotFound } from "./errors";
import {
	getUnitContentLanguageSupport,
	getUnitContentLanguageSupportByUnitIds,
	presentContentLanguageSupport,
} from "./content-language-support";

export { MaximumContentLanguageEvidencePageSize };
export const ContentLanguageEvidenceSourceValues = ["adapted_audio"] as const;
type EvidenceOwnerUnitKind = "audio" | "video";
export function contentLanguageEvidenceSourcesForUnitKind(
	unitKind: EvidenceOwnerUnitKind,
): readonly "adapted_audio"[] {
	return unitKind === "video" ? ["adapted_audio"] : [];
}
const EvidenceCursorSchema = z
	.object({
		version: z.literal(1),
		source: z.literal("adapted_audio"),
		ownerUnitId: z.string().uuid(),
		unitId: z.string().uuid(),
	})
	.strict();
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

type EvidenceCandidate = {
	readonly source: "adapted_audio";
	readonly unitId: string;
	readonly unitKind: "audio";
	readonly occurrence: null;
	readonly cursor: ContentLanguageEvidenceCursor;
};
export type ContentLanguageEvidenceItem = {
	readonly source: "adapted_audio";
	readonly unit: {
		readonly id: string;
		readonly kind: "audio";
		readonly language: ContentLanguage | null;
		readonly title: string | null;
	};
	readonly contentLanguageSupport: ReturnType<typeof presentContentLanguageSupport>;
	readonly occurrence: null;
};
type ContentLanguageEvidencePresentation = {
	readonly id: string;
	readonly kind: string;
	readonly language: ContentLanguage | null;
	readonly title: string | null;
};
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
 * Bounded evidence for the timed-media editor: one Video's at-most-64 external
 * Audio tracks. Both seeks use the video/audio composite key; owner hydration is
 * bounded by one page (maximum 50), independently of a 500M or 3B corpus.
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
	await input.authorization.unit.ensureCanUpdate(input.unitId, [["unit"], [input.unitKind]]);
	const table = input.unitKind === "video" ? video : audio;
	const [owner] = await database
		.select({ id: table.id })
		.from(table)
		.where(and(eq(table.id, input.unitId), isNull(table.deletedAt)))
		.limit(1);
	if (!owner) throw new UnitNotFound(input.unitKind);
	if (input.unitKind === "audio" && cursor) throw new InvalidPaginationCursor();
	const rows =
		input.unitKind === "video"
			? await database
					.select({ unitId: videoAudioTrack.audioUnitId })
					.from(videoAudioTrack)
					.where(
						and(
							eq(videoAudioTrack.videoUnitId, input.unitId),
							cursor ? gt(videoAudioTrack.audioUnitId, cursor.unitId) : undefined,
						),
					)
					.orderBy(asc(videoAudioTrack.audioUnitId))
					.limit(input.limit + 1)
			: [];
	const candidates: EvidenceCandidate[] = rows.map(({ unitId }) => ({
		source: "adapted_audio",
		unitId,
		unitKind: "audio",
		occurrence: null,
		cursor: { version: 1, source: "adapted_audio", ownerUnitId: input.unitId, unitId },
	}));
	const ids = rows.slice(0, input.limit).map(({ unitId }) => unitId);
	const [presentations, supportByUnitId, current] = await Promise.all([
		ids.length
			? database
					.select({
						id: audio.id,
						kind: sql<"audio">`'audio'`,
						language: resolvedUnitLocalizationLanguage(audio.id, input.localizationLanguages),
						title: resolvedUnitLocalizationTitle(audio.id, input.localizationLanguages),
					})
					.from(audio)
					.where(
						and(
							inArray(audio.id, ids),
							getUnitReadCondition(input.authorization.profileId, {}, audio),
						),
					)
			: [],
		getUnitContentLanguageSupportByUnitIds(ids),
		getUnitContentLanguageSupport(input.unitId),
	]);
	return {
		currentContentLanguageSupport: presentContentLanguageSupport(current),
		...finalizeContentLanguageEvidencePage({
			candidates,
			limit: input.limit,
			presentations,
			supportByUnitId,
		}),
	};
}
