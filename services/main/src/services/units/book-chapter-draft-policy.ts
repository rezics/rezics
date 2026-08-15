import type { UnitStatus } from "./status";

export const BookChapterDraftPolicyV1 = {
	claimBatchSize: 2,
	chapterBatchSize: 25,
	leaseDurationMilliseconds: 30_000,
	maximumAttempts: 5,
	maximumRetryDelayMilliseconds: 60_000,
} as const;

export function bookChapterDraftRetryDelayMilliseconds(attemptCount: number): number {
	return Math.min(
		BookChapterDraftPolicyV1.maximumRetryDelayMilliseconds,
		1_000 * 2 ** attemptCount,
	);
}

export function shouldDraftBookChapter(status: UnitStatus, allowed: boolean): boolean {
	return allowed && status === "published";
}
