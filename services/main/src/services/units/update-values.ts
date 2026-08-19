import type { LicenseId } from "@rezics/license";

import type { WorkReleaseStatus } from "../database/schema/contract-values";
import type { RevisionContributionInput } from "./revision-contribution";

/** @internal */
export interface UpdateUnitInput {
	readonly expectedUpdatedAt: Date;
	readonly revisionContribution?: RevisionContributionInput;
	readonly bookChapterDraftScope?: "book_only" | "manageable_published_chapters";
	readonly status?: "draft" | "published" | "archived";
	readonly visibility?: "public" | "unlisted" | "private";
	readonly contentRating?: "general" | "r15" | "r18" | "r18g";
	readonly aiDisclosure?:
		| "unknown"
		| "none"
		| "ai_assisted"
		| "ai_originated"
		| "machine_generated";
	readonly licenses?: readonly LicenseId[];
	readonly unit?: {
		readonly releasedOn?: string | null;
	};
	readonly details?: {
		readonly isbn13?: string | null;
		readonly publicationDate?: string | null;
		readonly pageCount?: number | null;
		readonly wordCount?: number | null;
		readonly versionLabel?: string | null;
		readonly kind?: string;
		readonly runtimeMinutes?: number | null;
		readonly episodeCount?: number | null;
		readonly seasonCount?: number | null;
		readonly durationSeconds?: number | null;
		readonly releaseStatus?: WorkReleaseStatus;
	};
}

function whenAnyValueIsDefined<Values extends Readonly<Record<string, unknown>>>(
	values: Values,
): Values | undefined {
	return Object.values(values).some((value) => value !== undefined) ? values : undefined;
}

/** Returns a millisecond-precise optimistic-concurrency token newer than the current token. @internal */
export function nextUnitUpdatedAt(current: Date, wallClockMilliseconds = Date.now()): Date {
	return new Date(Math.max(wallClockMilliseconds, current.getTime() + 1));
}

/** Maps only Book-owned fields supplied by a partial Unit update. @internal */
export function toBookUpdateValues(input: UpdateUnitInput) {
	const details = input.details ?? {};
	const releasedOn = input.unit?.releasedOn;
	return whenAnyValueIsDefined({
		releaseStatus: details.releaseStatus,
		isbn13: details.isbn13,
		publicationDate: details.publicationDate === undefined ? releasedOn : details.publicationDate,
		pageCount: details.pageCount,
		wordCount: details.wordCount,
	});
}

/** Maps only Software-owned fields supplied by a partial Unit update. @internal */
export function toSoftwareUpdateValues(input: UpdateUnitInput) {
	return whenAnyValueIsDefined({
		releaseDate: input.unit?.releasedOn,
		versionLabel: input.details?.versionLabel,
	});
}

/** Maps only Media-owned fields supplied by a partial Unit update. @internal */
export function toMediaUpdateValues(input: UpdateUnitInput) {
	return whenAnyValueIsDefined({
		releaseStatus: input.details?.releaseStatus,
		releaseDate: input.unit?.releasedOn,
		kind: input.details?.kind,
		runtimeMinutes: input.details?.runtimeMinutes,
		episodeCount: input.details?.episodeCount,
		seasonCount: input.details?.seasonCount,
	});
}

/** Maps only timed-media-owned fields supplied by a partial Unit update. @internal */
export function toTimedMediaUpdateValues(input: UpdateUnitInput) {
	return whenAnyValueIsDefined({ durationSeconds: input.details?.durationSeconds });
}

/** Maps only Series-owned fields supplied by a partial Unit update. @internal */
export function toSeriesUpdateValues(input: UpdateUnitInput) {
	return whenAnyValueIsDefined({ kind: input.details?.kind });
}
