import { toSafeInteger } from "../database/integer";

export interface SubjectAssociationSpoilerColumns {
	readonly spoilerVoteCount: bigint | null;
	readonly spoilerNoneCount: bigint | null;
	readonly spoilerMinorCount: bigint | null;
	readonly spoilerMajorCount: bigint | null;
	readonly viewerSpoilerLevel: number | null;
}

export function presentSubjectAssociationSpoiler(
	columns: SubjectAssociationSpoilerColumns,
	alwaysShowSpoilers: boolean,
) {
	const voteCount = toSafeInteger(
		columns.spoilerVoteCount ?? 0n,
		"Subject association spoiler vote count",
	);
	const none = toSafeInteger(
		columns.spoilerNoneCount ?? 0n,
		"Subject association no-spoiler count",
	);
	const minor = toSafeInteger(
		columns.spoilerMinorCount ?? 0n,
		"Subject association minor-spoiler count",
	);
	const major = toSafeInteger(
		columns.spoilerMajorCount ?? 0n,
		"Subject association major-spoiler count",
	);
	const level: 0 | 1 | 2 =
		major * 2 >= voteCount && voteCount > 0
			? 2
			: (minor + major) * 2 >= voteCount && voteCount > 0
				? 1
				: 0;
	if (
		columns.viewerSpoilerLevel !== null &&
		columns.viewerSpoilerLevel !== 0 &&
		columns.viewerSpoilerLevel !== 1 &&
		columns.viewerSpoilerLevel !== 2
	)
		throw new Error("Subject association viewer spoiler level is invalid");
	const viewerLevel: 0 | 1 | 2 | null = columns.viewerSpoilerLevel;
	return {
		level,
		concealed: level > 0 && !alwaysShowSpoilers,
		voteCount,
		distribution: { none, minor, major },
		viewerLevel,
	};
}
